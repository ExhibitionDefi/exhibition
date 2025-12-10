import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { TransactionReceipt } from "ethers";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";
import { Exhibition, ExhibitionToken, ExhibitionUSD, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";

async function main() {
    console.log("Starting local Project 2 (EXH Contribution, Softcap Met, Refunds, WithdrawUnsoldTokens) testing script...");

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

    const ExhibitionTokenAddress = deployedAddresses.ExhToken as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH: ${ExhibitionTokenAddress}`);
    console.log(`Exhibition: ${exhibitionAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);

    // Get contract instances
    const EXH: ExhibitionToken = await ethers.getContractAt("ExhibitionToken", ExhibitionTokenAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionAMM: ExhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const minStartDelay = await exhibition.MIN_START_DELAY();
    const maxProjectDuration = await exhibition.MAX_PROJECT_DURATION();
    let projectTokenContractAFT: IERC20Metadata;

    // Helper to log balances
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer EXH: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);
        console.log(`User1 EXH: ${ethers.formatUnits(await EXH.balanceOf(user1.address), 18)}`);
        console.log(`User2 EXH: ${ethers.formatUnits(await EXH.balanceOf(user2.address), 18)}`);
        console.log(`User3 EXH: ${ethers.formatUnits(await EXH.balanceOf(user3.address), 18)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
        if (projectTokenContractAFT) {
            console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
            console.log(`Exhibition Contract AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
            console.log(`Exhibition AMM Project Token Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAMMAddress), 18)}`); // New: AMM's Project Token balance
        } else {
            console.log(`Deployer AFT Balance: N/A (Project Token not yet deployed)`);
            console.log(`Exhibition Contract AFT Balance: N/A (Project Token not yet deployed)`);
            console.log(`Exhibition AMM Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
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

    // Launchpad Project Creation (Project 2: EXH, Softcap Met)
    console.log("\n--- Launchpad Project Creation Test (Project 2: EXH, Softcap Met) ---");
    const projectTokenName2 = "AFTToken";
    const projectTokenSymbol2 = "AFT";
    const initialTotalSupply2 = ethers.parseUnits("10000000", 18); // 10M AFT
    const projectTokenLogoURI2 = "https://launchpad.com/aft_logo.png";
    const contributionTokenAddress2 = ExhibitionTokenAddress; // EXH
    const fundingGoal2 = ethers.parseUnits("50000", 18); // Hardcap: 50,000 EXH
    const softCap2 = ethers.parseUnits("25500", 18); // Softcap: 25,500 EXH
    const minContribution2 = ethers.parseUnits("100", 18);
    const maxContribution2 = ethers.parseUnits("15000", 18);
    const tokenPrice2 = ethers.parseUnits("0.01", 18); // 1 AFT = 0.01 EXH (1 EXH = 100 AFT)
    const amountTokensForSale2 = ethers.parseUnits("5000000", 18); // 5,000,000 AFT
    const currentTimestamp2 = BigInt((await ethers.provider.getBlock("latest"))?.timestamp || Math.floor(Date.now() / 1000));
    const startTime2 = currentTimestamp2 + minStartDelay + 100n;
    const endTime2 = startTime2 + maxProjectDuration;
    const liquidityPercentage2 = 7700n; // 77% (not used due to failure)
    const lockDuration2 = 365n * 24n * 60n * 60n; // 1 year (not used)
    const vestingEnabled2 = false; // No vesting for failed project

    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${tokenPrice2.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(tokenPrice2, 18)} EXH per AFT`);
    console.log(`Expected: 1 AFT costs 0.01 EXH`);
    console.log(`Expected: 100 AFT for 1 EXH`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale2, 18)} AFT`);
    console.log(`Max raise at full sale: ${ethers.formatUnits((amountTokensForSale2 * tokenPrice2) / 10n**18n, 18)} EXH`);

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

    // Contributions (Above softcap: 25,500 EXH)
    console.log("\n--- Contributions for Project 2 (Above Softcap) ---");
    const user1Contribute2 = ethers.parseUnits("14901", 18); // 14,901 EXH
    const user2Contribute2 = ethers.parseUnits("10009", 18); // 10009 EXH
    const user3Contribute2 = ethers.parseUnits("5590", 18); // 5590 EXH
    const totalExpectedRaised2 = user1Contribute2 + user2Contribute2 + user3Contribute2; // 30,500 EXH

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

    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute2, 18)} EXH to Project ID ${newProjectId2}...`);
    await EXH.connect(user1).approve(exhibitionAddress, user1Contribute2);
    await exhibition.connect(user1).contribute(newProjectId2, user1Contribute2);
    console.log("SUCCESS: User1 contributed.");

    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute2, 18)} EXH to Project ID ${newProjectId2}...`);
    await EXH.connect(user2).approve(exhibitionAddress, user2Contribute2);
    await exhibition.connect(user2).contribute(newProjectId2, user2Contribute2);
    console.log("SUCCESS: User2 contributed.");

    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute2, 18)} EXH to Project ID ${newProjectId2}...`);
    await EXH.connect(user3).approve(exhibitionAddress, user3Contribute2);
    await exhibition.connect(user3).contribute(newProjectId2, user3Contribute2);
    console.log("SUCCESS: User3 contributed.");

    await logBalances("After Contributions for Project 2");
    const projectAfterContributions2 = await exhibition.projects(newProjectId2);
    console.log(`Project 2 Total Raised: ${ethers.formatUnits(projectAfterContributions2.totalRaised, 18)} EXH (Expected: ${ethers.formatUnits(totalExpectedRaised2, 18)})`);
    console.log(`Project 2 Status: ${projectAfterContributions2.status} (Expected: Active (1))`);
    if (projectAfterContributions2.totalRaised !== totalExpectedRaised2) {
        console.error(`Assertion Failed: Total raised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised2, 18)}, got ${ethers.formatUnits(projectAfterContributions2.totalRaised, 18)}.`);
        process.exit(1);
    }
    if (projectAfterContributions2.status !== 1n) {
        console.error("Assertion Failed: Project 2 status should be Active (1).");
        process.exit(1);
    }
    console.log("SUCCESS: Project 2 contributions verified.");

    // Finalize Project (Successful)
    console.log("\n--- Finalize Project 2 (Softcap Met) ---");
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
    console.log(`Project ID ${newProjectId2} final status: ${projectFinalized2.status} (Expected: Successful (3))`);
    if (projectFinalized2.status !== 2n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Successful (2), got ${projectFinalized2.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Project 2 finalization to  verified.");

    // --- Liquidity Deposit and Finalization for Project 2 ---
    console.log(`\n--- Liquidity Deposit and Finalization for Project ID ${newProjectId2} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId2);
    console.log(`On-chain project.totalRaised: ${ethers.formatUnits(projectStateBeforeDeposit.totalRaised, 18)} EXH`);
    console.log(`On-chain project.softCap: ${ethers.formatUnits(projectStateBeforeDeposit.softCap, 18)} EXH`);
    console.log(`On-chain project.liquidityPercentage: ${projectStateBeforeDeposit.liquidityPercentage.toString()}`);
    console.log(`On-chain project.tokenPrice: ${ethers.formatUnits(projectStateBeforeDeposit.tokenPrice, 18)} EXH per AFT`);

    // Re-calculate the required values locally using the on-chain state
    const platformFeePercentage = await exhibition.platformFeePercentage();
    const totalRaisedOnChain = projectStateBeforeDeposit.totalRaised;
    const liquidityPercentageOnChain = projectStateBeforeDeposit.liquidityPercentage;
    const tokenPriceOnChain = projectStateBeforeDeposit.tokenPrice;

    // --- CORRECTED CALCULATION (Fee is deducted first) ---
    const platformFeeAmount = (totalRaisedOnChain * platformFeePercentage) / 10000n;
    const netRaisedAfterFee = totalRaisedOnChain - platformFeeAmount;
    
    // The contribution tokens for liquidity should be a percentage of the NET raised amount.
    const contributionTokensForLiquidity = (netRaisedAfterFee * liquidityPercentageOnChain) / 10000n;
    
    // The required project tokens are calculated from that amount.
    // ** FIX: This calculation is the most common point of failure for precision.
    // To ensure it perfectly matches the contract's integer math, we perform
    // the multiplication first, then the division. We also use 18 decimals
    // as a multiplier to handle the price calculation.
    const requiredProjectTokensForLiquidity = (contributionTokensForLiquidity * ethers.parseUnits("1", 18)) / tokenPriceOnChain;
    
    const expectedDeployerPayout = netRaisedAfterFee - contributionTokensForLiquidity;

    console.log("\n--- 🟢 DEBUG: Local Recalculation using Corrected Logic ---");
    console.log(`Local Calculated Platform Fee: ${ethers.formatUnits(platformFeeAmount, 18)} EXH`);
    console.log(`Local Calculated Net Raised After Fee: ${ethers.formatUnits(netRaisedAfterFee, 18)} EXH`);
    console.log(`Local Calculated Contribution Tokens for Liquidity: ${ethers.formatUnits(contributionTokensForLiquidity, 18)} EXH`);
    console.log(`Local Calculated Required Project Tokens for Liquidity: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} POT3`);
    console.log(`Amount being sent to contract: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} AFT`);
    console.log("---------------------------------------------------------");

    // DEBUG: Balances before liquidity deposit
    console.log("\n--- DEBUG: Balances Before Liquidity Deposit ---");
    console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);

    // Project owner (deployer) mints/gets enough POT3 for liquidity if needed
    const deployerPOT3Balance = await projectTokenContractAFT.balanceOf(deployer.address);
    if (deployerPOT3Balance < requiredProjectTokensForLiquidity) {
        console.error(`ERROR: Deployer does not have enough AFT for liquidity. Has ${ethers.formatUnits(deployerPOT3Balance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // Project owner approves Exhibition to spend liquidity tokens
    console.log(`\nDeployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol2} for liquidity...`);
    await projectTokenContractAFT.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Project Owner approved Exhibition for liquidity tokens.");

    // Project owner deposits liquidity tokens
    // ** CORRECTION: Removed the `- 1n` workaround. The corrected calculation above
    // should now perfectly match the contract's required amount.
    console.log(`\nDeployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId2}...`);
    await exhibition.connect(deployer).depositLiquidityTokens(newProjectId2, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Liquidity tokens deposited by Project Owner.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n--- DEBUG: Balances After Liquidity Deposit ---");
    console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contrac AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAMMAddress), 18)}`);

    // Verify deposit
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId2);
    // Verify that the deposited amount is what we sent, not the full calculated amount
    if (depositedAmount !== requiredProjectTokensForLiquidity) {
        console.error(`Assertion Failed: Deposited liquidity amount mismatch. Expected ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}, got ${ethers.formatUnits(depositedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Deposited liquidity amount verified.");

    // Record deployer's initial EXH balance before fund release
    const deployerInitialEXHBalance = await EXH.balanceOf(deployer.address);
    console.log(`Deployer initial EXH balance before fund release: ${ethers.formatUnits(deployerInitialEXHBalance, 18)}`);

    // DEBUG: Log balances before finalizing liquidity and releasing funds
    console.log("\n--- DEBUG: Balances Before Finalizing Liquidity & Releasing Funds ---");
    console.log(`Deployer EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAMMAddress), 18)}`);
    console.log(`Exhibition AMM POT3 Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAMMAddress), 18)}`);


    // Finalize liquidity and release funds
    console.log(`\nCalling finalizeLiquidityAndReleaseFunds for Project ID ${newProjectId2}...`);
    const finalizeLiquidityTxResponse = await exhibition.connect(deployer).finalizeLiquidityAndReleaseFunds(newProjectId2);
    const finalizeLiquidityReceipt: TransactionReceipt | null = await finalizeLiquidityTxResponse.wait();
    console.log("SUCCESS: Liquidity finalized and funds released.");

    // Verify project status is Completed
    const projectCompleted = await exhibition.projects(newProjectId2);
    console.log(`Project ID ${newProjectId2} final status: ${projectCompleted.status} (Expected: Completed (6))`);
    if (projectCompleted.status !== 6n) { // Expected Completed (6)
        console.error(`Assertion Failed: Project ID ${newProjectId2} final status mismatch. Expected Completed (6), got ${projectCompleted.status}.`);
        process.exit(1);
    }
    if (!projectCompleted.liquidityAdded) {
        console.error("Assertion Failed: project.liquidityAdded flag is false.");
        process.exit(1);
    }
    console.log("SUCCESS: Project status updated to Completed and liquidityAdded flag set.");

    // Verify deployer's final EXH balance (should include remaining funds + platform fee)
    const deployerFinalEXHBalance = await EXH.balanceOf(deployer.address);
    // The expected payout is now based on the net raised AFTER the fee and AFTER the liquidity portion
    const totalExpectedIncrease = expectedDeployerPayout + platformFeeAmount;
    const actualIncrease = deployerFinalEXHBalance - deployerInitialEXHBalance;

    console.log(`Deployer final EXH balance: ${ethers.formatUnits(deployerFinalEXHBalance, 18)}`);
    console.log(`Expected owner payout: ${ethers.formatUnits(expectedDeployerPayout, 18)} EXH`);
    console.log(`Expected platform fee payout: ${ethers.formatUnits(platformFeeAmount, 18)} EXH`);
    console.log(`Total expected increase for Deployer: ${ethers.formatUnits(totalExpectedIncrease, 18)} EXH`);
    console.log(`Actual increase for Deployer: ${ethers.formatUnits(actualIncrease, 18)} EXH`);

    // Allow for minor floating point discrepancies if any, by comparing BigInts directly
    if (actualIncrease !== totalExpectedIncrease) {
        console.error(`Assertion Failed: Deployer EXH balance increase incorrect. Expected ${ethers.formatUnits(totalExpectedIncrease, 18)}, got ${ethers.formatUnits(actualIncrease, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Deployer's EXH balance increase verified (includes owner payout + platform fee).");

    // Verify FundsReleasedToProjectOwner event
    let fundsReleasedEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "FundsReleasedToProjectOwner" && parsedLog.args.projectOwner === deployer.address) {
                    fundsReleasedEventFound = true;
                    console.log(`FundsReleasedToProjectOwner event emitted: Project ID ${parsedLog.args.projectId}, Owner ${parsedLog.args.projectOwner}, Amount ${ethers.formatUnits(parsedLog.args.amountReleased, 18)}`);
                    if (parsedLog.args.amountReleased !== expectedDeployerPayout) {
                        console.error(`Assertion Failed: FundsReleasedToProjectOwner amount mismatch. Expected ${ethers.formatUnits(expectedDeployerPayout, 18)}, got ${ethers.formatUnits(parsedLog.args.amountReleased, 18)}.`);
                        process.exit(1);
                    }
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed by this interface
            }
        }
    }
    if (!fundsReleasedEventFound) {
        console.error("ERROR: FundsReleasedToProjectOwner event not found.");
        process.exit(1);
    }
    console.log("SUCCESS: FundsReleasedToProjectOwner event verified.");

    // Verify PlatformFeeCollected event
    let platformFeeEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "PlatformFeeCollected" && parsedLog.args.recipient === deployer.address) {
                    platformFeeEventFound = true;
                    console.log(`PlatformFeeCollected event emitted: Project ID ${parsedLog.args.projectId}, Token ${parsedLog.args.tokenAddress}, Amount ${ethers.formatUnits(parsedLog.args.amount, 18)}, Recipient ${parsedLog.args.recipient}`);
                    if (parsedLog.args.amount !== platformFeeAmount) {
                        console.error(`Assertion Failed: PlatformFeeCollected amount mismatch. Expected ${ethers.formatUnits(platformFeeAmount, 18)}, got ${ethers.formatUnits(parsedLog.args.amount, 18)}.`);
                        process.exit(1);
                    }
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed by this interface
            }
        }
    }
    if (!platformFeeEventFound) {
        console.error("ERROR: PlatformFeeCollected event not found.");
        process.exit(1);
    }
    console.log("SUCCESS: PlatformFeeCollected event verified.");


    // --- Test WithdrawUnsoldTokens for Project 2 ---
    console.log("\n=== TEST WITHDRAW UNSOLD TOKENS FOR AFT ===");
    const project3AfterRefunds = await exhibition.projects(newProjectId2);
    const timelockEnd1 = Number(project3AfterRefunds.endTime) + 86400; // endTime + 1 day
    const currentTime = Number(await time.latest());
    const timeToTimelockEnd = timelockEnd1 - currentTime + 10;
    if (timeToTimelockEnd > 0) {
        await advanceTime(timeToTimelockEnd);
        console.log("Advanced time past timelock for AFT.");
    }

    console.log("Deployer withdrawing unsold tokens for Project 2...");
    const deployerBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectBeforeWithdraw = await exhibition.projects(newProjectId2);

    // Use proper calculation logic that matches TokenCalculationLib
    const totalRaisedBigInt = projectBeforeWithdraw.totalRaised;
    const tokenPriceBigInt = projectBeforeWithdraw.tokenPrice;

    // Get token decimals
    const contributionDecimals = 18; // EXH has 18 decimals
    const projectDecimals = 18; // AFT has 18 decimals

    // Calculate tokens allocated using the same logic as TokenCalculationLib
    // Step 1: Scale contribution amount to 18 decimals (already 18 for EXH, so no change)
    const contributionIn18Decimals = totalRaisedBigInt;

    // Step 2: Calculate tokens in 18 decimals using the formula from the library
    // tokensIn18Decimals = (contributionIn18Decimals * 1e18) / tokenPrice
    const tokensIn18Decimals = (contributionIn18Decimals * ethers.parseUnits("1", 18)) / tokenPriceBigInt;

    // Step 3: Scale to project token decimals (already 18 for AFT, so no change)
    const tokensAllocatedBigInt = tokensIn18Decimals;

    // Update unsoldTokensBigInt to use amountTokensForSale for status = 6
    let unsoldTokensBigInt = amountTokensForSale2; // Default for Refundable status
    if (projectBeforeWithdraw.status !== 5n) {
        unsoldTokensBigInt = amountTokensForSale2 - tokensAllocatedBigInt;
    }

    console.log("\n--- DEBUG: WithdrawUnsoldTokens Calculation ---");
    console.log(`Total Raised: ${ethers.formatUnits(totalRaisedBigInt, 18)} EXH`);
    console.log(`Token Price: ${ethers.formatUnits(tokenPriceBigInt, 18)} EXH per AFT`);
    console.log(`Contribution: ${ethers.formatUnits(contributionIn18Decimals, 18)}`);
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
    const actualIncreases = deployerBalanceAfterWithdraw - deployerBalanceBeforeWithdraw;
    if (withdrawAmount !== unsoldTokensBigInt) {
        console.error(`Assertion Failed: Withdrawn amount incorrect.`);
        console.error(`  Expected: ${ethers.formatUnits(unsoldTokensBigInt, 18)} AFT`);
        console.error(`  Got: ${ethers.formatUnits(withdrawAmount, 18)} AFT`);
        console.error(`  Difference: ${ethers.formatUnits(withdrawAmount - unsoldTokensBigInt, 18)} AFT`);
        process.exit(1);
    }
    if (actualIncreases !== withdrawAmount) {
        console.error(`Assertion Failed: Deployer balance increase doesn't match withdraw amount.`);
        console.error(`  Expected increase: ${ethers.formatUnits(withdrawAmount, 18)} AFT`);
        console.error(`  Actual increase: ${ethers.formatUnits(actualIncreases, 18)} AFT`);
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

    console.log("\nProject 2 (EXH Contribution, Softcap Met, WithdrawUnsoldTokens) testing script finished successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});