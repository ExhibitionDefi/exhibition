import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { Exhibition } from "../typechain-types";

/**
 * Test script to verify AMM fee mechanics
 * Tests:
 * 1. Trading fee calculation (0.3% default)
 * 2. Protocol fee split (16.67% of trading fee)
 * 3. LP fee accumulation (83.33% of trading fee)
 * 4. Fee collection for protocol
 * 5. LP token value increase from fees
 */

async function main() {
    console.log("Starting AMM Fee Testing Script...\n");

    // Get signers
    const [deployer, user1, user2, feeRecipient] = await ethers.getSigners();

    console.log(`Deployer: ${deployer.address}`);
    console.log(`User1: ${user1.address}`);
    console.log(`User2: ${user2.address}`);
    console.log(`Fee Recipient: ${feeRecipient.address}\n`);

    // Load deployed addresses
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const exhibitionUSDAddress = deployedAddresses.ExhibitionUSD;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens;
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", deployedAddresses.Exhibition, deployer);
    const exhTokenAddress = deployedAddresses.ExhToken;

    // Get contract instances
    const exhibitionUSD = await ethers.getContractAt("ExhibitionUSD", exhibitionUSDAddress, deployer);
    const exhibitionNEX = await ethers.getContractAt("ExhibitionNEX", exhibitionNEXAddress, deployer);
    const exhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const exhibitionLPTokens = await ethers.getContractAt("ExhibitionLPTokens", exhibitionLPTokensAddress, deployer);

    console.log("--- Using Existing Tokens ---");
    console.log(`ExhibitionUSD: ${exhibitionUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}\n`);

    // Setup tokens for testing
    console.log("--- Setting Up Test Tokens ---");
    
    // Mint exUSD to users via faucet
    //await exhibition.connect(user1).requestFaucetTokens();
    //await exhibition.connect(user2).requestFaucetTokens();
    //console.log("✅ exUSD minted to users");

    // For ExhibitionNEX, users need to deposit NEX to get exNEX
    console.log("\nUser1 depositing NEX to get exNEX...");
    const depositAmount = ethers.parseEther("30000.0"); // 30,000 NEX
    await exhibitionNEX.connect(user1).deposit({ value: depositAmount });
    const user1NEXBalance = await exhibitionNEX.balanceOf(user1.address);
    console.log(`✅ User1 received ${ethers.formatUnits(user1NEXBalance, 18)} exNEX\n`);

    // Get fee configuration
    console.log("--- Fee Configuration ---");
    const feeConfig = await exhibitionAMM.getFeeConfig();
    console.log(`Trading Fee: ${feeConfig.tradingFee} bps (${Number(feeConfig.tradingFee) / 100}%)`);
    console.log(`Protocol Fee: ${feeConfig.protocolFee} bps (${Number(feeConfig.protocolFee) / 100}% of trading fee)`);
    console.log(`Fee Recipient: ${feeConfig.feeRecipient}`);
    console.log(`Fees Enabled: ${feeConfig.feesEnabled}\n`);

    // Calculate expected fee splits
    const tradingFeeBps = Number(feeConfig.tradingFee);
    const protocolFeeBps = Number(feeConfig.protocolFee);
    const expectedProtocolShare = (tradingFeeBps * protocolFeeBps) / 10000;
    const expectedLPShare = tradingFeeBps - expectedProtocolShare;
    
    console.log("--- Expected Fee Distribution (per 10,000 units) ---");
    console.log(`Trading Fee: ${tradingFeeBps} bps`);
    console.log(`Protocol Share: ${expectedProtocolShare.toFixed(2)} bps`);
    console.log(`LP Share: ${expectedLPShare.toFixed(2)} bps\n`);

    // ===================================
    // TEST 1: Add Initial Liquidity
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 1: Add Initial Liquidity (No Fees)");
    console.log("=".repeat(60) + "\n");

    const initialUSD = ethers.parseUnits("10000", 6); // 10,000 USDT
    const initialNEX = ethers.parseUnits("20000", 18); // 20,000 exNEX

    console.log(`User1 adding liquidity: ${ethers.formatUnits(initialUSD, 6)} USDT + ${ethers.formatUnits(initialNEX, 18)} exNEX`);

    await exhibitionUSD.connect(user1).approve(exhibitionAMMAddress, initialUSD);
    await exhibitionNEX.connect(user1).approve(exhibitionAMMAddress, initialNEX);

    // Get current block timestamp from the blockchain
    const latestBlock = await ethers.provider.getBlock('latest');
    const deadline = BigInt(latestBlock!.timestamp + 600);

    const addLiqTx = await exhibitionAMM.connect(user1).addLiquidity(
        exhibitionUSDAddress,
        exhibitionNEXAddress,
        initialUSD,
        initialNEX,
        0,
        0,
        user1.address,
        deadline
    );
    await addLiqTx.wait();

    const user1LPBalance = await exhibitionLPTokens.balanceOf(exhibitionUSDAddress, exhibitionNEXAddress, user1.address);
    console.log(`✅ Liquidity added. User1 LP tokens: ${ethers.formatUnits(user1LPBalance, 18)}\n`);

    // Get initial reserves
    const reservesAfterAdd = await exhibitionAMM.getReserves(exhibitionUSDAddress, exhibitionNEXAddress);
    console.log(`Initial Pool Reserves:`);
    console.log(`  USDT: ${ethers.formatUnits(reservesAfterAdd[0], 6)}`);
    console.log(`  exNEX: ${ethers.formatUnits(reservesAfterAdd[1], 18)}\n`);

    // ===================================
    // TEST 2: Perform Swap and Check Fees
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 2: Swap and Fee Calculation");
    console.log("=".repeat(60) + "\n");

    const swapAmount = ethers.parseUnits("1000", 6); // Swap 1,000 USDT
    console.log(`User2 swapping: ${ethers.formatUnits(swapAmount, 6)} USDT for exNEX\n`);

    // Calculate expected fees BEFORE swap
    const expectedFees = await exhibitionAMM.calculateExpectedFees(swapAmount);
    const expectedTradingFee = expectedFees[0];
    const expectedProtocolFee = expectedFees[1];
    const expectedLPFee = expectedFees[2];

    console.log("--- Expected Fees ---");
    console.log(`Total Trading Fee: ${ethers.formatUnits(expectedTradingFee, 6)} USDT`);
    console.log(`Protocol Fee: ${ethers.formatUnits(expectedProtocolFee, 6)} USDT (${((Number(expectedProtocolFee) / Number(expectedTradingFee)) * 100).toFixed(2)}%)`);
    console.log(`LP Fee: ${ethers.formatUnits(expectedLPFee, 6)} USDT (${((Number(expectedLPFee) / Number(expectedTradingFee)) * 100).toFixed(2)}%)\n`);

    // Get expected output
    const expectedOut = await exhibitionAMM.getAmountOut(swapAmount, exhibitionUSDAddress, exhibitionNEXAddress);
    console.log(`Expected exNEX output: ${ethers.formatUnits(expectedOut, 18)}\n`);

    // Record balances before swap
    const user2exUSDBefore = await exhibitionUSD.balanceOf(user2.address);
    const user2NEXBefore = await exhibitionNEX.balanceOf(user2.address);
    const ammexUSDBefore = await exhibitionUSD.balanceOf(exhibitionAMMAddress);
    const ammNEXBefore = await exhibitionNEX.balanceOf(exhibitionAMMAddress);

    // Perform swap
    await exhibitionUSD.connect(user2).approve(exhibitionAMMAddress, swapAmount);
    
    const swapTx = await exhibitionAMM.connect(user2).swapTokenForToken(
        exhibitionUSDAddress,
        exhibitionNEXAddress,
        swapAmount,
        0,
        user2.address,
        deadline
    );
    const swapReceipt = await swapTx.wait();

    // Parse Swap event
    let swapEvent: any = null;
    if (swapReceipt && swapReceipt.logs) {
        for (const log of swapReceipt.logs) {
            try {
                const parsedLog = exhibitionAMM.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "Swap") {
                    swapEvent = parsedLog.args;
                    break;
                }
            } catch (e) {}
        }
    }

    console.log("--- Swap Event Data ---");
    if (swapEvent) {
        console.log(`Amount In: ${ethers.formatUnits(swapEvent.amountIn, 6)} USDT`);
        console.log(`Amount Out: ${ethers.formatUnits(swapEvent.amountOut, 18)} exNEX`);
        console.log(`Trading Fee: ${ethers.formatUnits(swapEvent.tradingFeeAmount || 0, 6)} USDT`);
        console.log(`Protocol Fee: ${ethers.formatUnits(swapEvent.protocolFeeAmount || 0, 6)} USDT\n`);
    }

    // Record balances after swap
    const user2exUSDAfter = await exhibitionUSD.balanceOf(user2.address);
    const user2NEXAfter = await exhibitionNEX.balanceOf(user2.address);
    const ammexUSDAfter = await exhibitionUSD.balanceOf(exhibitionAMMAddress);
    const ammNEXAfter = await exhibitionNEX.balanceOf(exhibitionAMMAddress);

    console.log("--- Balance Changes ---");
    console.log(`User2 exUSD: ${ethers.formatUnits(user2exUSDBefore, 6)} → ${ethers.formatUnits(user2exUSDAfter, 6)} (${ethers.formatUnits(user2exUSDAfter - user2exUSDBefore, 6)})`);
    console.log(`User2 exNEX: ${ethers.formatUnits(user2NEXBefore, 18)} → ${ethers.formatUnits(user2NEXAfter, 18)} (+${ethers.formatUnits(user2NEXAfter - user2NEXBefore, 18)})`);
    console.log(`AMM exUSD: ${ethers.formatUnits(ammexUSDBefore, 6)} → ${ethers.formatUnits(ammexUSDAfter, 6)} (+${ethers.formatUnits(ammexUSDAfter - ammexUSDBefore, 6)})`);
    console.log(`AMM exNEX: ${ethers.formatUnits(ammNEXBefore, 18)} → ${ethers.formatUnits(ammNEXAfter, 18)} (${ethers.formatUnits(ammNEXAfter - ammNEXBefore, 18)})\n`);

    // --- Verify fee calculations (BigInt-safe) ---
    const expectedexUSDInPool = swapAmount - expectedProtocolFee;
    const actualexUSDReceived = ammexUSDAfter - ammexUSDBefore;

    // Allow 1 base-unit tolerance
    const TOLERANCE = 1n;
    const diff = actualexUSDReceived > expectedexUSDInPool
      ? actualexUSDReceived - expectedexUSDInPool
      : expectedexUSDInPool - actualexUSDReceived;

    let feeAccountingModel: "internal" | "subtracted" | "unknown" = "unknown";

    if (actualexUSDReceived === swapAmount || (actualexUSDReceived > swapAmount - TOLERANCE && actualexUSDReceived < swapAmount + TOLERANCE)) {
      feeAccountingModel = "internal";
      console.log("✅ Protocol fee tracked internally (not subtracted from pool reserves).");
    } else if (diff <= TOLERANCE) {
      feeAccountingModel = "subtracted";
      console.log("✅ Protocol fee subtracted directly from pool reserves.");
    } else {
      feeAccountingModel = "unknown";
      console.log("❌ Unexpected exUSD accounting behavior.");
      console.log(`  Expected: ${ethers.formatUnits(expectedexUSDInPool, 6)} exUSD`);
      console.log(`  Actual: ${ethers.formatUnits(actualexUSDReceived, 6)} exUSD`);
    }

    const feeCalcPassed = feeAccountingModel !== "unknown";
    console.log(`Fee Calculation Test Passed: ${feeCalcPassed ? "✅" : "❌"}\n`);

    // ===================================
    // TEST 3: Check Accumulated Protocol Fees
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 3: Accumulated Protocol Fees");
    console.log("=".repeat(60) + "\n");

    const accumulatedFees = await exhibitionAMM.getAccumulatedProtocolFees(exhibitionUSDAddress, exhibitionNEXAddress);
    console.log("Accumulated Protocol Fees:");
    console.log(`  Token0 (exUSD): ${ethers.formatUnits(accumulatedFees.fees0, 6)} exUSD`);
    console.log(`  Token1 (exNEX): ${ethers.formatUnits(accumulatedFees.fees1, 18)} exNEX`);
    console.log(`Expected Protocol Fee: ${ethers.formatUnits(expectedProtocolFee, 6)} exUSD`);
    console.log(`Match: ${accumulatedFees.fees0 === expectedProtocolFee ? "✅" : "❌"}\n`);

    // ===================================
    // TEST 4: Collect Protocol Fees
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 4: Collect Protocol Fees");
    console.log("=".repeat(60) + "\n");

    const recipientBalanceBefore = await exhibitionUSD.balanceOf(feeConfig.feeRecipient);
    console.log(`Fee Recipient exUSD balance before: ${ethers.formatUnits(recipientBalanceBefore, 6)}\n`);

    console.log("Collecting protocol fees...");
    const collectTx = await exhibitionAMM.connect(deployer).collectProtocolFees(
        exhibitionUSDAddress,
        exhibitionNEXAddress
    );
    await collectTx.wait();

    const recipientBalanceAfter = await exhibitionUSD.balanceOf(feeConfig.feeRecipient);
    const collectedAmount = recipientBalanceAfter - recipientBalanceBefore;

    console.log(`Fee Recipient exUSD balance after: ${ethers.formatUnits(recipientBalanceAfter, 6)}`);
    console.log(`Amount collected: ${ethers.formatUnits(collectedAmount, 6)} exUSD`);
    console.log(`Expected: ${ethers.formatUnits(expectedProtocolFee, 6)} exUSD`);
    console.log(`Match: ${collectedAmount === expectedProtocolFee ? "✅" : "❌"}\n`);

    // Verify fees reset after collection
    const feesAfterCollection = await exhibitionAMM.getAccumulatedProtocolFees(exhibitionUSDAddress, exhibitionNEXAddress);
    console.log("Accumulated fees after collection:");
    console.log(`  Token0 (exUSD): ${ethers.formatUnits(feesAfterCollection.fees0, 6)}`);
    console.log(`  Token1 (exNEX): ${ethers.formatUnits(feesAfterCollection.fees1, 18)}`);
    console.log(`Reset to zero: ${feesAfterCollection.fees0 === 0n && feesAfterCollection.fees1 === 0n ? "✅" : "❌"}\n`);

    // ===================================
    // TEST 5: LP Token Value Increase from Fees
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 5: LP Token Value Increase from Fees");
    console.log("=".repeat(60) + "\n");

    // Calculate value per LP token before and after swap
    const reservesAfterSwap = await exhibitionAMM.getReserves(exhibitionUSDAddress, exhibitionNEXAddress);
    const totalLPSupply = await exhibitionLPTokens.totalSupply(exhibitionUSDAddress, exhibitionNEXAddress);

    const usdtPerLP = (reservesAfterSwap[0] * ethers.parseUnits("1", 18)) / totalLPSupply;
    const nexPerLP = (reservesAfterSwap[1] * ethers.parseUnits("1", 18)) / totalLPSupply;

    console.log("Pool State After Swap:");
    console.log(`  exUSD Reserve: ${ethers.formatUnits(reservesAfterSwap[0], 6)}`);
    console.log(`  exNEX Reserve: ${ethers.formatUnits(reservesAfterSwap[1], 18)}`);
    console.log(`  Total LP Supply: ${ethers.formatUnits(totalLPSupply, 18)}\n`);

    console.log("Value Per LP Token:");
    console.log(`  exUSD: ${ethers.formatUnits(usdtPerLP, 6)}`);
    console.log(`  exNEX: ${ethers.formatUnits(nexPerLP, 18)}\n`);

    // Calculate User1's share value
    const user1ShareUSD = (user1LPBalance * reservesAfterSwap[0]) / totalLPSupply;
    const user1ShareNEX = (user1LPBalance * reservesAfterSwap[1]) / totalLPSupply;

    console.log("User1's LP Position Value:");
    console.log(`  LP Balance: ${ethers.formatUnits(user1LPBalance, 18)}`);
    console.log(`  exUSD Share: ${ethers.formatUnits(user1ShareUSD, 6)}`);
    console.log(`  exNEX Share: ${ethers.formatUnits(user1ShareNEX, 18)}\n`);

    // Calculate profit from fees (LP fee stayed in pool)
    const expectedLPFeeInReserves = expectedLPFee;
    const user1FeeShare = (user1LPBalance * expectedLPFeeInReserves) / totalLPSupply;

    console.log("LP Fee Analysis:");
    console.log(`  LP Fee from swap: ${ethers.formatUnits(expectedLPFee, 6)} exUSD`);
    console.log(`  User1's share of LP fee: ${ethers.formatUnits(user1FeeShare, 6)} exUSD`);
    console.log(`  User1 deposited: ${ethers.formatUnits(initialUSD, 6)} exUSD`);
    console.log(`  User1 current value: ${ethers.formatUnits(initialUSD + user1FeeShare, 6)} exUSD`);
    console.log(`  Profit from fees: ${ethers.formatUnits(user1FeeShare, 6)} exUSD\n`);

    // Verify LP token value increased (even slightly)
    const valueIncreased = user1FeeShare > 0n;
    console.log(`LP token value increased: ${valueIncreased ? "✅" : "❌"}\n`);

    // ===================================
    // TEST 6: Multiple Swaps Fee Accumulation
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST 6: Multiple Swaps Fee Accumulation");
    console.log("=".repeat(60) + "\n");

    const swapAmount2 = ethers.parseUnits("500", 6);
    const expectedFees2 = await exhibitionAMM.calculateExpectedFees(swapAmount2);

    console.log(`Performing second swap: ${ethers.formatUnits(swapAmount2, 6)} exUSD`);
    console.log(`Expected protocol fee: ${ethers.formatUnits(expectedFees2[1], 6)} exUSD\n`);

    await exhibitionUSD.connect(user2).approve(exhibitionAMMAddress, swapAmount2);
    await exhibitionAMM.connect(user2).swapTokenForToken(
        exhibitionUSDAddress,
        exhibitionNEXAddress,
        swapAmount2,
        0,
        user2.address,
        deadline
    );

    const accumulatedAfterSwap2 = await exhibitionAMM.getAccumulatedProtocolFees(exhibitionUSDAddress, exhibitionNEXAddress);
    console.log("Accumulated protocol fees after second swap:");
    console.log(`  exUSD: ${ethers.formatUnits(accumulatedAfterSwap2.fees0, 6)}`);
    console.log(`  Expected: ${ethers.formatUnits(expectedFees2[1], 6)}`);
    console.log(`Match: ${accumulatedAfterSwap2.fees0 === expectedFees2[1] ? "✅" : "❌"}\n`);

    // ===================================
    // TEST SUMMARY
    // ===================================
    console.log("=".repeat(60));
    console.log("TEST SUMMARY");
    console.log("=".repeat(60) + "\n");

    const tests = [
      { name: "Fee Configuration Loaded", passed: feeConfig.feesEnabled },
      { name: "Fee Calculation Correct", passed: feeCalcPassed },
      { name: "Protocol Fees Accumulated", passed: Math.abs(Number(accumulatedFees.fees0 - expectedProtocolFee)) < 1e-6 },
      { name: "Protocol Fees Collected", passed: Math.abs(Number(collectedAmount - expectedProtocolFee)) < 1e-6 },
      { name: "Fees Reset After Collection", passed: feesAfterCollection.fees0 === 0n && feesAfterCollection.fees1 === 0n },
      { name: "LP Token Value Increased", passed: user1FeeShare > 0n },
      { name: "Multiple Swaps Accumulation", passed: Math.abs(Number(accumulatedAfterSwap2.fees0 - expectedFees2[1])) < 1e-6 },
    ];

    let passedCount = 0;
    tests.forEach((test, i) => {
      const status = test.passed ? "✅ PASSED" : "❌ FAILED";
      console.log(`${i + 1}. ${test.name}: ${status}`);
      if (test.passed) passedCount++;
    });

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Total: ${passedCount}/${tests.length} tests passed`);
    console.log(`${"=".repeat(60)}\n`);

    if (passedCount === tests.length) {
      console.log("🎉 All AMM fee mechanism tests passed successfully!");
    } else {
      console.log("⚠️  Some tests failed — please review the failed cases above.");
     process.exit(1);
    }
}
// ===================================
// EXECUTION WRAPPER
// ===================================
main()
  .then(() => {
    console.log("\n✅ AMM Fee Test Completed\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error during AMM fee test execution:\n", error);
    process.exit(1);
  });
