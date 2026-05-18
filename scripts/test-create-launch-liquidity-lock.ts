import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TransactionReceipt } from "ethers";

// Import Typechain generated types for your contracts
import { Exhibition, NexusUSD, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

//  helper function to format ethers
const statusNames: Record<number, string> = {
    0: 'Upcoming',      // Project created, waiting for startTime
    1: 'Active',        // Project is live and accepting contributions
    2: 'Successful',    // Project met its softCap during FundingEnded phase
    3: 'Failed',        // Project did NOT meet its softCap during FundingEnded phase
    4: 'Claimable',     // Project is Successful, contributors can claim tokens
    5: 'Refundable',    // Project is Failed, contributors can request refunds
    6: 'Completed'      // Project fully completed
};

async function main() {
    console.log("Starting local Project (USDX Contribution -HARD CAP MET - Auto Finalization, Updated Liquidity with Lock, Swap) testing script...");

    // Get all 5 signers from Hardhat's configured accounts
    const [deployer, user1, user2, user3, user4] = await ethers.getSigners();

    console.log(`Testing with Deployer account: ${deployer.address}`);
    console.log(`Testing with User1 account: ${user1.address}`);
    console.log(`Testing with User2 account: ${user2.address}`);
    console.log(`Testing with User3 account: ${user3.address}`);
    console.log(`Testing with User4 account: ${user4.address}`);

    // --- Load deployed addresses ---
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const NexusUSDAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`NexusUSD: ${NexusUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const NexusUSD: NexusUSD = await ethers.getContractAt("NexusUSD", NexusUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionAMM: ExhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const exhibitionLPTokens: ExhibitionLPTokens = await ethers.getContractAt("ExhibitionLPTokens", exhibitionLPTokensAddress, deployer);

    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();

    // Declare projectTokenContractNEB at a higher scope
    let projectTokenContractNEB: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user4.address), 6)}`);
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
        if (projectTokenContractNEB) {
            console.log(`Exhibition Contract Project Token Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);
            console.log(`Exhibition AMM Project Token Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAMMAddress), 18)}`);
        } else {
            console.log(`Exhibition Contract Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
            console.log(`Exhibition AMM Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
        }
        console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);
    };

    // --- Helper to advance time ---
    const advanceBlocks = async (blocks: number) => {
       // Convert the number of blocks to a hex string as required by hardhat_mine
       const blocksHex = `0x${blocks.toString(16)}`;
       console.log(`\nAdvancing network by ${blocks} blocks...`);
       // Mines the specified number of blocks instantly
       await network.provider.send("hardhat_mine", [blocksHex]);
       // Retrieve the new block number using ethers provider
       const newBlockNumber = await ethers.provider.getBlockNumber();
       console.log(`New block number: ${newBlockNumber}`);
    };


    // --- Launchpad Project Creation Test ( USDX Contribution - Hard Cap) ---
    console.log("\n--- Launchpad Project Creation Test (USDX Contribution - HARD CAP MET) ---");

    // Define parameters for a new launchpad project
    const projectTokenName = "Nexus Builder";
    const projectTokenSymbol = "NEB";
    const initialTotalSupply = ethers.parseUnits("500000000", 18); // 500 Millon NEB
    const projectTokenLogoURI = "https://launchpad.com/NEB_logo.png";

    const contributionTokenAddress = NexusUSDAddress; // Using USDX as contribution token
    const fundingGoal = ethers.parseUnits("125000.5", 6); // Hard Cap: 125,000.5 USDX
    const softCap = ethers.parseUnits("65000", 6); // Soft Cap: 65,000 USDX
    const minContribution = ethers.parseUnits("100", 6); // Minimum contribution: 100 USDX
    const maxContribution = ethers.parseUnits("50000", 6); // Maximum contribution: 50,000 USDX

    // contribution token (USDX has 6 decimals) but the contract logic required 18 decimals format.
    const adjustedTokenPrice = ethers.parseUnits("0.0005", 18); // 1 NEB costs 0.0005 USDX (in 18 decimals)

    const currentBlock = BigInt(await ethers.provider.getBlockNumber());
    const startBlocks = currentBlock + minStartDelay + 100n; // Ensure it's after minStartDelay
    const endBlocks = startBlocks + maxProjectDuration; // Use the fetched constant


    // Corrected tokens for sale calculation:
    // If 125,000.5 USDX can be raised and 1 NEB costs 0.0005 USDX:
    // Maximum NEB that can be sold = 125,000.5 USDX / 0.0005 USDX per NEB = 250,001,000 NEB
    const amountTokensForSale = ethers.parseUnits("250001000", 18); // 250,001,000 NEB for sale

    const liquidityPercentage = 7600n; // 76%
    const lockDuration = 31536000n; // 1 year in block number

    // Vesting Parameters define in block numbers for consistency with contract logic
    const vestingEnabled = true;
    const vestingCliffBlocks = 2592000n; // 30 days cliff
    const vestingDurationBlocks = 31536000n; // 365 days vesting duration (from project start)
    const vestingIntervalBlocks = 2592000n; // 30 days interval
    const vestingInitialRelease = 2000n; // 20.00% initial release

    // ADD LOGGING FOR VERIFICATION
    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${adjustedTokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(adjustedTokenPrice, 18)} per NEB`);
    console.log(`Expected: 1 NEB costs 0.0005 USDX`);
    console.log(`Expected: 2000 NEB for 1 USDX`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} NEB`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);
    console.log(`Soft Cap: ${ethers.formatUnits(softCap, 6)} USDX`);

    console.log("Calling createLaunchpadProject for Nexus Builder... with corrected token price");
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
        adjustedTokenPrice,
        startBlocks,
        endBlocks,
        amountTokensForSale,
        liquidityPercentage,
        lockDuration,
        // Vesting Parameters
        vestingEnabled,
        vestingCliffBlocks,
        vestingDurationBlocks,
        vestingIntervalBlocks,
        vestingInitialRelease
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
                // Ignore logs that cannot be parsed by this interface
            }
        }
    }

    if (!newProjectId || !newProjectTokenAddress) {
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken in receipt for Project");
        process.exit(1);
    }
    console.log(`Successfully created project with ID: ${newProjectId}`);
    console.log(`Newly created Project Token Address: ${newProjectTokenAddress}`);

    projectTokenContractNEB = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer); // Initialize here

    // DEBUG: Log balances before tokens for sale deposit
    console.log("\n--- DEBUG: Balances Before Tokens For Sale Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Project Owner approves Exhibition to spend project tokens (for tokens for sale)
    console.log(`\nDeployer (Project Owner) is approving Exhibition contract to spend ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol} (for sale)...`);
    await projectTokenContractNEB.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("SUCCESS: Project Owner approved Exhibition to spend tokens for sale.");

    // Project Owner deposits tokens for sale and activates project
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol}...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("SUCCESS: Tokens for sale deposited and project activated.");

    // DEBUG: Log balances after tokens for sale deposit
    console.log("\n--- DEBUG: Balances After Tokens For Sale Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // --- Contributions for Project(HARD CAP MET - Should Auto Finalize) ---
    console.log("\n--- Contributions for Project (HARD CAP MET - Should Auto Finalize) ---");

    // Plan to contribute EXACTLY the hard cap (125,000.5 USDX)
    const user1Contribute3 = ethers.parseUnits("43111.5", 6); // User1 contributes 43111.5 USDX
    const user2Contribute3 = ethers.parseUnits("27102", 6); // User2 contributes 27102 USDX 
    const user3Contribute3 = ethers.parseUnits("27001", 6); // User3 contributes 27001 USDX
    const user4Contribute3 = ethers.parseUnits("27786", 6); // User4 contributes 27786 USDX
    const totalExpectedRaised = user1Contribute3 + user2Contribute3 + user3Contribute3 + user4Contribute3; // 125,000.5 USDX (Hard Cap)

    console.log(`Planned total contributions: ${ethers.formatUnits(totalExpectedRaised, 6)} USDX`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);
    console.log(`Expected: Hard cap will be met and project should auto-finalize`);

    // Ensure enough time has passed for the project to be active for contributions
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectStartBlock = Number(projectToAdvance.startBlock);
    const currentBlock1 = await ethers.provider.getBlockNumber();

    let blocksToAdvance1 = 0;
    if (currentBlock1 < projectStartBlock) {
        // Advance by the difference + a small buffer of 10 blocks
        blocksToAdvance1 = projectStartBlock - currentBlock1 + 10;
    }

    if (blocksToAdvance1 > 0) {
        await advanceBlocks(blocksToAdvance1);
        console.log(`Advanced ${blocksToAdvance1} blocks. Project is now active.`);
    } else {
        console.log("Project is already open for contributions.");
    }

    // User1 contributes
    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user1).approve(exhibitionAddress, user1Contribute3); // Approve USDX
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute3);
    console.log("SUCCESS: User1 contributed.");

    // Check status after User1
    let projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User1: ${projectStatus.status} (1=Active, 2=Successful)`);
    console.log(`Total raised after User1: ${ethers.formatUnits(projectStatus.totalRaised, 6)} USDX`);

    // User2 contributes
    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user2).approve(exhibitionAddress, user2Contribute3); // Approve USDX
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute3);
    console.log("SUCCESS: User2 contributed.");

    // Check status after User2
    projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User2: ${projectStatus.status} (1=Active, 2=Successful)`);
    console.log(`Total raised after User2: ${ethers.formatUnits(projectStatus.totalRaised, 6)} USDX`);

    // User3 contributes
    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user3).approve(exhibitionAddress, user3Contribute3); // Approve USDX
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute3);
    console.log("SUCCESS: User3 contributed.");

    // Check status after User3
    projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User3: ${projectStatus.status} (1=Active, 2=Successful)`);
    console.log(`Total raised after User3: ${ethers.formatUnits(projectStatus.totalRaised, 6)} USDX`);

    // User4 contributes (This should hit the hard cap and auto-finalize)
    console.log(`\n🎯 User4 contributing ${ethers.formatUnits(user4Contribute3, 6)} USDX to Project ID ${newProjectId} (SHOULD HIT HARD CAP)...`);
    await NexusUSD.connect(user4).approve(exhibitionAddress, user4Contribute3); // Approve USDX

    // This contribution should trigger auto-finalization
    const user4ContributeTx = await exhibition.connect(user4).contribute(newProjectId, user4Contribute3);
    const user4ContributeReceipt = await user4ContributeTx.wait();
    console.log("SUCCESS: User4 contributed (Hard Cap Hit!).");

    // Check final status - should be auto-finalized to Successful (2)
    const projectAfterContributions = await exhibition.projects(newProjectId);
    console.log(`\n🎉 HARD CAP REACHED! Project status: ${projectAfterContributions.status} (Expected: 2=Successful)`);
    console.log(`Final total raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)} USDX`);
    console.log(`Hard cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);

    // Verify the project was auto-finalized
    if (projectAfterContributions.totalRaised !== totalExpectedRaised) {
        console.error(`Assertion Failed: Project totalRaised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised, 6)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)}.`);
        process.exit(1);
    }

    if (projectAfterContributions.status !== 2n) { // Should be Successful (2) due to auto-finalization
        console.error(`Assertion Failed: Project should be auto-finalized to Successful (2), but got status ${projectAfterContributions.status}.`);
        process.exit(1);
    }

    console.log("✅ SUCCESS: Hard cap reached and project auto-finalized to Successful!");

    // Check for ProjectFinalized event in the contribution transaction
    let projectFinalizedEventFound = false;
    if (user4ContributeReceipt && user4ContributeReceipt.logs) {
        for (const log of user4ContributeReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "ProjectFinalized") {
                    projectFinalizedEventFound = true;
                    console.log(`✅ ProjectFinalized event emitted: Project ID ${parsedLog.args.projectId}, Status ${Number(parsedLog.args.newStatus)} (${statusNames[Number(parsedLog.args.newStatus)]})`);
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed by this interface
            }
        }
    }

    if (!projectFinalizedEventFound) {
        console.warn("⚠️  Warning: ProjectFinalized event not found in contribution transaction logs.");
    } else {
        console.log("✅ SUCCESS: ProjectFinalized event verified in auto-finalization.");
    }

    await logBalances(`After Hard Cap Contributions for Project ID ${newProjectId}`);

    // --- UPDATED: Liquidity Deposit and Finalization for ProjectS ---
    console.log(`\n--- UPDATED: Liquidity Deposit and Finalization for Project ID ${newProjectId} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId);
    console.log(`On-chain project.totalRaised: ${ethers.formatUnits(projectStateBeforeDeposit.totalRaised, 6)} USDX`);
    console.log(`On-chain project.softCap: ${ethers.formatUnits(projectStateBeforeDeposit.softCap, 6)} USDX`);
    console.log(`On-chain project.liquidityPercentage: ${projectStateBeforeDeposit.liquidityPercentage.toString()}`);
    console.log(`On-chain project.tokenPrice: ${ethers.formatUnits(projectStateBeforeDeposit.tokenPrice, 18)} per NEB`);

    // Re-calculate the required values locally using the on-chain state
    const platformFeePercentage = await exhibition.platformFeePercentage();
    const totalRaisedOnChain = projectStateBeforeDeposit.totalRaised;
    const liquidityPercentageOnChain = projectStateBeforeDeposit.liquidityPercentage;
    const tokenPriceOnChain = projectStateBeforeDeposit.tokenPrice;

    // --- CORRECTED CALCULATION to match contract logic ---
    const platformFeeAmount = (totalRaisedOnChain * platformFeePercentage) / 10000n;
    const netRaisedAfterFee = totalRaisedOnChain - platformFeeAmount;

    // The contribution tokens for liquidity should be a percentage of the NET raised amount.
    const contributionTokensForLiquidity = (netRaisedAfterFee * liquidityPercentageOnChain) / 10000n;

    // ✅ CORRECTION: Match the contract's _calculateTokensDue logic exactly
    const contributionDecimals = 6n; // USDX
    const projectDecimals = 18n; // NEB

    // Step 1: Normalize contribution to 18 decimals (like the contract does)
    const scaleFactor = 10n ** (18n - contributionDecimals); // 10^12 for USDX
    const normalizedContribution = contributionTokensForLiquidity * scaleFactor;

    // Step 2: Apply the same calculation as the contract
    const projectTokenScaleFactor = 10n ** projectDecimals;
    const requiredProjectTokensForLiquidity = (normalizedContribution * projectTokenScaleFactor) / tokenPriceOnChain;

    console.log("\n--- 🟢 DEBUG: Local Recalculation using Corrected Logic ---");
    console.log(`Local Calculated Platform Fee: ${ethers.formatUnits(platformFeeAmount, 6)} USDX`);
    console.log(`Local Calculated Net Raised After Fee: ${ethers.formatUnits(netRaisedAfterFee, 6)} USDX`);
    console.log(`Local Calculated Contribution Tokens for Liquidity: ${ethers.formatUnits(contributionTokensForLiquidity, 6)} USDX`);
    console.log(`Normalized Contribution (18 decimals): ${ethers.formatUnits(normalizedContribution, 18)}`);
    console.log(`Local Calculated Required Project Tokens for Liquidity: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} NEB`);
    console.log("---------------------------------------------------------");

    // DEBUG: Balances before liquidity deposit
    console.log("\n--- DEBUG: Balances Before Liquidity Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Project owner (deployer) mints/gets enough NEB for liquidity if needed
    const deployerNEBBalance = await projectTokenContractNEB.balanceOf(deployer.address);
    if (deployerNEBBalance < requiredProjectTokensForLiquidity) {
        console.error(`ERROR: Deployer does not have enough NEB for liquidity. Has ${ethers.formatUnits(deployerNEBBalance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // --- NEW: Step 1 - Project owner deposits liquidity tokens using depositLiquidityTokens ---
    console.log(`\n🔄 STEP 1: Depositing Liquidity Tokens for Project ID ${newProjectId}`);
    console.log(`Deployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol} for liquidity deposit...`);
    await projectTokenContractNEB.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Project Owner approved Exhibition for liquidity token deposit.");

    // Call the new depositLiquidityTokens function
    console.log(`\nDeployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId}...`);
    const depositLiquidityTxResponse = await exhibition.connect(deployer).depositLiquidityTokens(newProjectId, requiredProjectTokensForLiquidity);
    const depositLiquidityReceipt: TransactionReceipt | null = await depositLiquidityTxResponse.wait();
    console.log("SUCCESS: Liquidity tokens deposited by Project Owner via depositLiquidityTokens.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n--- DEBUG: Balances After depositLiquidityTokens ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Verify deposit amount in contract mapping
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId);
    if (depositedAmount !== requiredProjectTokensForLiquidity) {
        console.error(`Assertion Failed: Deposited liquidity amount mismatch. Expected ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}, got ${ethers.formatUnits(depositedAmount, 18)}.`);
        process.exit(1);
    }
    console.log(`SUCCESS: Deposited liquidity amount verified: ${ethers.formatUnits(depositedAmount, 18)} NEB`);

    // Record deployer's initial USDX balance before fund release
    const deployerInitialUSDXBalance = await NexusUSD.balanceOf(deployer.address);
    console.log(`Deployer initial USDX balance before fund release: ${ethers.formatUnits(deployerInitialUSDXBalance, 6)}`);

    // --- NEW: Step 2 - Finalize liquidity and release funds using the updated function ---
    console.log(`\n🔄 STEP 2: Finalizing Liquidity and Releasing Funds for Project ID ${newProjectId}`);
    console.log("\n--- DEBUG: Balances Before Finalizing Liquidity & Releasing Funds ---");
    console.log(`Deployer USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);
    console.log(`Exhibition AMM NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAMMAddress), 18)}`);

    // Call the updated finalizeLiquidityAndReleaseFunds function
    console.log(`\nCalling finalizeLiquidityAndReleaseFunds for Project ID ${newProjectId}...`);
    const finalizeLiquidityTxResponse = await exhibition.connect(deployer).finalizeLiquidityAndReleaseFunds(newProjectId);
    const finalizeLiquidityReceipt: TransactionReceipt | null = await finalizeLiquidityTxResponse.wait();
    console.log("SUCCESS: Liquidity finalized and funds released via updated finalizeLiquidityAndReleaseFunds.");

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

    // --- NEW: Verify liquidity lock was created ---
    console.log(`\n--- Verifying Liquidity Lock Creation ---`);
    try {
        // Check if liquidity is locked for the project owner
        const isLocked = await exhibitionAMM.isLiquidityLocked(newProjectTokenAddress, NexusUSDAddress, deployer.address);
        console.log(`Liquidity locked for project owner: ${isLocked}`);

        if (isLocked) {
            // Get lock details
            const result = await exhibitionAMM.getLiquidityLock(newProjectTokenAddress, NexusUSDAddress, deployer.address);
            const lockDetails = result.lock;
            const blocksUntilUnlock = result.blocksUntilUnlock;

            // Now struct fields are accessible
            console.log(`Lock Project ID: ${lockDetails.projectId}`);
            console.log(`Lock Project Owner: ${lockDetails.projectOwner}`);
            console.log(`Lock Unlock Time: ${new Date(Number(lockDetails.unlockBlock) * 1000).toISOString()}`);
            console.log(`Locked LP Amount: ${ethers.formatUnits(lockDetails.lockedLPAmount, 18)}`);
            console.log(`Lock Active: ${lockDetails.isActive}`);
            console.log(`Blocks Until Unlock: ${blocksUntilUnlock}`);

            // Get withdrawable amount (should be 0 since all LP tokens are locked)
            const withdrawableAmount = await exhibitionAMM.getWithdrawableLPAmount(newProjectTokenAddress, NexusUSDAddress, deployer.address);
            console.log(`Withdrawable LP Amount: ${ethers.formatUnits(withdrawableAmount, 18)} (Expected: 0 or very small)`);

            console.log("SUCCESS: Liquidity lock verified and created correctly.");
        } else {
            console.warn("WARNING: Liquidity lock was not created or has already expired/unlocked.");
        }
    } catch (error: any) {
        console.error(`ERROR: Could not verify liquidity lock: ${error.message}`);
        // Don't exit here since lock verification might not be critical for the test flow
    }

    // --- NEW: Test Liquidity Lock Functionality ---
    console.log(`\n--- Testing Liquidity Lock Functionality ---`);
    
    // Try to unlock liquidity before lock period expires (should fail)
    console.log("\nTrying to unlock liquidity before lock period expires (should fail)...");
    try {
        await exhibitionAMM.connect(deployer).unlockLiquidity(newProjectTokenAddress, NexusUSDAddress);
        console.error("ERROR: Liquidity unlock succeeded when it should have failed (lock period not expired).");
        process.exit(1);
    } catch (error: any) {
        console.log(`SUCCESS: Liquidity unlock failed as expected: ${error.message}`);
        if (!error.message.includes("LiquidityIsLocked()")) {
            console.log("WARNING: Expected 'LiquidityIsLocked()' error, but got a different one.");
        }
    }

    // Check current lock status
    const currentBlock0 = await ethers.provider.getBlockNumber();
    const result = await exhibitionAMM.getLiquidityLock(newProjectTokenAddress, NexusUSDAddress, deployer.address);
    // 2. Calculate the delta in blocks
    const blocksUntilUnlock = Number(result.lock.unlockBlock) - currentBlock0;

    console.log(`\nCurrent block: ${currentBlock0}`);
    console.log(`Lock unlock block: ${result.lock.unlockBlock}`);
    console.log(`Blocks until unlock: ${blocksUntilUnlock}`);

    // 3. Optional: Convert to estimated time
    const estimatedSeconds = blocksUntilUnlock * 1;
    console.log(`Estimated time until unlock: ~${estimatedSeconds} seconds`);


    // Get LP token balance to verify lock is working
    const lpBalance = await exhibitionLPTokens.balanceOf(newProjectTokenAddress, NexusUSDAddress, deployer.address);
    const withdrawableAmount = await exhibitionAMM.getWithdrawableLPAmount(newProjectTokenAddress, NexusUSDAddress, deployer.address);
    console.log(`Deployer LP token balance: ${ethers.formatUnits(lpBalance, 18)}`);
    console.log(`Withdrawable LP amount (considering lock): ${ethers.formatUnits(withdrawableAmount, 18)}`);

    // Simulate advancing time to after lock period (for testing purposes)
    const blocksToAdvance = blocksUntilUnlock + 100;

    console.log(`\nAdvancing ${blocksToAdvance} blocks to simulate lock period expiration...`);
    await advanceBlocks(blocksToAdvance);

    // Verify current status
    const newBlock = await ethers.provider.getBlockNumber();
    console.log(`Current block is now: ${newBlock}`);
    
    // Now try to unlock liquidity (should succeed)
    console.log("\nTrying to unlock liquidity after lock period expires (should succeed)...");
    try {
        const unlockTx = await exhibitionAMM.connect(deployer).unlockLiquidity(newProjectTokenAddress, NexusUSDAddress);
        const unlockReceipt = await unlockTx.wait();
        console.log("SUCCESS: Liquidity unlocked successfully.");

        // Check for LiquidityUnlocked event
        let liquidityUnlockedEventFound = false;
        if (unlockReceipt && unlockReceipt.logs) {
            for (const log of unlockReceipt.logs) {
                try {
                    const parsedLog = exhibitionAMM.interface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === "LiquidityUnlocked") {
                        liquidityUnlockedEventFound = true;
                        console.log(`LiquidityUnlocked event emitted: Project ID ${parsedLog.args.projectId}, Owner ${parsedLog.args.owner}, Amount ${ethers.formatUnits(parsedLog.args.unlockedAmount, 18)}`);
                        break;
                    }
                } catch (e) {
                    // Ignore logs that cannot be parsed
                }
            }
        }

        if (!liquidityUnlockedEventFound) {
            console.warn("WARNING: LiquidityUnlocked event not found.");
        } else {
            console.log("SUCCESS: LiquidityUnlocked event verified.");
        }

        // Verify lock status after unlock
        const isStillLocked = await exhibitionAMM.isLiquidityLocked(newProjectTokenAddress, NexusUSDAddress, deployer.address);
        const newWithdrawableAmount = await exhibitionAMM.getWithdrawableLPAmount(newProjectTokenAddress, NexusUSDAddress, deployer.address);
        
        console.log(`Liquidity still locked after unlock: ${isStillLocked}`);
        console.log(`New withdrawable LP amount after unlock: ${ethers.formatUnits(newWithdrawableAmount, 18)}`);

        if (isStillLocked) {
            console.error("Assertion Failed: Liquidity should not be locked after unlock.");
            process.exit(1);
        }

        if (newWithdrawableAmount !== lpBalance) {
            console.error(`Assertion Failed: Withdrawable amount should equal total LP balance after unlock. Expected ${ethers.formatUnits(lpBalance, 18)}, got ${ethers.formatUnits(newWithdrawableAmount, 18)}.`);
            process.exit(1);
        }

        console.log("SUCCESS: Liquidity lock functionality verified completely.");

    } catch (error: any) {
        console.error(`ERROR: Liquidity unlock failed unexpectedly: ${error.message}`);
        process.exit(1);
    }

    // Try to unlock again (should fail - no active lock)
    console.log("\nTrying to unlock liquidity again (should fail - no active lock)...");
    try {
        await exhibitionAMM.connect(deployer).unlockLiquidity(newProjectTokenAddress, NexusUSDAddress);
        console.error("ERROR: Second liquidity unlock succeeded when it should have failed (no active lock).");
        process.exit(1);
    } catch (error: any) {
        console.log(`SUCCESS: Second liquidity unlock failed as expected: ${error.message}`);
        if (!error.message.includes("InvalidLockData()")) {
            console.log("WARNING: Expected 'InvalidLockData()' error, but got a different one.");
        }
    }


    // --- NEW: Test User2 Adding Liquidity to Existing Pool (ROBUST VERSION) ---
    console.log("\n--- Testing User Adding Liquidity to Existing USDX/NEB Pool ---");

    // User2 will add liquidity to the existing USDX/NEB pool
    const user2LiquidityUSDX = ethers.parseUnits("1000", 6); // User2 wants to add 1000 USDX

    // Get current reserves using the getReserves function which handles token ordering
    const reservesResult = await exhibitionAMM.getReserves(NexusUSDAddress, newProjectTokenAddress);
    const reserveUSDX = reservesResult[0]; // reserveA (USDX)
    const reserveNEB = reservesResult[1];    // reserveB (NEB)

    console.log(`Current AMM USDX Reserve: ${ethers.formatUnits(reserveUSDX, 6)}`);
    console.log(`Current AMM NEB Reserve: ${ethers.formatUnits(reserveNEB, 18)}`);

    // Calculate optimal NEB amount based on current pool ratio
    const optimalNEBAmount = (user2LiquidityUSDX * reserveNEB) / reserveUSDX;
    console.log(`Optimal NEB amount for ${ethers.formatUnits(user2LiquidityUSDX, 6)} USDX: ${ethers.formatUnits(optimalNEBAmount, 18)}`);

    // Check current balances
    const user2USDXBalance = await NexusUSD.balanceOf(user2.address);
    const user2NEBBalance = await projectTokenContractNEB.balanceOf(user2.address);

    console.log(`User2 current USDX balance: ${ethers.formatUnits(user2USDXBalance, 6)}`);
    console.log(`User2 current NEB balance: ${ethers.formatUnits(user2NEBBalance, 18)}`);

    // Ensure User2 has enough USDX
    if (user2USDXBalance < user2LiquidityUSDX) {
        const needed = user2LiquidityUSDX - user2USDXBalance;
        console.log(`User2 needs more USDX. Minting ${ethers.formatUnits(needed, 6)} USDX...`);
        await NexusUSD.connect(deployer).mint(user1.address, needed);
        console.log("SUCCESS: Minted additional USDX for User2.");
    }
  
    // Ensure User2 has enough NEB (add a little extra for safety)
    const nebNeeded = optimalNEBAmount + ethers.parseUnits("1000", 18); // Add 1000 NEB buffer
    if (user2NEBBalance < nebNeeded) {
        const needed = nebNeeded - user2NEBBalance;
        console.log(`User2 needs more NEB. Transferring ${ethers.formatUnits(needed, 18)} NEB from deployer...`);
    
        const deployerNEBBalance = await projectTokenContractNEB.balanceOf(deployer.address);
        if (deployerNEBBalance >= needed) {
            await projectTokenContractNEB.connect(deployer).transfer(user2.address, needed);
            console.log("SUCCESS: Transferred NEB from deployer to User2.");
        } else {
            console.error("ERROR: Deployer doesn't have enough NEB to transfer to User2.");
            console.log(`Deployer has: ${ethers.formatUnits(deployerNEBBalance, 18)} NEB`);
            console.log(`Needs: ${ethers.formatUnits(needed, 18)} NEB`);
            process.exit(1);
       }
    }

    // Record initial LP token balance
    const user2InitialLPBalance = await exhibitionLPTokens.balanceOf(NexusUSDAddress, newProjectTokenAddress, user2.address);
    console.log(`User2 initial LP token balance: ${ethers.formatUnits(user2InitialLPBalance, 18)}`);

    // Calculate amounts with more generous slippage (5% to account for any rounding)
    const actualUSDXoAdd = user2LiquidityUSDX;
    const actualNEBToAdd = optimalNEBAmount;

    // Set slippage tolerance (5% slippage for robustness)
    const minUSDXAmount = (actualUSDXoAdd * 95n) / 100n;
    const minNEBAmount = (actualNEBToAdd * 95n) / 100n;

    console.log(`Actual USDX to add: ${ethers.formatUnits(actualUSDXoAdd, 6)}`);
    console.log(`Actual NEB to add: ${ethers.formatUnits(actualNEBToAdd, 18)}`);
    console.log(`Minimum USDX amount (with 5% slippage): ${ethers.formatUnits(minUSDXAmount, 6)}`);
    console.log(`Minimum NEB amount (with 5% slippage): ${ethers.formatUnits(minNEBAmount, 18)}`);

    // Approve AMM to spend tokens (approve a bit more than needed for safety)
    const approveUSDXAmount = actualUSDXoAdd + ethers.parseUnits("10", 6); // Add 10 USDX buffer
    const approveNEBAmount = actualNEBToAdd + ethers.parseUnits("10000", 18); // Add 10k NEB buffer

    console.log(`User2 approving AMM to spend ${ethers.formatUnits(approveUSDXAmount, 6)} USDX...`);
    await NexusUSD.connect(user2).approve(exhibitionAMMAddress, approveUSDXAmount);

    console.log(`User2 approving AMM to spend ${ethers.formatUnits(approveNEBAmount, 18)} NEB...`);
    await projectTokenContractNEB.connect(user2).approve(exhibitionAMMAddress, approveNEBAmount);

    // Set deadline for the transaction
    const addLiquidityDeadline = BigInt((await ethers.provider.getBlock("latest"))?.timestamp || Math.floor(Date.now() / 1000)) + 600n;

    // Add liquidity to the pool
    console.log(`User2 adding liquidity to USDX/NEB pool...`);
    console.log(`Target amounts: ${ethers.formatUnits(actualUSDXoAdd, 6)} USDX and ${ethers.formatUnits(actualNEBToAdd, 18)} NEB`);

    try {
        const addLiquidityTx = await exhibitionAMM.connect(user2).addLiquidity(
            NexusUSDAddress,      // tokenA (USDX)
            newProjectTokenAddress,     // tokenB (NEB)
            actualUSDXoAdd,         // amountADesired
            actualNEBToAdd,            // amountBDesired
            minUSDXAmount,           // amountAMin
            minNEBAmount,              // amountBMin
            user2.address,             // to (recipient of LP tokens)
            addLiquidityDeadline       // deadline
        );

        const addLiquidityReceipt = await addLiquidityTx.wait();
        console.log("SUCCESS: User2 added liquidity to the pool.");

        // Check transaction results from receipt
        let actualAmountA = 0n;
        let actualAmountB = 0n;
        let liquidityMinted = 0n;

        if (addLiquidityReceipt && addLiquidityReceipt.logs) {
            for (const log of addLiquidityReceipt.logs) {
                try {
                    const parsedLog = exhibitionAMM.interface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === "LiquidityAdded") {
                        actualAmountA = parsedLog.args.amountA;
                        actualAmountB = parsedLog.args.amountB;
                        liquidityMinted = parsedLog.args.liquidityMinted;
                        console.log(`LiquidityAdded event emitted:`);
                        console.log(`  Provider: ${parsedLog.args.provider}`);
                        console.log(`  Token A: ${parsedLog.args.tokenA}`);
                        console.log(`  Token B: ${parsedLog.args.tokenB}`);
                        console.log(`  Amount A: ${ethers.formatUnits(actualAmountA, parsedLog.args.tokenA === NexusUSDAddress ? 6 : 18)}`);
                        console.log(`  Amount B: ${ethers.formatUnits(actualAmountB, parsedLog.args.tokenB === NexusUSDAddress ? 6 : 18)}`);
                        console.log(`  Liquidity Minted: ${ethers.formatUnits(liquidityMinted, 18)}`);
                        break;
                    }
                } catch (e) {
                    // Ignore logs that cannot be parsed
                }
            }
        }

        // Check final balances
        const user2FinalUSDXBalance = await NexusUSD.balanceOf(user2.address);
        const user2FinalNEBBalance = await projectTokenContractNEB.balanceOf(user2.address);
        const user2FinalLPBalance = await exhibitionLPTokens.balanceOf(NexusUSDAddress, newProjectTokenAddress, user2.address);

        console.log(`User2 final USDX balance: ${ethers.formatUnits(user2FinalUSDXBalance, 6)}`);
        console.log(`User2 final NEB balance: ${ethers.formatUnits(user2FinalNEBBalance, 18)}`);
        console.log(`User2 final LP token balance: ${ethers.formatUnits(user2FinalLPBalance, 18)}`);

        // Verify LP tokens were received
        const lpTokensReceived = user2FinalLPBalance - user2InitialLPBalance;
        console.log(`LP tokens received by User2: ${ethers.formatUnits(lpTokensReceived, 18)}`);

        if (lpTokensReceived <= 0n) {
            console.error("Assertion Failed: User2 did not receive LP tokens after adding liquidity.");
            process.exit(1);
        }

        // Verify pool reserves increased
        const updatedReservesResult = await exhibitionAMM.getReserves(NexusUSDAddress, newProjectTokenAddress);
        const newReserveUSDX = updatedReservesResult[0];
        const newReserveNEB = updatedReservesResult[1];

        console.log(`New AMM USDX Reserve: ${ethers.formatUnits(newReserveUSDX, 6)}`);
        console.log(`New AMM NEB Reserve: ${ethers.formatUnits(newReserveNEB, 18)}`);

        const USDXIncrease = newReserveUSDX - reserveUSDX;
        const NEBIncrease = newReserveNEB - reserveNEB;

        console.log(`USDX Reserve Increase: ${ethers.formatUnits(USDXIncrease, 6)}`);
        console.log(`NEB Reserve Increase: ${ethers.formatUnits(NEBIncrease, 18)}`);

        if (USDXIncrease <= 0n || NEBIncrease <= 0n) {
            console.error("Assertion Failed: Pool reserves did not increase after liquidity addition.");
            process.exit(1);
        }

        console.log("SUCCESS: User liquidity addition to existing pool completed and verified.");

        // --- Test Removing Liquidity (Optional) ---
        console.log("\n--- Testing User Removing Liquidity from Pool ---");

        // User2 removes half of their LP tokens
        const lpToRemove = lpTokensReceived / 2n;
        console.log(`User2 removing ${ethers.formatUnits(lpToRemove, 18)} LP tokens (half of received)...`);

        // Get quote for liquidity removal
        const removeLiquidityQuote = await exhibitionAMM.getRemoveLiquidityQuote(
            NexusUSDAddress,
            newProjectTokenAddress,
            lpToRemove
        );

        const expectedUSDXOut = removeLiquidityQuote[0]; // amountA
        const expectedNEBOut = removeLiquidityQuote[1]; // amountB

        // Set minimum amounts with 5% slippage tolerance
        const minUSDXOut = (expectedUSDXOut * 95n) / 100n;
        const minNEBOut = (expectedNEBOut * 95n) / 100n;

        console.log(`Expected to receive: ${ethers.formatUnits(expectedUSDXOut, 6)} USDX and ${ethers.formatUnits(expectedNEBOut, 18)} NEB`);
        console.log(`Minimum amounts: ${ethers.formatUnits(minUSDXOut, 6)} USDX and ${ethers.formatUnits(minNEBOut, 18)} NEB`);

        // Record balances before removal
        const user2USDXBeforeRemoval = await NexusUSD.balanceOf(user2.address);
        const user2NEBBeforeRemoval = await projectTokenContractNEB.balanceOf(user2.address);

        // Set deadline
        const removeLiquidityDeadline = BigInt((await ethers.provider.getBlock("latest"))?.timestamp || Math.floor(Date.now() / 1000)) + 600n;

        // Remove liquidity
        const removeLiquidityTx = await exhibitionAMM.connect(user2).removeLiquidity(
            NexusUSDAddress,      // tokenA
            newProjectTokenAddress,     // tokenB
            lpToRemove,                // liquidity amount to remove
            minUSDXOut,              // amountAMin
            minNEBOut,                 // amountBMin
            user2.address,             // to
            removeLiquidityDeadline    // deadline
        );

        const removeLiquidityReceipt = await removeLiquidityTx.wait();
        console.log("SUCCESS: User2 removed liquidity from the pool.");

        // Verify final balances after removal
        const user2USDXAfterRemoval = await NexusUSD.balanceOf(user2.address);
        const user2NEBAfterRemoval = await projectTokenContractNEB.balanceOf(user2.address);
        const user2FinalLPAfterRemoval = await exhibitionLPTokens.balanceOf(NexusUSDAddress, newProjectTokenAddress, user2.address);

        const USDXReceived = user2USDXAfterRemoval - user2USDXBeforeRemoval;
        const NEBReceived = user2NEBAfterRemoval - user2NEBBeforeRemoval;

        console.log(`USDX received from removal: ${ethers.formatUnits(USDXReceived, 6)}`);
        console.log(`NEB received from removal: ${ethers.formatUnits(NEBReceived, 18)}`);
        console.log(`User2 remaining LP tokens: ${ethers.formatUnits(user2FinalLPAfterRemoval, 18)}`);

        if (USDXReceived < minUSDXOut || NEBReceived < minNEBOut) {
            console.error("Assertion Failed: Received amounts are below minimum expected.");
            process.exit(1);
        }

        // Check for LiquidityRemoved event
        let liquidityRemovedEventFound = false;
        if (removeLiquidityReceipt && removeLiquidityReceipt.logs) {
            for (const log of removeLiquidityReceipt.logs) {
                try {
                    const parsedLog = exhibitionAMM.interface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === "LiquidityRemoved") {
                        liquidityRemovedEventFound = true;
                        console.log(`LiquidityRemoved event emitted:`);
                        console.log(`  Provider: ${parsedLog.args.provider}`);
                        console.log(`  Token A: ${parsedLog.args.tokenA}`);
                        console.log(`  Token B: ${parsedLog.args.tokenB}`);
                        console.log(`  Amount A: ${ethers.formatUnits(parsedLog.args.amountA, parsedLog.args.tokenA === NexusUSDAddress ? 6 : 18)}`);
                        console.log(`  Amount B: ${ethers.formatUnits(parsedLog.args.amountB, parsedLog.args.tokenB === NexusUSDAddress ? 6 : 18)}`);
                        break;
                    }
                } catch (e) {
                    // Ignore logs that cannot be parsed
                }
            }
        }

        if (!liquidityRemovedEventFound) {
            console.warn("WARNING: LiquidityRemoved event not found.");
        } else {
            console.log("SUCCESS: LiquidityRemoved event verified.");
        }

        console.log("SUCCESS: Liquidity removal completed and verified.");

        // --- Test Liquidity Lock Check (User2 shouldn't have locks) ---
        console.log("\n--- Testing Liquidity Lock Status for Regular User ---");

        const user2IsLocked = await exhibitionAMM.isLiquidityLocked(NexusUSDAddress, newProjectTokenAddress, user2.address);
        const user2WithdrawableAmount = await exhibitionAMM.getWithdrawableLPAmount(NexusUSDAddress, newProjectTokenAddress, user2.address);
        const user2CurrentLPBalance = await exhibitionLPTokens.balanceOf(NexusUSDAddress, newProjectTokenAddress, user2.address);

        console.log(`User2 liquidity locked: ${user2IsLocked} (Expected: false)`);
        console.log(`User2 withdrawable LP amount: ${ethers.formatUnits(user2WithdrawableAmount, 18)}`);
        console.log(`User2 current LP balance: ${ethers.formatUnits(user2CurrentLPBalance, 18)}`);

    if (user2IsLocked) {
        console.error("Assertion Failed: User2 (regular user) should not have liquidity locks.");
        process.exit(1);
    }

        if (user2WithdrawableAmount !== user2CurrentLPBalance) {
            console.error("Assertion Failed: User2's withdrawable amount should equal current balance (no locks).");
            process.exit(1);
        }

           console.log("SUCCESS: Regular user liquidity lock status verified (no locks as expected).");

        } catch (error: any) {
        console.error(`ERROR during liquidity addition: ${error.message}`);
    
        // Debug information
        console.log("\n--- DEBUG INFORMATION ---");
        console.log(`Current reserves - USDX: ${ethers.formatUnits(reserveUSDX, 6)}, NEB: ${ethers.formatUnits(reserveNEB, 18)}`);
        console.log(`Target amounts - USDX: ${ethers.formatUnits(actualUSDXoAdd, 6)}, NEB: ${ethers.formatUnits(actualNEBToAdd, 18)}`);
        console.log(`Minimum amounts - USDX: ${ethers.formatUnits(minUSDXAmount, 6)}, NEB: ${ethers.formatUnits(minNEBAmount, 18)}`);
        console.log(`User2 balances - USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)}, NEB: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(user2.address), 18)}`);
    
        process.exit(1);
    }

    console.log("\n✅ Additional Features Tested:");
    console.log("   - User adding liquidity to existing pool with proper token ordering");
    console.log("   - Robust optimal amount calculations based on pool ratios");
    console.log("   - LP token minting and distribution to regular users");
    console.log("   - Liquidity removal functionality");
    console.log("   - Generous slippage protection for both add and remove operations");
    console.log("   - Event emission verification with dynamic decimal handling");
    console.log("   - Pool reserve updates verification");
    console.log("   - Lock status verification for regular users vs project owners");
    console.log("   - Comprehensive error handling and debugging");

    console.log("\n🎉 Project (HARD CAP MET - Auto Finalization, Updated Liquidity with Lock) testing script finished successfully!");
    console.log("✅ Key Features Tested:");
    console.log("   - Hard cap reached (125,000.5 USDX)");
    console.log("   - Automatic project finalization when hard cap hit");
    console.log("   - NEW: Separate liquidity deposit via depositLiquidityTokens()");
    console.log("   - NEW: Enhanced liquidity finalization with addLiquidityWithLock()");
    console.log("   - NEW: Liquidity lock enforcement and verification");
    console.log("   - NEW: Lock expiration and unlock functionality");
    console.log("   - All balance calculations and event validations");
    console.log("   - Enhanced liquidity lock management system");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});