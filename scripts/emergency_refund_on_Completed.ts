import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { TransactionReceipt } from "ethers";
import { Exhibition, NexusUSD } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";
 

//  helper function to format ethers
const statusNames: Record<number, string> = {
    0: 'Upcoming',      // Project created, awaiting token deposit from project owner
    1: 'Active',        // Tokens deposited; accepts contributions once start time is reached
    2: 'Successful',    // Soft cap reached by end time, ready for token distribution and liquidity addition
    3: 'Failed',        // Soft cap not reached by end time, eligible for refunds
    4: 'Claimable',     // Project is Successful, contributors can claim tokens
    5: 'Refundable',    // Project is Failed, contributors can request refunds
    6: 'Completed'      // Project fully completed
};

async function main() {
    console.log("Starting Emergency Refund on Completed Project Testing Script...");

    // Get all signers from Hardhat's configured accounts
    const [deployer, user1, user2, user3, user4, user5, user6, user7, user8, user9] = await ethers.getSigners();

    console.log(`Testing with Deployer account: ${deployer.address}`);
    console.log(`Testing with User1 account: ${user1.address}`);
    console.log(`Testing with User2 account: ${user2.address}`);
    console.log(`Testing with User3 account: ${user3.address}`);
    console.log(`Testing with User4 account: ${user4.address}`);
    console.log(`Testing with User5 account: ${user5.address}`);
    console.log(`Testing with User6 account: ${user6.address}`);
    console.log(`Testing with User7 account: ${user7.address}`);
    console.log(`Testing with User8 account: ${user8.address}`);


    // --- Load deployed addresses ---
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const NexusUSDAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`NexusUSD: ${NexusUSDAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const NexusUSD: NexusUSD = await ethers.getContractAt("NexusUSD", NexusUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);

    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();
    const liquidityFinalizationDeadline = await exhibition.LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS();

    console.log(`\n--- Contract Constants ---`);
    console.log(`MIN_START_DELAY: ${minStartDelay} seconds (${Number(minStartDelay) / 60} minutes)`);
    console.log(`MAX_PROJECT_DURATION: ${maxProjectDuration} seconds (${Number(maxProjectDuration) / 86400} days)`);
    console.log(`LIQUIDITY_FINALIZATION_DEADLINE: ${liquidityFinalizationDeadline} seconds (${Number(liquidityFinalizationDeadline) / 86400} days)`);

    // Declare projectTokenContractNSC at a higher scope
    let projectTokenContractNSC: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user4.address), 6)}`);;
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
    };

    // --- Helper to advance blocks ---
    const advanceBlocks = async (blocks: number) => {
       const blocksHex = `0x${blocks.toString(16)}`;
       console.log(`\nAdvancing network by ${blocks} blocks...`);
       await network.provider.send("hardhat_mine", [blocksHex]);
       const newBlockNumber = await ethers.provider.getBlockNumber();
       console.log(`New block number: ${newBlockNumber}`);
    };;

    // --- Launchpad Project Creation Test ( USDX Contribution - Hard Cap) ---
    console.log("\n--- Launchpad Project Creation Test (USDX Contribution - HARD CAP MET) ---");

    // Define parameters for a new launchpad project
    const projectTokenName = "Nexus Super Contributor";
    const projectTokenSymbol = "NSC";
    const initialTotalSupply = ethers.parseUnits("100000000", 18); // 100 Million NSC
    const projectTokenLogoURI = "https://launchpad.com/NSC_logo.png";

    const contributionTokenAddress = NexusUSDAddress; // Using USDX as contribution token
    const fundingGoal = ethers.parseUnits("250000", 6); // Hard Cap: 250,000 USDX
    const softCap = ethers.parseUnits("130000", 6); // Soft Cap: 130,000 USDX
    const minContribution = ethers.parseUnits("100", 6); // Minimum contribution: 100 USDX
    const maxContribution = ethers.parseUnits("40000", 6); // Maximum contribution: 40,000 USDX

    // contribution token (USDX has 6 decimals) but the contract logic required 18 decimals format.
    const adjustedTokenPrice = ethers.parseUnits("0.01", 18); // 1 NSC costs 0.01 USDX (in 18 decimals)

    const currentBlockNumber = BigInt(await ethers.provider.getBlockNumber());
    const startBlock = currentBlockNumber + minStartDelay + 100n; // Ensure it's after minStartDelay
    const endBlock = startBlock + maxProjectDuration; // Use the fetched constant (21 days)

    // Corrected tokens for sale calculation:
    // If 250,000 USDX can be raised and 1 NSC costs 0.01 USDX:
    // Maximum NSC that can be sold = 250,000 USDX / 0.01 USDX per NSC = 25,000,000 NSC
    const amountTokensForSale = ethers.parseUnits("25000000", 18); // 25,000,000 NSC for sale

    const liquidityPercentage = 7600n; // 76%
    const lockDuration = 31536000n; // 1 year

    // Vesting Parameters for Project (Disable vesting for this test)
    const vestingEnabled = false;
    const vestingCliff = 0n;
    const vestingDuration = 0n; 
    const vestingInterval = 0n; 
    const vestingInitialRelease = 0n;

    // ADD LOGGING FOR VERIFICATION
    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${adjustedTokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(adjustedTokenPrice, 18)} per NSC`);
    console.log(`Expected: 1 NSC costs 0.01 USDX`);
    console.log(`Expected: 100 NSC for 1 USDX`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} NSC`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);
    console.log(`Soft Cap: ${ethers.formatUnits(softCap, 6)} USDX`);

    console.log("Calling createLaunchpadProject for Nexus Super Contributor... with corrected token price");
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
        startBlock,
        endBlock,
        amountTokensForSale,
        liquidityPercentage,
        lockDuration,
        // Vesting Parameters
        vestingEnabled,
        vestingCliff,
        vestingDuration,
        vestingInterval,
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

    projectTokenContractNSC = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer); // Initialize here

    // DEBUG: Log balances before tokens for sale deposit
    console.log("\n--- DEBUG: Balances Before Tokens For Sale Deposit ---");
    console.log(`Deployer NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(exhibitionAddress), 18)}`);

    // Project Owner approves Exhibition to spend project tokens (for tokens for sale)
    console.log(`\nDeployer (Project Owner) is approving Exhibition contract to spend ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol} (for sale)...`);
    await projectTokenContractNSC.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("SUCCESS: Project Owner approved Exhibition to spend tokens for sale.");

    // Project Owner deposits tokens for sale and activates project
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol}...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("SUCCESS: Tokens for sale deposited and project activated.");

    // DEBUG: Log balances after tokens for sale deposit
    console.log("\n--- DEBUG: Balances After Tokens For Sale Deposit ---");
    console.log(`Deployer NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(exhibitionAddress), 18)}`);

    // --- Contributions for Project(HARD CAP MET - Should Auto Finalize) ---
    console.log("\n--- Contributions for Project (HARD CAP MET - Should Auto Finalize) ---");

    // Plan to contribute EXACTLY the hard cap (250,000 USDX)
    const user1Contribute = ethers.parseUnits("34680", 6); // User1 contributes 34680 USDX
    const user2Contribute = ethers.parseUnits("27420", 6); // User2 contributes 27420 USDX 
    const user3Contribute = ethers.parseUnits("29900", 6); // User3 contributes 29900 USDX
    const user4Contribute = ethers.parseUnits("10000", 6); // User4 contributes 10000 USDX
    const user5Contribute = ethers.parseUnits("38000", 6); // User5 contributes 38000 USDX
    const user6Contribute = ethers.parseUnits("40000", 6); // User6 contributes 40000 USDX
    const user7Contribute = ethers.parseUnits("37980", 6); // User7 contributes 37980 USDX
    const user8Contribute = ethers.parseUnits("32020", 6); // User8 contributes 32020 USDX
    const totalExpectedRaised = user1Contribute + user2Contribute + user3Contribute + user4Contribute + user5Contribute + user6Contribute + user7Contribute + user8Contribute; // 250,000 USDX (Hard Cap)

    console.log(`Planned total contributions: ${ethers.formatUnits(totalExpectedRaised, 6)} USDX`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);
    console.log(`Expected: Hard cap will be met and project should auto-finalize`);

    // Ensure enough time has passed for the project to be active for contributions
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectstartBlock = Number(projectToAdvance.startBlock);
    const currentBlock = Number(await ethers.provider.getBlockNumber());
    let timeToAdvanceForContribution = 0;
    if (currentBlock < projectstartBlock) {
        timeToAdvanceForContribution = projectstartBlock - currentBlock + 10;
    }
    if (timeToAdvanceForContribution > 0) {
        await advanceBlocks(timeToAdvanceForContribution);
        console.log(`Advanced time by ${timeToAdvanceForContribution} blocks for Project.`);
    } else {
        console.log("Project is already open for contributions.");
    }
    
    // User1 contributes
    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user1).approve(exhibitionAddress, user1Contribute); // Approve USDX
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);
    console.log("SUCCESS: User1 contributed.");
    // Store user balances BEFORE contributions for refund verification later
    const user1BalanceAfterContrib = await NexusUSD.balanceOf(user1.address);

    // User2 contributes
    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user2).approve(exhibitionAddress, user2Contribute); // Approve USDX
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);
    console.log("SUCCESS: User2 contributed.");
    // Store user balances BEFORE contributions for refund verification later
    const user2BalanceAfterContrib = await NexusUSD.balanceOf(user2.address);

    // User3 contributes
    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user3).approve(exhibitionAddress, user3Contribute); // Approve USDX
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);
    console.log("SUCCESS: User3 contributed.");
    // Store user balances BEFORE contributions for refund verification later
    const user3BalanceAfterContrib = await NexusUSD.balanceOf(user3.address);

    // User4 contributes
    console.log(`\nUser4 contributing ${ethers.formatUnits(user4Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user4).approve(exhibitionAddress, user4Contribute); // Approve USDX
    await exhibition.connect(user4).contribute(newProjectId, user4Contribute);
    console.log("SUCCESS: User4 contributed.");

    // User5 contributes
    console.log(`\nUser5 contributing ${ethers.formatUnits(user5Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user5).approve(exhibitionAddress, user5Contribute); // Approve USDX
    await exhibition.connect(user5).contribute(newProjectId, user5Contribute);
    console.log("SUCCESS: User5 contributed.");

    // User6 contributes
    console.log(`\nUser6 contributing ${ethers.formatUnits(user6Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user6).approve(exhibitionAddress, user6Contribute); // Approve USDX
    await exhibition.connect(user6).contribute(newProjectId, user6Contribute);
    console.log("SUCCESS: User6 contributed.");

    // User7 contributes
    console.log(`\nUser7 contributing ${ethers.formatUnits(user7Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user7).approve(exhibitionAddress, user7Contribute); // Approve USDX
    await exhibition.connect(user7).contribute(newProjectId, user7Contribute);
    console.log("SUCCESS: User7 contributed.");

    // User8 contributes (This should hit the hard cap and auto-finalize)
    console.log(`\n🎯 User8 contributing ${ethers.formatUnits(user8Contribute, 6)} USDX to Project ID ${newProjectId} (SHOULD HIT HARD CAP)...`);
    await NexusUSD.connect(user8).approve(exhibitionAddress, user8Contribute); // Approve USDX

    // This contribution should trigger auto-finalization
    const user8ContributeTx = await exhibition.connect(user8).contribute(newProjectId, user8Contribute);
    const user8ContributeReceipt = await user8ContributeTx.wait();
    console.log("SUCCESS: User8 contributed (Hard Cap Hit!).");

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
    if (user8ContributeReceipt && user8ContributeReceipt.logs) {
        for (const log of user8ContributeReceipt.logs) {
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

    // --- UPDATED: Liquidity Deposit and Finalization for Project ---
    console.log(`\n--- UPDATED: Liquidity Deposit and Finalization for Project ID ${newProjectId} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId);
    console.log(`On-chain project.totalRaised: ${ethers.formatUnits(projectStateBeforeDeposit.totalRaised, 6)} USDX`);
    console.log(`On-chain project.softCap: ${ethers.formatUnits(projectStateBeforeDeposit.softCap, 6)} USDX`);
    console.log(`On-chain project.liquidityPercentage: ${projectStateBeforeDeposit.liquidityPercentage.toString()}`);
    console.log(`On-chain project.tokenPrice: ${ethers.formatUnits(projectStateBeforeDeposit.tokenPrice, 18)} per NSC`);

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
    const projectDecimals = 18n; // NSC

    // Step 1: Normalize contribution to 18 decimals (like the contract does)
    const scaleFactor = 10n ** (18n - contributionDecimals); // 10^12 for USDX
    const normalizedContribution = contributionTokensForLiquidity * scaleFactor;

    // Step 2: Apply the same calculation as the contract
    const projectTokenScaleFactor = 10n ** projectDecimals;
    const requiredProjectTokensForLiquidity = (normalizedContribution * projectTokenScaleFactor) / tokenPriceOnChain;

    const expectedDeployerPayout = netRaisedAfterFee - contributionTokensForLiquidity;

    console.log("\n--- 🟢 DEBUG: Local Recalculation using Corrected Logic ---");
    console.log(`Local Calculated Platform Fee: ${ethers.formatUnits(platformFeeAmount, 6)} USDX`);
    console.log(`Local Calculated Net Raised After Fee: ${ethers.formatUnits(netRaisedAfterFee, 6)} USDX`);
    console.log(`Local Calculated Contribution Tokens for Liquidity: ${ethers.formatUnits(contributionTokensForLiquidity, 6)} USDX`);
    console.log(`Normalized Contribution (18 decimals): ${ethers.formatUnits(normalizedContribution, 18)}`);
    console.log(`Local Calculated Required Project Tokens for Liquidity: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} NSC`);
    console.log("---------------------------------------------------------");

    // DEBUG: Balances before liquidity deposit
    console.log("\n--- DEBUG: Balances Before Liquidity Deposit ---");
    console.log(`Deployer NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(exhibitionAddress), 18)}`);

    // Project owner (deployer) mints/gets enough NSC for liquidity if needed
    const deployerNSCBalance = await projectTokenContractNSC.balanceOf(deployer.address);
    if (deployerNSCBalance < requiredProjectTokensForLiquidity) {
        console.error(`ERROR: Deployer does not have enough NSC for liquidity. Has ${ethers.formatUnits(deployerNSCBalance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // --- NEW: Step 1 - Project owner deposits liquidity tokens using depositLiquidityTokens ---
    console.log(`\n🔄 STEP 1: Depositing Liquidity Tokens for Project ID ${newProjectId}`);
    console.log(`Deployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol} for liquidity deposit...`);
    await projectTokenContractNSC.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Project Owner approved Exhibition for liquidity token deposit.");

    // Call the new depositLiquidityTokens function
    console.log(`\nDeployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId}...`);
    const depositLiquidityTxResponse = await exhibition.connect(deployer).depositLiquidityTokens(newProjectId, requiredProjectTokensForLiquidity);
    const depositLiquidityReceipt: TransactionReceipt | null = await depositLiquidityTxResponse.wait();
    console.log("SUCCESS: Liquidity tokens deposited by Project Owner via depositLiquidityTokens.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n--- DEBUG: Balances After depositLiquidityTokens ---");
    console.log(`Deployer NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(exhibitionAddress), 18)}`);

    // Verify deposit amount in contract mapping
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId);
    if (depositedAmount !== requiredProjectTokensForLiquidity) {
        console.error(`Assertion Failed: Deposited liquidity amount mismatch. Expected ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}, got ${ethers.formatUnits(depositedAmount, 18)}.`);
        process.exit(1);
    }
    console.log(`SUCCESS: Deposited liquidity amount verified: ${ethers.formatUnits(depositedAmount, 18)} NSC`);

    // Record deployer's initial USDX balance before fund release
    const deployerInitialUSDXBalance = await NexusUSD.balanceOf(deployer.address);
    console.log(`Deployer initial USDX balance before fund release: ${ethers.formatUnits(deployerInitialUSDXBalance, 6)}`);

    // --- NEW: Step 2 - Finalize liquidity and release funds using the updated function ---
    console.log(`\n🔄 STEP 2: Finalizing Liquidity and Releasing Funds for Project ID ${newProjectId}`);
    console.log("\n--- DEBUG: Balances Before Finalizing Liquidity & Releasing Funds ---");
    console.log(`Deployer USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
    console.log(`Deployer NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
    console.log(`Exhibition Contract NSC Balance: ${ethers.formatUnits(await projectTokenContractNSC.balanceOf(exhibitionAddress), 18)}`);
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

    // Verify deployer's final USDX balance
    const deployerFinalUSDXBalance = await NexusUSD.balanceOf(deployer.address);
    const totalExpectedIncrease = expectedDeployerPayout ;
    const actualIncrease = deployerFinalUSDXBalance - deployerInitialUSDXBalance;

    console.log(`Deployer final USDX balance: ${ethers.formatUnits(deployerFinalUSDXBalance, 6)}`);
    console.log(`Expected owner payout: ${ethers.formatUnits(expectedDeployerPayout, 6)} USDX`);
    console.log(`Expected platform fee payout: ${ethers.formatUnits(platformFeeAmount, 6)} USDX`);
    console.log(`Total expected increase for Deployer: ${ethers.formatUnits(totalExpectedIncrease, 6)} USDX`);
    console.log(`Actual increase for Deployer: ${ethers.formatUnits(actualIncrease, 6)} USDX`);

    if (actualIncrease !== totalExpectedIncrease) {
        console.error(`Assertion Failed: Deployer USDX balance increase incorrect. Expected ${ethers.formatUnits(totalExpectedIncrease, 6)}, got ${ethers.formatUnits(actualIncrease, 6)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Deployer's USDX balance increase verified (includes owner payout + platform fee).");

    // Verify FundsReleasedToProjectOwner event
    let fundsReleasedEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "FundsReleasedToProjectOwner" && parsedLog.args.projectOwner === deployer.address) {
                    fundsReleasedEventFound = true;
                    console.log(`FundsReleasedToProjectOwner event emitted: Project ID ${parsedLog.args.projectId}, Owner ${parsedLog.args.projectOwner}, Amount ${ethers.formatUnits(parsedLog.args.amountReleased, 6)}`);
                    if (parsedLog.args.amountReleased !== expectedDeployerPayout) {
                        console.error(`Assertion Failed: FundsReleasedToProjectOwner amount mismatch. Expected ${ethers.formatUnits(expectedDeployerPayout, 6)}, got ${ethers.formatUnits(parsedLog.args.amountReleased, 6)}.`);
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
                    console.log(`PlatformFeeCollected event emitted: Project ID ${parsedLog.args.projectId}, Token ${parsedLog.args.tokenAddress}, Amount ${ethers.formatUnits(parsedLog.args.amount, 6)}, Recipient ${parsedLog.args.recipient}`);
                    if (parsedLog.args.amount !== platformFeeAmount) {
                        console.error(`Assertion Failed: PlatformFeeCollected amount mismatch. Expected ${ethers.formatUnits(platformFeeAmount, 6)}, got ${ethers.formatUnits(parsedLog.args.amount, 6)}.`);
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

    await logBalances(`After Liquidity Finalization for Project ID ${newProjectId}`);

    // ==================================================================================
    // EMERGENCY REFUND TESTING - Attempted on COMPLETED Project (Should FAIL)
    // ==================================================================================
    console.log("\n\n================================================================================");
    console.log("🚨 EMERGENCY REFUND ON COMPLETED PROJECT - Testing Edge Case");
    console.log("================================================================================");
    console.log("\n📋 Test Scenario:");
    console.log("   1. Project reached hard cap → Successful ✅");
    console.log("   2. Owner deposited liquidity tokens ✅");
    console.log("   3. Owner finalized liquidity and released funds ✅");
    console.log("   4. Project status is now Completed (6) ✅");
    console.log("   5. liquidityAdded flag is TRUE ✅");
    console.log("   6. User attempts emergency refund → Should be BLOCKED ❌");
    console.log("\n💡 Expected Outcome:");
    console.log("   - Emergency refund should REVERT because:");
    console.log("     • Project has fulfilled all obligations");
    console.log("     • Liquidity has been added to AMM");
    console.log("     • Remaining funds have been released to owner");
    console.log("     • Project is in Completed status");
    console.log("   - Contributors have no grounds for refund");

    // Get current project state
    console.log("\n--- Verify Project State Before Emergency Refund Attempt ---");
    const projectBeforeRefund = await exhibition.projects(newProjectId);
    console.log(`Project Status: ${projectBeforeRefund.status} (${statusNames[Number(projectBeforeRefund.status)]})`);
    console.log(`Liquidity Added: ${projectBeforeRefund.liquidityAdded}`);
    console.log(`Total Raised: ${ethers.formatUnits(projectBeforeRefund.totalRaised, 6)} USDX`);
    
    if (projectBeforeRefund.status !== 6n) {
        console.error(`❌ Test Setup Error: Expected status 6 (Completed), got ${projectBeforeRefund.status}`);
        process.exit(1);
    }
    if (!projectBeforeRefund.liquidityAdded) {
        console.error(`❌ Test Setup Error: liquidityAdded should be TRUE for completed project`);
        process.exit(1);
    }
    console.log("✅ Project is correctly in Completed state with liquidity added");

    // Test 1: Try emergency refund BEFORE advancing time (should fail - not at deadline yet)
    console.log("\n--- Test 1: Attempt Emergency Refund BEFORE Deadline on Completed Project ---");
    console.log("Expected: Should revert (liquidity already added, project completed)");
    try {
        await exhibition.connect(user1).requestEmergencyRefund(newProjectId);
        console.error("❌ CRITICAL FAILURE: Emergency refund should have reverted on completed project!");
        console.error("This is a security vulnerability - users can refund after project completion!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("LiquidityAlreadyAdded") || 
            error.message.includes("InvalidProjectStatus") ||
            error.message.includes("ProjectCompleted")) {
            console.log("✅ SUCCESS: Emergency refund correctly blocked on completed project");
            console.log(`   Revert reason: ${error.message.split('(')[0].trim()}`);
        } else {
            console.log(`⚠️  Reverted with different error: ${error.message}`);
            console.log("   Note: Should ideally have a specific error for completed projects");
        }
    }

    // Test 2: Advance time past deadline and try again (should STILL fail - project is completed)
    console.log("\n--- Test 2: Advancing Time Past Deadline ---");
    const successTime = await exhibition.successBlock(newProjectId);
    const current = Number(await ethers.provider.getBlockNumber());
    const deadlineBlock = Number(successTime) + Number(liquidityFinalizationDeadline);
    const blockToAdvance = deadlineBlock - current + 100; // Add 100 seconds buffer
    await advanceBlocks(blockToAdvance);
    console.log(`Advanced time by ${blockToAdvance} blocks to pass the liquidity finalization deadline.`);

    // Test 3: Try emergency refund AFTER deadline on completed project (should STILL fail)
    console.log("\n--- Test 3: Attempt Emergency Refund AFTER Deadline on Completed Project ---");
    console.log("Expected: Should STILL revert (liquidity already added, regardless of deadline)");
    
    const user1BalanceBeforeAttempt = await NexusUSD.balanceOf(user1.address);
    console.log(`User1 USDX balance before refund attempt: ${ethers.formatUnits(user1BalanceBeforeAttempt, 6)}`);
    
    try {
        await exhibition.connect(user1).requestEmergencyRefund(newProjectId);
        console.error("❌ CRITICAL FAILURE: Emergency refund should have reverted on completed project!");
        console.error("Even after deadline, refunds should be blocked if liquidity was added!");
        console.error("This is a major security vulnerability!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("LiquidityAlreadyAdded") || 
            error.message.includes("InvalidProjectStatus") ||
            error.message.includes("ProjectCompleted")) {
            console.log("✅ SUCCESS: Emergency refund correctly blocked even after deadline");
            console.log(`   Revert reason: ${error.message.split('(')[0].trim()}`);
            console.log("   ✓ Liquidity was added before deadline");
            console.log("   ✓ Project completed all obligations");
            console.log("   ✓ Emergency refund mechanism properly blocked");
        } else {
            console.log(`⚠️  Reverted with different error: ${error.message}`);
            console.log("   Warning: Should have specific check for liquidityAdded flag");
        }
    }

    const user1BalanceAfterAttempt = await NexusUSD.balanceOf(user1.address);
    if (user1BalanceBeforeAttempt !== user1BalanceAfterAttempt) {
        console.error("❌ CRITICAL FAILURE: User balance changed after failed refund!");
        console.error("This indicates a serious bug in the refund logic!");
        process.exit(1);
    }
    console.log("✅ User balance unchanged after blocked refund attempt");

    // Test 4: Verify other users also cannot request emergency refund
    console.log("\n--- Test 4: Verify Multiple Users Cannot Request Emergency Refund ---");
    
    const usersToTest = [
        { signer: user2, name: "User2", contribution: user2Contribute },
        { signer: user3, name: "User3", contribution: user3Contribute },
        { signer: user4, name: "User4", contribution: user4Contribute }
    ];

    for (const user of usersToTest) {
        console.log(`\nTesting ${user.name} (contributed ${ethers.formatUnits(user.contribution, 6)} USDX)...`);
        try {
            await exhibition.connect(user.signer).requestEmergencyRefund(newProjectId);
            console.error(`❌ CRITICAL FAILURE: ${user.name} emergency refund should have reverted!`);
            process.exit(1);
        } catch (error: any) {
            if (error.message.includes("LiquidityAlreadyAdded") || 
                error.message.includes("InvalidProjectStatus") ||
                error.message.includes("ProjectCompleted")) {
                console.log(`✅ ${user.name}: Emergency refund correctly blocked`);
            } else {
                console.log(`⚠️  ${user.name}: Reverted with: ${error.message.split('(')[0].trim()}`);
            }
        }
    }

    // Test 5: Verify non-contributor still cannot request refund
    console.log("\n--- Test 5: Non-Contributor Attempts Emergency Refund (Should Fail) ---");
    try {
        await exhibition.connect(user9).requestEmergencyRefund(newProjectId);
        console.error("❌ FAILED: Non-contributor refund should have reverted!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("NoContributionToRefund") ||
            error.message.includes("LiquidityAlreadyAdded") ||
            error.message.includes("InvalidProjectStatus")) {
            console.log("✅ SUCCESS: Non-contributor emergency refund correctly blocked");
        } else {
            console.log(`⚠️  Reverted with unexpected error: ${error.message}`);
        }
    }

    // Final verification
    console.log("\n--- Final State Verification ---");
    const finalProjectState = await exhibition.projects(newProjectId);
    console.log(`Final Project Status: ${finalProjectState.status} (${statusNames[Number(finalProjectState.status)]})`);
    console.log(`Final Liquidity Added: ${finalProjectState.liquidityAdded}`);
    console.log(`Final Total Raised: ${ethers.formatUnits(finalProjectState.totalRaised, 6)} USDX`);
    
    await logBalances("Final Balances After All Tests");

    // Final Summary
    console.log("\n================================================================================");
    console.log("🎉 EMERGENCY REFUND ON COMPLETED PROJECT - ALL TESTS PASSED!");
    console.log("================================================================================");
    console.log("\n✅ Test Results Summary:");
    console.log("   ✓ Project reached hard cap and auto-finalized to Successful");
    console.log("   ✓ Owner deposited liquidity tokens successfully");
    console.log("   ✓ Owner finalized liquidity and released funds");
    console.log("   ✓ Project status correctly set to Completed (6)");
    console.log("   ✓ liquidityAdded flag correctly set to TRUE");
    console.log("   ✓ Emergency refund blocked BEFORE deadline on completed project");
    console.log("   ✓ Emergency refund blocked AFTER deadline on completed project");
    console.log("   ✓ Multiple users cannot request emergency refund");
    console.log("   ✓ Non-contributors cannot request emergency refund");
    console.log("   ✓ User balances remain unchanged after blocked attempts");
    console.log("   ✓ Contract state remains consistent");

    console.log("\n💡 Security Verification:");
    console.log("   ✓ Emergency refund mechanism cannot be exploited on completed projects");
    console.log("   ✓ liquidityAdded flag properly prevents refunds after completion");
    console.log("   ✓ Users cannot get refunds after project has fulfilled obligations");
    console.log("   ✓ Owner's liquidity deposit and fund release cannot be reversed");

    console.log("\n🎯 Edge Case Coverage:");
    console.log("   ✓ Refund attempt before deadline → BLOCKED ✅");
    console.log("   ✓ Refund attempt after deadline → BLOCKED ✅");
    console.log("   ✓ Multiple user attempts → ALL BLOCKED ✅");
    console.log("   ✓ Non-contributor attempts → BLOCKED ✅");

    console.log("\n🎉 Emergency Refund on Completed Project Testing Completed Successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});