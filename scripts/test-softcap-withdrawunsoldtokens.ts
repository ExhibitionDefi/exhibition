import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TransactionReceipt } from "ethers";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";
import { Exhibition, ExhibitionToken} from "../typechain-types";

async function main() {
    console.log("Starting local Project ( Softcap Met, WithdrawUnsoldTokens after Timelock elapsed ) testing script...");

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

    const ExhibitionTokenAddress = deployedAddresses.EXH as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH: ${ExhibitionTokenAddress}`);
    console.log(`Exhibition: ${exhibitionAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);

    // Get contract instances
    const EXH: ExhibitionToken = await ethers.getContractAt("ExhibitionToken", ExhibitionTokenAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();
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

    // --- Helper to advance blocks ---
    const advanceBlocks = async (blocks: number) => {
       const blocksHex = `0x${blocks.toString(16)}`;
       console.log(`\nAdvancing network by ${blocks} blocks...`);
       await network.provider.send("hardhat_mine", [blocksHex]);
       const newBlockNumber = await ethers.provider.getBlockNumber();
       console.log(`New block number: ${newBlockNumber}`);
    };

    // Launchpad Project Creation (Project: EXH, Softcap Met)
    console.log("\n--- Launchpad Project Creation Test (Project: EXH, Softcap Met) ---");
    const projectTokenName = "AFTToken";
    const projectTokenSymbol = "AFT";
    const initialTotalSupply = ethers.parseUnits("10000000", 18); // 10M AFT
    const projectTokenLogoURI = "https://launchpad.com/aft_logo.png";
    const contributionTokenAddress = ExhibitionTokenAddress; // EXH
    const fundingGoal = ethers.parseUnits("50000", 18); // Hardcap: 50,000 EXH
    const softCap = ethers.parseUnits("25500", 18); // Softcap: 25,500 EXH
    const minContribution = ethers.parseUnits("100", 18);
    const maxContribution = ethers.parseUnits("15000", 18);
    const tokenPrice = ethers.parseUnits("0.01", 18); // 1 AFT = 0.01 EXH (1 EXH = 100 AFT)
    const amountTokensForSale = ethers.parseUnits("5000000", 18); // 5,000,000 AFT
    const currentBlockNumber = BigInt(await ethers.provider.getBlockNumber());
    const startBlocks = currentBlockNumber + minStartDelay + 100n;
    const endBlocks = startBlocks + maxProjectDuration;
    const liquidityPercentage = 7700n; // 77%
    const lockDuration = 31536000n; // 1 year in blocks
    const vestingEnabled = false; // No vesting

    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${tokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(tokenPrice, 18)} EXH per AFT`);
    console.log(`Expected: 1 AFT costs 0.01 EXH`);
    console.log(`Expected: 100 AFT for 1 EXH`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} AFT`);
    console.log(`Max raise at full sale: ${ethers.formatUnits((amountTokensForSale * tokenPrice) / 10n**18n, 18)} EXH`);

    // Create project
    console.log("Calling createLaunchpadProject for Project 2...");
    const createProjectTxResponse = await exhibition.connect(deployer).createLaunchpadProject(
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
        startBlocks,
        endBlocks,
        amountTokensForSale,
        liquidityPercentage,
        lockDuration,
        vestingEnabled,
        0n, 0n, 0n, 0n // No vesting
    );
    const createProjectReceipt: TransactionReceipt | null = await createProjectTxResponse.wait();
    let newProjectId: bigint | undefined;
    let newProjectTokenAddress: string | undefined;
    if (createProjectReceipt && createProjectReceipt.logs) {
        for (const log of createProjectReceipt.logs) {
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
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken.");
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

    // Contributions (Above softcap: 25,500 EXH)
    console.log("\n--- Contributions for Project (Above Softcap) ---");
    const user1Contribute = ethers.parseUnits("14901", 18); // 14,901 EXH
    const user2Contribute = ethers.parseUnits("10009", 18); // 10009 EXH
    const user3Contribute = ethers.parseUnits("5590", 18); // 5590 EXH
    const totalExpectedRaised = user1Contribute + user2Contribute + user3Contribute; // 30,500 EXH

    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectstartBlocks = Number(projectToAdvance.startBlock);
    const currentBlock = Number(await ethers.provider.getBlockNumber()); 
    let blockToAdvanceForContribution = 0;
    if (currentBlock < projectstartBlocks) {
        blockToAdvanceForContribution = projectstartBlocks - currentBlock + 10;
        await advanceBlocks(blockToAdvanceForContribution);
        console.log(`Advanced blocks by ${blockToAdvanceForContribution} for Project ${newProjectId}.`);
    } else {
        console.log("Project is already open for contributions.");
    }

    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await EXH.connect(user1).approve(exhibitionAddress, user1Contribute);
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);
    console.log("SUCCESS: User1 contributed.");

    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await EXH.connect(user2).approve(exhibitionAddress, user2Contribute);
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);
    console.log("SUCCESS: User2 contributed.");

    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await EXH.connect(user3).approve(exhibitionAddress, user3Contribute);
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);
    console.log("SUCCESS: User3 contributed.");

    await logBalances("After Contributions for Project");
    const projectAfterContributions = await exhibition.projects(newProjectId);
    console.log(`Project Total Raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 18)} EXH (Expected: ${ethers.formatUnits(totalExpectedRaised, 18)})`);
    console.log(`Project Status: ${projectAfterContributions.status} (Expected: Active (1))`);
    if (projectAfterContributions.totalRaised !== totalExpectedRaised) {
        console.error(`Assertion Failed: Total raised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised, 18)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 18)}.`);
        process.exit(1);
    }
    if (projectAfterContributions.status !== 1n) {
        console.error("Assertion Failed: Project status should be Active (1).");
        process.exit(1);
    }
    console.log("SUCCESS: Project contributions verified.");

    // Finalize Project (Successful)
    console.log("\n--- Finalize Project (Softcap Met) ---");
    const blockNeededToAdvance = Number(projectAfterContributions.endBlock) - Number(await ethers.provider.getBlockNumber()) + 10;
    if (blockNeededToAdvance > 0) {
        await advanceBlocks(blockNeededToAdvance);
        console.log(`Advanced blocks past end block for Project ID ${newProjectId}.`);
    } else {
        console.log(`Project ID ${newProjectId} end time is already in the past.`);
    }

    console.log(`Calling finalizeProject for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).finalizeProject(newProjectId);
    const projectFinalized = await exhibition.projects(newProjectId);
    console.log(`Project ID ${newProjectId} final status: ${projectFinalized.status} (Expected: Successful (2))`);
    if (projectFinalized.status !== 2n) {
        console.error(`Assertion Failed: Project status mismatch. Expected Successful (2), got ${projectFinalized.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Project finalization verified.");

    // --- Liquidity Deposit and Finalization for Project ---
    console.log(`\n--- Liquidity Deposit and Finalization for Project ID ${newProjectId} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId);
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

    // Project owner (deployer) have enough POT3 for liquidity if needed
    const deployerPOT3Balance = await projectTokenContractAFT.balanceOf(deployer.address);
    if (deployerPOT3Balance < requiredProjectTokensForLiquidity) {
        console.error(`ERROR: Deployer does not have enough AFT for liquidity. Has ${ethers.formatUnits(deployerPOT3Balance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // Project owner approves Exhibition to spend liquidity tokens
    console.log(`\nDeployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol} for liquidity...`);
    await projectTokenContractAFT.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Project Owner approved Exhibition for liquidity tokens.");

    // Project owner deposits liquidity tokens
    // ** CORRECTION: Removed the `- 1n` workaround. The corrected calculation above
    // should now perfectly match the contract's required amount.
    console.log(`\nDeployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).depositLiquidityTokens(newProjectId, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Liquidity tokens deposited by Project Owner.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n--- DEBUG: Balances After Liquidity Deposit ---");
    console.log(`Deployer AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contrac AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM AFT Balance: ${ethers.formatUnits(await projectTokenContractAFT.balanceOf(exhibitionAMMAddress), 18)}`);

    // Verify deposit
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId);
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
    console.log(`\nCalling finalizeLiquidityAndReleaseFunds for Project ID ${newProjectId}...`);
    const finalizeLiquidityTxResponse = await exhibition.connect(deployer).finalizeLiquidityAndReleaseFunds(newProjectId);
    const finalizeLiquidityReceipt: TransactionReceipt | null = await finalizeLiquidityTxResponse.wait();
    console.log("SUCCESS: Liquidity finalized and funds released.");

    // Verify project status is Completed
    const projectCompleted = await exhibition.projects(newProjectId);
    console.log(`Project ID ${newProjectId} final status: ${projectCompleted.status} (Expected: Completed (6))`);
    if (projectCompleted.status !== 6n) { // Expected Completed (6)
        console.error(`Assertion Failed: Project ID ${newProjectId} final status mismatch. Expected Completed (6), got ${projectCompleted.status}.`);
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
    const totalExpectedIncrease = expectedDeployerPayout;
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
                if (parsedLog && parsedLog.name === "PlatformFeeCollected" && parsedLog.args.recipient === user1.address) {
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
    const projectAfterCompleted = await exhibition.projects(newProjectId);
    const blocklockEnd1 = BigInt(projectAfterCompleted.endBlock) + 172801n;
    const currentBlock1 = BigInt(await ethers.provider.getBlockNumber());
    const blockToTimelockEnd = blocklockEnd1 - currentBlock1 + 10n;
    if (blockToTimelockEnd > 0n) {
        await advanceBlocks(Number(blockToTimelockEnd));
        console.log("Advanced blocks past timelock for AFT.");
    }

    console.log("Deployer withdrawing unsold tokens for Project...");
    const deployerBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(deployer.address);
    const contractBalanceBeforeWithdraw = await projectTokenContractAFT.balanceOf(exhibitionAddress);
    const projectBeforeWithdraw = await exhibition.projects(newProjectId);

    // Use proper calculation logic that matches TokenCalculationLib
    const totalRaisedBigInt = projectBeforeWithdraw.totalRaised;
    const tokenPriceBigInt = projectBeforeWithdraw.tokenPrice;

    // Calculate tokens allocated using the same logic as TokenCalculationLib
    // Step 1: Scale contribution amount to 18 decimals (already 18 for EXH, so no change)
    const contributionIn18Decimals = totalRaisedBigInt;

    // Step 2: Calculate tokens in 18 decimals using the formula from the library
    // tokensIn18Decimals = (contributionIn18Decimals * 1e18) / tokenPrice
    const tokensIn18Decimals = (contributionIn18Decimals * ethers.parseUnits("1", 18)) / tokenPriceBigInt;

    // Step 3: Scale to project token decimals (already 18 for AFT, so no change)
    const tokensAllocatedBigInt = tokensIn18Decimals;

    // Update unsoldTokensBigInt to use amountTokensForSale for status = 6
    let unsoldTokensBigInt = amountTokensForSale; // Default for Refundable status
    if (projectBeforeWithdraw.status !== 5n) {
        unsoldTokensBigInt = amountTokensForSale - tokensAllocatedBigInt;
    }

    console.log("\n--- DEBUG: WithdrawUnsoldTokens Calculation ---");
    console.log(`Total Raised: ${ethers.formatUnits(totalRaisedBigInt, 18)} EXH`);
    console.log(`Token Price: ${ethers.formatUnits(tokenPriceBigInt, 18)} EXH per AFT`);
    console.log(`Contribution: ${ethers.formatUnits(contributionIn18Decimals, 18)}`);
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
    console.log("SUCCESS: WithdrawUnsoldTokens for Project verified.");

    console.log("\nProject (EXH Contribution, Softcap Met, WithdrawUnsoldTokens) testing script finished successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});