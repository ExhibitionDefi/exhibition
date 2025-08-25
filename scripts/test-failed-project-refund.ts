import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { TransactionReceipt } from "ethers";
import { Exhibition, ExhibitionUSDT } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

async function main() {
    console.log("Starting local Project 2 (exUSDT Contribution, Failed Softcap, Refunds, WithdrawUnsoldTokens) testing script...");

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
    const exUSDTAddress = deployedAddresses.ExhibitionUSDT as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`ExhibitionUSDT: ${exUSDTAddress}`);
    console.log(`Exhibition: ${exhibitionAddress}`);

    // Get contract instances
    const exUSDT: ExhibitionUSDT = await ethers.getContractAt("ExhibitionUSDT", exUSDTAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const minStartDelay = await exhibition.MIN_START_DELAY();
    const maxProjectDuration = await exhibition.MAX_PROJECT_DURATION();
    let projectTokenContractAFT: IERC20Metadata;

    // Helper to log balances
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer exUSDT: ${ethers.formatUnits(await exUSDT.balanceOf(deployer.address), 6)}`);
        console.log(`User1 exUSDT: ${ethers.formatUnits(await exUSDT.balanceOf(user1.address), 6)}`);
        console.log(`User2 exUSDT: ${ethers.formatUnits(await exUSDT.balanceOf(user2.address), 6)}`);
        console.log(`User3 exUSDT: ${ethers.formatUnits(await exUSDT.balanceOf(user3.address), 6)}`);
        console.log(`Exhibition Contract exUSDT Balance: ${ethers.formatUnits(await exUSDT.balanceOf(exhibitionAddress), 6)}`);
        if (projectTokenContractAFT) {
            console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
            console.log(`Exhibition Contract AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
        } else {
            console.log(`Deployer AFT Balance: N/A (Project Token not yet deployed)`);
            console.log(`Exhibition Contract AFT Balance: N/A (Project Token not yet deployed)`);
        }
    };

    // Helper to advance time
    const advanceTime = async (seconds: number) => {
        console.log(`\nAdvancing time by ${seconds} seconds...`);
        await network.provider.send("evm_increaseTime", [seconds]);
        await network.provider.send("evm_mine");
        const newTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
        console.log(`New block timestamp: ${newTimestamp}`);
    };

    // Faucet requests
    //console.log("\n--- Requesting Faucet Tokens for Users ---");
    //await exhibition.connect(user1).requestFaucetTokens();
    //await exhibition.connect(user2).requestFaucetTokens();
    //await exhibition.connect(user3).requestFaucetTokens();
    //await logBalances("After Faucet Requests for Project 2");

    // Launchpad Project Creation (Project 2: exUSDT, Failed Softcap)
    console.log("\n--- Launchpad Project Creation Test (Project 2: exUSDT, Failed Softcap) ---");
    const projectTokenName2 = "AFTToken";
    const projectTokenSymbol2 = "AFT";
    const initialTotalSupply2 = ethers.parseUnits("1000000", 18); // 1M AFT
    const projectTokenLogoURI2 = "https://launchpad.com/aft_logo.png";
    const contributionTokenAddress2 = exUSDTAddress; // exUSDT
    const amountTokensForSale2 = ethers.parseUnits("800000", 18); // 800,000 AFT
    const tokenPrice2 = ethers.parseUnits("0.01", 18); // 1 AFT = 0.01 exUSDT (1 exUSDT = 100 AFT)
    const fundingGoal2 = ethers.parseUnits("8000", 6); // Hardcap: 8,000 exUSDT
    const softCap2 = ethers.parseUnits("4000", 6); // Softcap: 4,000 exUSDT (50% of funding goal)
    const minContribution2 = ethers.parseUnits("100", 6);
    const maxContribution2 = ethers.parseUnits("2000", 6);
    const currentTimestamp2 = BigInt((await ethers.provider.getBlock("latest"))?.timestamp || Math.floor(Date.now() / 1000));
    const startTime2 = currentTimestamp2 + minStartDelay + 100n;
    const endTime2 = startTime2 + maxProjectDuration;
    const liquidityPercentage2 = 7700n; // 77% (not used due to failure)
    const lockDuration2 = 365n * 24n * 60n * 60n; // 1 year (not used)
    const vestingEnabled2 = false; // No vesting for failed project
     

    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${tokenPrice2.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(tokenPrice2, 18)} exUSDT per AFT`);
    console.log(`Expected: 1 AFT costs 0.01 exUSDT`);
    console.log(`Expected: 100 AFT for 1 exUSDT`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale2, 18)} AFT`);
    console.log(`Max raise at full sale: ${ethers.formatUnits((amountTokensForSale2 * tokenPrice2) / ethers.parseUnits("1", 18), 18)} exUSDT`);

    // Approve exUSDT as contribution token
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(contributionTokenAddress2);
        console.log(`exUSDT (${contributionTokenAddress2}) added as approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add exUSDT: ${e.message}`);
        } else {
            console.log("exUSDT is already an approved contribution token.");
        }
    }

    // Create project
    console.log("Calling createLaunchpadProject for Project 2...");
    const createProjectTxResponse2 = await exhibition.connect(deployer).createLaunchpadProject(
        projectTokenName2,
        projectTokenSymbol2,
        initialTotalSupply2,
        projectTokenLogoURI2,
        contributionTokenAddress2,
        fundingGoal2,
        softCap2,
        minContribution2,
        maxContribution2,
        tokenPrice2,
        startTime2,
        endTime2,
        amountTokensForSale2,
        liquidityPercentage2,
        lockDuration2,
        vestingEnabled2,
        0n, 0n, 0n, 0n // No vesting
    );
    const createProjectReceipt2: TransactionReceipt | null = await createProjectTxResponse2.wait();
    let newProjectId2: bigint | undefined;
    let newProjectTokenAddress2: string | undefined;
    if (createProjectReceipt2 && createProjectReceipt2.logs) {
        for (const log of createProjectReceipt2.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "ProjectCreated") {
                    newProjectId2 = parsedLog.args.projectId;
                    newProjectTokenAddress2 = parsedLog.args.projectToken;
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed
            }
        }
    }
    if (!newProjectId2 || !newProjectTokenAddress2) {
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken for Project 2.");
        process.exit(1);
    }
    console.log(`Successfully created Project 2 with ID: ${newProjectId2}`);
    console.log(`New AFT Token Address: ${newProjectTokenAddress2}`);

    projectTokenContractAFT = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress2, deployer);
    await logBalances("After Project 2 Creation");

    // Deposit tokens for sale
    console.log(`\nDeployer approving Exhibition to spend ${ethers.formatUnits(amountTokensForSale2, 18)} AFT...`);
    await projectTokenContractAFT.connect(deployer).approve(exhibitionAddress, amountTokensForSale2);
    console.log("SUCCESS: Deployer approved Exhibition for AFT tokens.");
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId2} with ${ethers.formatUnits(amountTokensForSale2, 18)} AFT...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId2, amountTokensForSale2);
    console.log("SUCCESS: Tokens for sale deposited and Project 2 activated.");
    await logBalances("After Tokens for Sale Deposit");

    // Contributions (below softcap: 3,500 exUSDT)
    console.log("\n--- Contributions for Project 2 (Below Softcap) ---");
    const user1Contribute2 = ethers.parseUnits("1000", 6); // 1,000 exUSDT
    const user2Contribute2 = ethers.parseUnits("1200", 6); // 1,200 exUSDT
    const user3Contribute2 = ethers.parseUnits("1300", 6); // 1,300 exUSDT
    const totalExpectedRaised2 = user1Contribute2 + user2Contribute2 + user3Contribute2; // 3,500 exUSDT

    const projectToAdvance2 = await exhibition.projects(newProjectId2);
    const projectStartTime2 = Number(projectToAdvance2.startTime);
    const currentBlockTimestamp2 = Number(await time.latest());
    let timeToAdvanceForContribution2 = 0;
    if (currentBlockTimestamp2 < projectStartTime2) {
        timeToAdvanceForContribution2 = projectStartTime2 - currentBlockTimestamp2 + 10;
        await advanceTime(timeToAdvanceForContribution2);
        console.log(`Advanced time by ${timeToAdvanceForContribution2} seconds for Project 2.`);
    } else {
        console.log("Project 2 is already open for contributions.");
    }

    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute2, 6)} exUSDT to Project ID ${newProjectId2}...`);
    await exUSDT.connect(user1).approve(exhibitionAddress, user1Contribute2);
    await exhibition.connect(user1).contribute(newProjectId2, user1Contribute2);
    console.log("SUCCESS: User1 contributed.");

    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute2, 6)} exUSDT to Project ID ${newProjectId2}...`);
    await exUSDT.connect(user2).approve(exhibitionAddress, user2Contribute2);
    await exhibition.connect(user2).contribute(newProjectId2, user2Contribute2);
    console.log("SUCCESS: User2 contributed.");

    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute2, 6)} exUSDT to Project ID ${newProjectId2}...`);
    await exUSDT.connect(user3).approve(exhibitionAddress, user3Contribute2);
    await exhibition.connect(user3).contribute(newProjectId2, user3Contribute2);
    console.log("SUCCESS: User3 contributed.");

    await logBalances("After Contributions for Project 2");
    const projectAfterContributions2 = await exhibition.projects(newProjectId2);
    console.log(`Project 2 Total Raised: ${ethers.formatUnits(projectAfterContributions2.totalRaised, 6)} exUSDT (Expected: ${ethers.formatUnits(totalExpectedRaised2, 6)})`);
    console.log(`Project 2 Status: ${projectAfterContributions2.status} (Expected: Active (1))`);
    if (projectAfterContributions2.totalRaised !== totalExpectedRaised2) {
        console.error(`Assertion Failed: Total raised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised2, 6)}, got ${ethers.formatUnits(projectAfterContributions2.totalRaised, 6)}.`);
        process.exit(1);
    }
    if (projectAfterContributions2.status !== 1n) {
        console.error("Assertion Failed: Project 2 status should be Active (1).");
        process.exit(1);
    }
    console.log("SUCCESS: Project 2 contributions verified.");

    // Log tokens allocated before refunds
    console.log("\n--- Pre-Refund Token Allocation ---");
    const preRefundTotalRaised = projectAfterContributions2.totalRaised;
    const contributionIn18Decimal = preRefundTotalRaised * (10n ** 12n);
    const preRefundTokensAllocated = (contributionIn18Decimal * ethers.parseUnits("1", 18)) / tokenPrice2;
    console.log(`Pre-Refund Total Raised: ${ethers.formatUnits(preRefundTotalRaised, 6)} exUSDT`);
    console.log(`Pre-Refund Tokens Allocated: ${ethers.formatUnits(preRefundTokensAllocated, 18)} AFT`);

    // Finalize Project (Failed)
    console.log("\n--- Finalize Project 2 (Failed Softcap) ---");
    const timeNeededToAdvance2 = Number(projectAfterContributions2.endTime) - Number(await time.latest()) + 10;
    if (timeNeededToAdvance2 > 0) {
        await advanceTime(timeNeededToAdvance2);
        console.log(`Advanced time past end time for Project ID ${newProjectId2}.`);
    } else {
        console.log(`Project ID ${newProjectId2} end time is already in the past.`);
    }

    console.log(`Calling finalizeProject for Project ID ${newProjectId2}...`);
    await exhibition.connect(deployer).finalizeProject(newProjectId2);
    const projectFinalized2 = await exhibition.projects(newProjectId2);
    console.log(`Project ID ${newProjectId2} final status: ${projectFinalized2.status} (Expected: Failed (4))`);
    if (projectFinalized2.status !== 4n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Failed (4), got ${projectFinalized2.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Project 2 finalization to Failed verified.");

    // Refunds
    console.log("\n--- Refund Contributions for Project 2 ---");
    const user1BalanceBeforeRefund = await exUSDT.balanceOf(user1.address);
    const user2BalanceBeforeRefund = await exUSDT.balanceOf(user2.address);
    const user3BalanceBeforeRefund = await exUSDT.balanceOf(user3.address);
    const contractBalanceBeforeRefund = await exUSDT.balanceOf(exhibitionAddress);

    console.log(`\nUser1 refunding ${ethers.formatUnits(user1Contribute2, 6)} exUSDT...`);
    await exhibition.connect(user1).requestRefund(newProjectId2);
    console.log(`User2 refunding ${ethers.formatUnits(user2Contribute2, 6)} exUSDT...`);
    await exhibition.connect(user2).requestRefund(newProjectId2);
    console.log(`User3 refunding ${ethers.formatUnits(user3Contribute2, 6)} exUSDT...`);
    await exhibition.connect(user3).requestRefund(newProjectId2);

    const user1BalanceAfterRefund = await exUSDT.balanceOf(user1.address);
    const user2BalanceAfterRefund = await exUSDT.balanceOf(user2.address);
    const user3BalanceAfterRefund = await exUSDT.balanceOf(user3.address);
    const contractBalanceAfterRefund = await exUSDT.balanceOf(exhibitionAddress);
    const projectAfterRefunds = await exhibition.projects(newProjectId2);

    console.log("\n--- Balances After Refunds ---");
    console.log(`User1 exUSDT: ${ethers.formatUnits(user1BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user1BalanceAfterRefund - user1BalanceBeforeRefund, 6)})`);
    console.log(`User2 exUSDT: ${ethers.formatUnits(user2BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user2BalanceAfterRefund - user2BalanceBeforeRefund, 6)})`);
    console.log(`User3 exUSDT: ${ethers.formatUnits(user3BalanceAfterRefund, 6)} (Increase: ${ethers.formatUnits(user3BalanceAfterRefund - user3BalanceBeforeRefund, 6)})`);
    console.log(`Exhibition Contract exUSDT: ${ethers.formatUnits(contractBalanceAfterRefund, 6)}`);

    if (user1BalanceAfterRefund - user1BalanceBeforeRefund !== user1Contribute2) {
        console.error(`Assertion Failed: User1 refund incorrect. Expected ${ethers.formatUnits(user1Contribute2, 6)}, got ${ethers.formatUnits(user1BalanceAfterRefund - user1BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (user2BalanceAfterRefund - user2BalanceBeforeRefund !== user2Contribute2) {
        console.error(`Assertion Failed: User2 refund incorrect. Expected ${ethers.formatUnits(user2Contribute2, 6)}, got ${ethers.formatUnits(user2BalanceAfterRefund - user2BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (user3BalanceAfterRefund - user3BalanceBeforeRefund !== user3Contribute2) {
        console.error(`Assertion Failed: User3 refund incorrect. Expected ${ethers.formatUnits(user3Contribute2, 6)}, got ${ethers.formatUnits(user3BalanceAfterRefund - user3BalanceBeforeRefund, 6)}.`);
        process.exit(1);
    }
    if (contractBalanceAfterRefund !== 0n) {
        console.error(`Assertion Failed: Contract exUSDT balance not zero. Got ${ethers.formatUnits(contractBalanceAfterRefund, 6)}.`);
        process.exit(1);
    }
    console.log(`Project 2 Status: ${projectAfterRefunds.status} (Expected: Refundable (6))`);
    if (projectAfterRefunds.status !== 6n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Refundable (6), got ${projectAfterRefunds.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Refunds for Project 2 verified.");

    // Withdraw Unsold Tokens
    console.log("\n--- Withdraw Unsold Tokens for Project 2 ---");
    const timelockEnd2 = Number(projectAfterRefunds.endTime) + 86400; // endTime + 1 day
    const currentTime = Number(await time.latest());
    const timeToTimelockEnd = timelockEnd2 - currentTime + 10;
    if (timeToTimelockEnd > 0) {
        await advanceTime(timeToTimelockEnd);
        console.log("Advanced time past timelock for Project 2.");
    }

    console.log("Deployer withdrawing unsold tokens for Project 2...");
    const deployerBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectBeforeWithdraw = await exhibition.projects(newProjectId2);

    // Use proper calculation logic that matches TokenCalculationLib
    const totalRaisedBigInt = projectBeforeWithdraw.totalRaised;
    const tokenPriceBigInt = projectBeforeWithdraw.tokenPrice;

    // Get token decimals
    const contributionDecimals = 6; // exUSDT has 6 decimals
    const projectDecimals = 18; // AFT has 18 decimals

    // Calculate tokens allocated using the same logic as TokenCalculationLib
    // Step 1: Scale contribution amount to 18 decimals
    // For 6-decimal exUSDT: multiply by 10^(18-6) = 10^12
    const contributionIn18Decimals = totalRaisedBigInt * (10n ** 12n);

    // Step 2: Calculate tokens in 18 decimals using the formula from the library
    // tokensIn18Decimals = (contributionIn18Decimals * 1e18) / tokenPrice
    const tokensIn18Decimals = (contributionIn18Decimals * ethers.parseUnits("1", 18)) / tokenPriceBigInt;

    // Step 3: Scale to project token decimals (already 18 for AFT, so no change)
    const tokensAllocatedBigInt = tokensIn18Decimals;

    // Update unsoldTokensBigInt to use amountTokensForSale for status = 6
    let unsoldTokensBigInt = amountTokensForSale2; // Default for Refundable status
    if (projectBeforeWithdraw.status !== 6n) {
        unsoldTokensBigInt = amountTokensForSale2 - tokensAllocatedBigInt;
    }

    console.log("\n--- DEBUG: WithdrawUnsoldTokens Calculation ---");
    console.log(`Total Raised: ${ethers.formatUnits(totalRaisedBigInt, 6)} exUSDT`);
    console.log(`Token Price: ${ethers.formatUnits(tokenPriceBigInt, 18)} exUSDT per AFT`);
    console.log(`Contribution in 18 decimal : ${ethers.formatUnits(contributionIn18Decimals, 18)}`);
    console.log(`Tokens Allocated: ${ethers.formatUnits(tokensAllocatedBigInt, 18)} AFT`);
    console.log(`Amount Tokens For Sale: ${ethers.formatUnits(amountTokensForSale2, 18)} AFT`);
    console.log(`Unsold Tokens: ${ethers.formatUnits(unsoldTokensBigInt, 18)} AFT`);

    const withdrawTx = await exhibition.connect(deployer).withdrawUnsoldTokens(newProjectId2);
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
        console.error("ERROR: Could not find UnsoldTokensWithdrawn event for Project 2.");
        process.exit(1);
    }

    const deployerBalanceAfterWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceAfterWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectAfterWithdraw = await exhibition.projects(newProjectId2);

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
        if (projectBeforeWithdraw.status === 6n && withdrawAmount === amountTokensForSale2) {
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
    console.log("SUCCESS: WithdrawUnsoldTokens for Project 2 verified.");

    console.log("\nProject 2 (exUSDT Contribution, Failed Softcap, Refunds, WithdrawUnsoldTokens) testing script finished successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});