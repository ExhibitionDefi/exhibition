import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TransactionReceipt } from "ethers";
import { Exhibition, NexusUSD } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

async function main() {
    console.log("Starting local Project 2 (USDX Contribution, Failed Softcap, Refunds, WithdrawUnsoldTokens) testing script...");

    // Get signers
    const [deployer, user1, user2, user3] = await ethers.getSigners();
    console.log(`Testing with Deployer account: ${deployer.address}`);
    console.log(`Testing with User1 account: ${user1.address}`);
    console.log(`Testing with User2 account: ${user2.address}`);
    console.log(`Testing with User3 account: ${user3.address}`);

    // Load deployed addresses
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const USDXAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`NexusUSD: ${USDXAddress}`);
    console.log(`Exhibition: ${exhibitionAddress}`);

    // Get contract instances
    const USDX: NexusUSD = await ethers.getContractAt("NexusUSD", USDXAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();
    let projectTokenContractAFT: IERC20Metadata;

    // Helper to log balances
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await USDX.balanceOf(deployer.address), 6)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await USDX.balanceOf(user1.address), 6)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await USDX.balanceOf(user2.address), 6)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await USDX.balanceOf(user3.address), 6)}`);
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await USDX.balanceOf(exhibitionAddress), 6)}`);
        if (projectTokenContractAFT) {
            console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
            console.log(`Exhibition Contract AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
        } else {
            console.log(`Deployer AFT Balance: N/A (Project Token not yet deployed)`);
            console.log(`Exhibition Contract AFT Balance: N/A (Project Token not yet deployed)`);
        }
    };

    // --- Helper to advance blocks ---
    const advanceBlocks = async (blocks: number) => {
       const blocksHex = `0x${blocks.toString(16)}`;
       console.log(`\nAdvancing network by ${blocks} blocks...`);
       await network.provider.send("hardhat_mine", [blocksHex]);
       const newBlockNumber = await ethers.provider.getBlockNumber();
       console.log(`New block number: ${newBlockNumber}`);
    };

    // Launchpad Project Creation (Project: USDX, Failed Softcap)
    console.log("\n--- Launchpad Project Creation Test (Project: USDX, Failed Softcap) ---");
    const projectTokenName = "AFTToken";
    const projectTokenSymbol = "AFT";
    const initialTotalSupply = ethers.parseUnits("1600000", 18); // 1.6M AFT
    const projectTokenLogoURI = "https://launchpad.com/aft_logo.png";
    const contributionTokenAddress = USDXAddress; // USDX
    const amountTokensForSale = ethers.parseUnits("800000", 18); // 800,000 AFT
    const tokenPrice = ethers.parseUnits("0.01", 18); // 1 AFT = 0.01 USDX (1 USDX = 100 AFT)
    const fundingGoal = ethers.parseUnits("8000", 6); // Hardcap: 8,000 USDX
    const softCap = ethers.parseUnits("4080", 6); // Softcap: 4,080 USDX (50% of funding goal)
    const minContribution = ethers.parseUnits("100", 6);
    const maxContribution = ethers.parseUnits("2000", 6);
    const currentBlockNumber = BigInt(await ethers.provider.getBlockNumber());
    const startBlock = currentBlockNumber + minStartDelay + 100n;
    const endBlock = startBlock + maxProjectDuration;
    const liquidityPercentage = 7700n;
    const lockDurationBlocks = 31536000n;
    const vestingEnabled = false;
     

    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${tokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(tokenPrice, 18)} USDX per AFT`);
    console.log(`Expected: 1 AFT costs 0.01 USDX`);
    console.log(`Expected: 100 AFT for 1 USDX`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} AFT`);
    console.log(`Max raise at full sale: ${ethers.formatUnits((amountTokensForSale * tokenPrice) / ethers.parseUnits("1", 18), 18)} USDX`);

    // Approve USDX as contribution token
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(contributionTokenAddress);
        console.log(`USDX (${contributionTokenAddress}) added as approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add USDX: ${e.message}`);
        } else {
            console.log("USDX is already an approved contribution token.");
        }
    }

    // Create project
    console.log("Calling createLaunchpadProject for Project 2...");
    const createProjectTxResponse2 = await exhibition.connect(deployer).createLaunchpadProject(
        projectTokenName,
        projectTokenSymbol,
        initialTotalSupply,
        projectTokenLogoURI,
        contributionTokenAddress,
        fundingGoal,
        softCap,
        minContribution,
        maxContribution,
        tokenPrice,
        startBlock,
        endBlock,
        amountTokensForSale,
        liquidityPercentage,
        lockDurationBlocks,
        vestingEnabled,
        0n, 0n, 0n, 0n // No vesting
    );
    const createProjectReceipt2: TransactionReceipt | null = await createProjectTxResponse2.wait();
    let newProjectId: bigint | undefined;
    let newProjectTokenAddress: string | undefined;
    if (createProjectReceipt2 && createProjectReceipt2.logs) {
        for (const log of createProjectReceipt2.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "ProjectCreated") {
                    newProjectId = parsedLog.args.projectId;
                    newProjectTokenAddress = parsedLog.args.projectToken;
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed
            }
        }
    }
    if (!newProjectId || !newProjectTokenAddress) {
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken for Project.");
        process.exit(1);
    }
    console.log(`Successfully created Project with ID: ${newProjectId}`);
    console.log(`New AFT Token Address: ${newProjectTokenAddress}`);

    projectTokenContractAFT = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer);
    await logBalances("After Project Creation");

    // Deposit tokens for sale
    console.log(`\nDeployer approving Exhibition to spend ${ethers.formatUnits(amountTokensForSale, 18)} AFT...`);
    await projectTokenContractAFT.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("SUCCESS: Deployer approved Exhibition for AFT tokens.");
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} AFT...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("SUCCESS: Tokens for sale deposited and Project activated.");
    await logBalances("After Tokens for Sale Deposit");

    // Contributions (below softcap: 3,500 USDX)
    console.log("\n--- Contributions for Project (Below Softcap) ---");
    const user1Contribute = ethers.parseUnits("1000", 6); // 1,000 USDX
    const user2Contribute = ethers.parseUnits("1200", 6); // 1,200 USDX
    const user3Contribute = ethers.parseUnits("1300", 6); // 1,300 USDX
    const totalExpectedRaised = user1Contribute + user2Contribute + user3Contribute; // 3,500 USDX

    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectstartBlock = Number(projectToAdvance.startBlock);
    const currentBlock = Number(await ethers.provider.getBlockNumber());
    let blockToAdvanceForContribution = 0;
    if (currentBlock < projectstartBlock) {
        blockToAdvanceForContribution = projectstartBlock - currentBlock + 10;
        await advanceBlocks(blockToAdvanceForContribution);
        console.log(`Advanced time by ${blockToAdvanceForContribution} seconds for Project.`);
    } else {
        console.log("Project is already open for contributions.");
    }

    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await USDX.connect(user1).approve(exhibitionAddress, user1Contribute);
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);
    console.log("SUCCESS: User1 contributed.");

    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await USDX.connect(user2).approve(exhibitionAddress, user2Contribute);
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);
    console.log("SUCCESS: User2 contributed.");

    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await USDX.connect(user3).approve(exhibitionAddress, user3Contribute);
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);
    console.log("SUCCESS: User3 contributed.");

    await logBalances("After Contributions for Project");
    const projectAfterContributions = await exhibition.projects(newProjectId);
    console.log(`Project Total Raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)} USDX (Expected: ${ethers.formatUnits(totalExpectedRaised, 6)})`);
    console.log(`Project Status: ${projectAfterContributions.status} (Expected: Active (1))`);
    if (projectAfterContributions.totalRaised !== totalExpectedRaised) {
        console.error(`Assertion Failed: Total raised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised, 6)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)}.`);
        process.exit(1);
    }
    if (projectAfterContributions.status !== 1n) {
        console.error("Assertion Failed: Project status should be Active (1).");
        process.exit(1);
    }
    console.log("SUCCESS: Project contributions verified.");

    // Log tokens allocated before refunds
    console.log("\n--- Pre-Refund Token Allocation ---");
    const preRefundTotalRaised = projectAfterContributions.totalRaised;
    const contributionIn18Decimal = preRefundTotalRaised * (10n ** 12n);
    const preRefundTokensAllocated = (contributionIn18Decimal * ethers.parseUnits("1", 18)) / tokenPrice;
    console.log(`Pre-Refund Total Raised: ${ethers.formatUnits(preRefundTotalRaised, 6)} USDX`);
    console.log(`Pre-Refund Tokens Allocated: ${ethers.formatUnits(preRefundTokensAllocated, 18)} AFT`);

    // Finalize Project (Failed)
    console.log("\n--- Finalize Project (Failed Softcap) ---");
    const currentBlockForFinalize = Number(await ethers.provider.getBlockNumber());
    const blockNeededToAdvance = Number(projectAfterContributions.endBlock) - currentBlockForFinalize + 10;
    if (blockNeededToAdvance > 0) {
        await advanceBlocks(blockNeededToAdvance);
        console.log(`Advanced blocks past end time for Project ID ${newProjectId}.`);
    } else {
        console.log(`Project ID ${newProjectId} end time is already in the past.`);
    }

    console.log(`Calling finalizeProject for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).finalizeProject(newProjectId);
    const projectFinalized = await exhibition.projects(newProjectId);
    console.log(`Project ID ${newProjectId} final status: ${projectFinalized.status} (Expected: Failed (3))`);
    if (projectFinalized.status !== 3n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Failed (3), got ${projectFinalized.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Project finalization to Failed verified.");

    // Refunds
    console.log("\n--- Refund Contributions for Project ---");
    const user1BalanceBeforeRefund = await USDX.balanceOf(user1.address);
    const user2BalanceBeforeRefund = await USDX.balanceOf(user2.address);
    const user3BalanceBeforeRefund = await USDX.balanceOf(user3.address);
    const contractBalanceBeforeRefund = await USDX.balanceOf(exhibitionAddress);

    console.log(`\nUser1 refunding ${ethers.formatUnits(user1Contribute, 6)} USDX...`);
    await exhibition.connect(user1).requestRefund(newProjectId);
    console.log(`User2 refunding ${ethers.formatUnits(user2Contribute, 6)} USDX...`);
    await exhibition.connect(user2).requestRefund(newProjectId);
    console.log(`User3 refunding ${ethers.formatUnits(user3Contribute, 6)} USDX...`);
    await exhibition.connect(user3).requestRefund(newProjectId);

    const user1BalanceAfterRefund = await USDX.balanceOf(user1.address);
    const user2BalanceAfterRefund = await USDX.balanceOf(user2.address);
    const user3BalanceAfterRefund = await USDX.balanceOf(user3.address);
    const contractBalanceAfterRefund = await USDX.balanceOf(exhibitionAddress);
    const projectAfterRefunds = await exhibition.projects(newProjectId);

    console.log("\n--- Balances After Refunds ---");
    console.log(`User1 USDX: ${ethers.formatUnits(user1BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user1BalanceAfterRefund - user1BalanceBeforeRefund, 6)})`);
    console.log(`User2 USDX: ${ethers.formatUnits(user2BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user2BalanceAfterRefund - user2BalanceBeforeRefund, 6)})`);
    console.log(`User3 USDX: ${ethers.formatUnits(user3BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user3BalanceAfterRefund - user3BalanceBeforeRefund, 6)})`);
    console.log(`Exhibition Contract USDX: ${ethers.formatUnits(contractBalanceAfterRefund, 6)}`);

    if (user1BalanceAfterRefund - user1BalanceBeforeRefund !== user1Contribute) {
        console.error(`Assertion Failed: User1 refund incorrect. Expected ${ethers.formatUnits(user1Contribute, 6)}, got ${ethers.formatUnits(user1BalanceAfterRefund - user1BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (user2BalanceAfterRefund - user2BalanceBeforeRefund !== user2Contribute) {
        console.error(`Assertion Failed: User2 refund incorrect. Expected ${ethers.formatUnits(user2Contribute, 6)}, got ${ethers.formatUnits(user2BalanceAfterRefund - user2BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (user3BalanceAfterRefund - user3BalanceBeforeRefund !== user3Contribute) {
        console.error(`Assertion Failed: User3 refund incorrect. Expected ${ethers.formatUnits(user3Contribute, 6)}, got ${ethers.formatUnits(user3BalanceAfterRefund - user3BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (contractBalanceAfterRefund !== 0n) {
        console.error(`Assertion Failed: Contract USDX balance not zero. Got ${ethers.formatUnits(contractBalanceAfterRefund, 6)}.`);
        process.exit(1);
    }
    console.log(`Project Status: ${projectAfterRefunds.status} (Expected: Refundable (5))`);
    if (projectAfterRefunds.status !== 5n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Refundable (5), got ${projectAfterRefunds.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Refunds for Project verified.");

    // Withdraw Unsold Tokens
    console.log("\n--- Withdraw Unsold Tokens for Project ---");
    const blocklockEnd = Number(projectAfterRefunds.endBlock) + 172800;
    const currentBlockToEnd = Number(await ethers.provider.getBlockNumber());
    const blockToTimelockEnd = blocklockEnd - currentBlockToEnd + 10;
    if (blockToTimelockEnd > 0) {
        await advanceBlocks(blockToTimelockEnd);
        console.log("Advanced block past timelock for Project.");
    }

    console.log("Deployer withdrawing unsold tokens for Project...");
    const deployerBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectBeforeWithdraw = await exhibition.projects(newProjectId);

    // Use proper calculation logic that matches TokenCalculationLib
    const totalRaisedBigInt = projectBeforeWithdraw.totalRaised;
    const tokenPriceBigInt = projectBeforeWithdraw.tokenPrice;

    // Calculate tokens allocated using the same logic as TokenCalculationLib
    // Step 1: Scale contribution amount to 18 decimals
    // For 6-decimal USDX: multiply by 10^(18-6) = 10^12
    const contributionIn18Decimals = totalRaisedBigInt * (10n ** 12n);

    // Step 2: Calculate tokens in 18 decimals using the formula from the library
    // tokensIn18Decimals = (contributionIn18Decimals * 1e18) / tokenPrice
    const tokensIn18Decimals = (contributionIn18Decimals * ethers.parseUnits("1", 18)) / tokenPriceBigInt;

    // Step 3: Scale to project token decimals (already 18 for AFT, so no change)
    const tokensAllocatedBigInt = tokensIn18Decimals;

    // Update unsoldTokensBigInt to use amountTokensForSale for status = 5
    let unsoldTokensBigInt = amountTokensForSale; // Default for Refundable status
    if (projectBeforeWithdraw.status !== 5n) {
        unsoldTokensBigInt = amountTokensForSale - tokensAllocatedBigInt;
    }

    console.log("\n--- DEBUG: WithdrawUnsoldTokens Calculation ---");
    console.log(`Total Raised: ${ethers.formatUnits(totalRaisedBigInt, 6)} USDX`);
    console.log(`Token Price: ${ethers.formatUnits(tokenPriceBigInt, 18)} USDX per AFT`);
    console.log(`Contribution in 18 decimal : ${ethers.formatUnits(contributionIn18Decimals, 18)}`);
    console.log(`Tokens Allocated: ${ethers.formatUnits(tokensAllocatedBigInt, 18)} AFT`);
    console.log(`Amount Tokens For Sale: ${ethers.formatUnits(amountTokensForSale, 18)} AFT`);
    console.log(`Unsold Tokens: ${ethers.formatUnits(unsoldTokensBigInt, 18)} AFT`);

    const withdrawTx = await exhibition.connect(deployer).withdrawUnsoldTokens(newProjectId);
    const withdrawReceipt: TransactionReceipt | null = await withdrawTx.wait();
    let withdrawAmount: bigint | undefined;
    if (withdrawReceipt && withdrawReceipt.logs) {
        for (const log of withdrawReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "UnsoldTokensWithdrawn") {
                    withdrawAmount = parsedLog.args.amount;
                    console.log(`UnsoldTokensWithdrawn event emitted: Amount ${ethers.formatUnits(withdrawAmount!, 18)} AFT`);
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed
            }
        }
    }
    if (!withdrawAmount) {
        console.error("ERROR: Could not find UnsoldTokensWithdrawn event for Project.");
        process.exit(1);
    }

    const deployerBalanceAfterWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceAfterWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectAfterWithdraw = await exhibition.projects(newProjectId);

    console.log("\n--- Balances After WithdrawUnsoldTokens ---");
    console.log(`Deployer AFT: ${ethers.formatUnits(deployerBalanceAfterWithdraw, 18)} (Increase: ${ethers.formatUnits(deployerBalanceAfterWithdraw - deployerBalanceBeforeWithdraw, 18)})`);
    console.log(`Exhibition Contract AFT: ${ethers.formatUnits(contractBalanceAfterWithdraw, 18)}`);
    console.log(`Project amountTokensForSale: ${ethers.formatUnits(projectAfterWithdraw.amountTokensForSale, 18)}`);
    console.log(`Withdraw Amount from Event: ${ethers.formatUnits(withdrawAmount, 18)} AFT`);

    // Updated assertions with better error messages
    const actualIncrease = deployerBalanceAfterWithdraw - deployerBalanceBeforeWithdraw;
    if (withdrawAmount !== unsoldTokensBigInt) {
        console.error(`Assertion Failed: Withdrawn amount incorrect.`);
        console.error(`  Expected: ${ethers.formatUnits(unsoldTokensBigInt, 18)} AFT`);
        console.error(`  Got: ${ethers.formatUnits(withdrawAmount, 18)} AFT`);
        if (projectBeforeWithdraw.status === 6n && withdrawAmount === amountTokensForSale) {
            console.log("INFO: Contract returned all tokens for sale (failed project behavior).");
            console.log("SUCCESS: WithdrawUnsoldTokens for failed project verified.");
        } else {
            process.exit(1);
        }
    } else {
        console.log("SUCCESS: Calculated unsold tokens match withdrawn amount.");
    }

    if (actualIncrease !== withdrawAmount) {
        console.error(`Assertion Failed: Deployer balance increase doesn't match withdraw amount.`);
        console.error(`  Expected increase: ${ethers.formatUnits(withdrawAmount, 18)} AFT`);
        console.error(`  Actual increase: ${ethers.formatUnits(actualIncrease, 18)} AFT`);
        process.exit(1);
    }
    if (contractBalanceAfterWithdraw !== contractBalanceBeforeWithdraw - withdrawAmount) {
        console.error(`Assertion Failed: Contract AFT balance incorrect.`);
        console.error(`  Expected: ${ethers.formatUnits(contractBalanceBeforeWithdraw - withdrawAmount, 18)} AFT`);
        console.error(`  Got: ${ethers.formatUnits(contractBalanceAfterWithdraw, 18)} AFT`);
        process.exit(1);
    }
    if (projectAfterWithdraw.amountTokensForSale !== 0n) {
        console.error("Assertion Failed: Project amountTokensForSale not reset to 0.");
        process.exit(1);
    }
    console.log("SUCCESS: WithdrawUnsoldTokens for Project verified.");

    console.log("\nProject (USDX Contribution, Failed Softcap, Refunds, WithdrawUnsoldTokens) testing script finished successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});