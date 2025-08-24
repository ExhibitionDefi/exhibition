import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { TransactionReceipt } from "ethers";

// Import Typechain generated types for your contracts
import { Exhibition, Exh, ExhibitionUSDT, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

// Helper function to format status names
const statusNames: Record<number, string> = {
    0: 'Upcoming',      // Project created, waiting for startTime
    1: 'Active',        // Project is live and accepting contributions
    2: 'FundingEnded',  // endTime passed OR fundingGoal (hardcap) reached
    3: 'Successful',    // Project met its softCap during FundingEnded phase
    4: 'Failed',        // Project did not meet its softCap during FundingEnded phase
    5: 'Claimable',     // Project is Successful, contributors can claim tokens
    6: 'Refundable',    // Project is Failed, contributors can request refunds
    7: 'Completed'      // Project fully completed
};

async function main() {
    console.log("🎉 Starting local Project Scenario (EXH Contribution - HARD CAP MET - Auto Finalization, Liquidity with Lock, Swap) testing script...");

    // Get all 5 signers from Hardhat's configured accounts
    const [deployer, user1, user2, user3, user4] = await ethers.getSigners();

    console.log(`🔍 Testing with Deployer account: ${deployer.address}`);
    console.log(`🔍 Testing with User1 account: ${user1.address}`);
    console.log(`🔍 Testing with User2 account: ${user2.address}`);
    console.log(`🔍 Testing with User3 account: ${user3.address}`);
    console.log(`🔍 Testing with User4 account: ${user4.address}`);

    // --- Load deployed addresses ---
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`🚫 Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const exhTokenAddress = deployedAddresses.ExhToken as string;
    const exhibitionUSDTAddress = deployedAddresses.ExhibitionUSDT as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`Exh Token: ${exhTokenAddress}`);
    console.log(`ExhibitionUSDT: ${exhibitionUSDTAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const exhToken: Exh = await ethers.getContractAt("Exh", exhTokenAddress, deployer);
    const exhibitionUSDT: ExhibitionUSDT = await ethers.getContractAt("ExhibitionUSDT", exhibitionUSDTAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionNEX: ExhibitionNEX = await ethers.getContractAt("ExhibitionNEX", exhibitionNEXAddress, deployer);
    const exhibitionAMM: ExhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const exhibitionLPTokens: ExhibitionLPTokens = await ethers.getContractAt("ExhibitionLPTokens", exhibitionLPTokensAddress, deployer);

    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY();
    const maxProjectDuration = await exhibition.MAX_PROJECT_DURATION();

    // Declare projectTokenContractNEB at a higher scope
    let projectTokenContractNEB: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer EXH: ${ethers.formatUnits(await exhToken.balanceOf(deployer.address), 18)}`);
        console.log(`Deployer exUSDT: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(deployer.address), 6)}`);
        console.log(`Deployer exNEX: ${ethers.formatUnits(await exhibitionNEX.balanceOf(deployer.address), 18)}`);
        console.log(`User1 EXH: ${ethers.formatUnits(await exhToken.balanceOf(user1.address), 18)}`);
        console.log(`User1 exUSDT: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(user1.address), 6)}`);
        console.log(`User2 EXH: ${ethers.formatUnits(await exhToken.balanceOf(user2.address), 18)}`);
        console.log(`User2 exUSDT: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(user2.address), 6)}`);
        console.log(`User3 EXH: ${ethers.formatUnits(await exhToken.balanceOf(user3.address), 18)}`);
        console.log(`User3 exUSDT: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(user3.address), 6)}`);
        console.log(`User4 EXH: ${ethers.formatUnits(await exhToken.balanceOf(user4.address), 18)}`);
        console.log(`User4 exUSDT: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(user4.address), 6)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await exhToken.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition Contract exUSDT Balance: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(exhibitionAddress), 6)}`);
        if (projectTokenContractNEB) {
            console.log(`Exhibition Contract Project Token Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);
            console.log(`Exhibition AMM Project Token Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAMMAddress), 18)}`);
        } else {
            console.log(`Exhibition Contract Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
            console.log(`Exhibition AMM Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
        }
        console.log(`Exhibition Contract exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition AMM exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAMMAddress), 18)}`);
        console.log(`Exhibition AMM exUSDT Balance: ${ethers.formatUnits(await exhibitionUSDT.balanceOf(exhibitionAMMAddress), 6)}`);
        console.log(`Exhibition AMM EXH Balance: ${ethers.formatUnits(await exhToken.balanceOf(exhibitionAMMAddress), 18)}`);
    };

    // --- Helper to advance time ---
    const advanceTime = async (seconds: number) => {
        console.log(`\n⏳ Advancing time by ${seconds} seconds...`);
        await network.provider.send("evm_increaseTime", [seconds]);
        await network.provider.send("evm_mine");
        const newTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
        console.log(`New block timestamp: ${newTimestamp}`);
    };

    // --- Initial Faucet Requests for Users in This Test ---
    console.log("\n💧 Requesting Faucet Tokens for Users in this Test ---");
    await exhibition.connect(user1).requestFaucetTokens();
    await exhibition.connect(user2).requestFaucetTokens();
    await exhibition.connect(user3).requestFaucetTokens();
    await exhibition.connect(user4).requestFaucetTokens();
    await logBalances("After Faucet Requests for Project (Hard Cap Test)");

    // --- Launchpad Project Creation Test (EXH Contribution - HARD CAP MET) ---
    console.log("\n🚀 Launchpad Project Creation Test (EXH Contribution - HARD CAP MET) ---");

    // Define parameters for a new launchpad project
    const projectTokenName = "Nexus Builder";
    const projectTokenSymbol = "NEB";
    const initialTotalSupply = ethers.parseUnits("500000000", 18); // 500 Million NEB
    const projectTokenLogoURI = "https://launchpad.com/NEB_logo.png";

    const contributionTokenAddress = exhTokenAddress; // Using EXH as contribution token
    const fundingGoal = ethers.parseUnits("125000", 18); // Hard Cap: 125,000 EXH (18 decimals)
    const softCap = ethers.parseUnits("65000", 18); // Soft Cap: 65,000 EXH (18 decimals)
    const minContribution = ethers.parseUnits("100", 18); // Minimum contribution: 100 EXH
    const maxContribution = ethers.parseUnits("50000", 18); // Maximum contribution: 50,000 EXH

    const adjustedTokenPrice = ethers.parseUnits("0.0005", 18); // 1 NEB costs 0.0005 EXH (18 decimals)

    const currentTimestamp0 = BigInt((await ethers.provider.getBlock("latest"))?.timestamp || Math.floor(Date.now() / 1000));
    const startTime = currentTimestamp0 + minStartDelay + 100n; // Ensure it's after minStartDelay
    const endTime = startTime + maxProjectDuration; // Use the fetched constant (7 days)

    const amountTokensForSale = ethers.parseUnits("250001000", 18); // 250,001,000 NEB for sale
    const liquidityPercentage = 7600n; // 76%
    const lockDuration = 365n * 24n * 60n * 60n; // 1 year

    // No vesting parameters
    const vestingEnabled = false;
    const vestingCliff = 0n;
    const vestingDuration = 0n;
    const vestingInterval = 0n;
    const vestingInitialRelease = 0n;

    // ADD LOGGING FOR VERIFICATION
    console.log("\n💰 Token Price Configuration ---");
    console.log(`Token Price (raw): ${adjustedTokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(adjustedTokenPrice, 18)} EXH per NEB`);
    console.log(`Expected: 1 NEB costs 0.0005 EXH`);
    console.log(`Expected: 2000 NEB for 1 EXH`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} NEB`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 18)} EXH`);
    console.log(`Soft Cap: ${ethers.formatUnits(softCap, 18)} EXH`);

    // Admin Action: Add EXH as an approved contribution token
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(contributionTokenAddress);
        console.log(`✅ EXH (${contributionTokenAddress}) successfully added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`⚠️ Warning: Could not add EXH as approved token: ${e.message}`);
        } else {
            console.log("✅ EXH is already an approved contribution token.");
        }
    }

    console.log("🚀 Calling createLaunchpadProject for Nexus Builder... with corrected token price");
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
        startTime,
        endTime,
        amountTokensForSale,
        liquidityPercentage,
        lockDuration,
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
        console.error("🚫 ERROR: Could not find ProjectCreated event or projectId/projectToken in receipt for Project.");
        process.exit(1);
    }
    console.log(`✅ Successfully created project with ID: ${newProjectId}`);
    console.log(`Newly created Project Token Address: ${newProjectTokenAddress}`);

    projectTokenContractNEB = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer); // Initialize here

    // DEBUG: Log balances before tokens for sale deposit
    console.log("\n🔍 DEBUG: Balances Before Tokens For Sale Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Project Owner approves Exhibition to spend project tokens (for tokens for sale)
    console.log(`\n🔄 Deployer (Project Owner) is approving Exhibition contract to spend ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol} (for sale)...`);
    await projectTokenContractNEB.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("✅ SUCCESS: Project Owner approved Exhibition to spend tokens for sale.");

    // Project Owner deposits tokens for sale and activates project
    console.log(`\n🔄 Calling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol}...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("✅ SUCCESS: Tokens for sale deposited and project activated.");

    // DEBUG: Log balances after tokens for sale deposit
    console.log("\n🔍 DEBUG: Balances After Tokens For Sale Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // --- Contributions for Project (HARD CAP MET - Should Auto Finalize) ---
    console.log("\n💸 Contributions for Project (HARD CAP MET - Should Auto Finalize) ---");

    // Plan to contribute EXACTLY the hard cap (125,000 EXH)
    const user1Contribute = ethers.parseUnits("43111", 18); // User1 contributes 43,111 EXH
    const user2Contribute = ethers.parseUnits("27102", 18); // User2 contributes 27,102 EXH
    const user3Contribute = ethers.parseUnits("27001", 18); // User3 contributes 27,001 EXH
    const user4Contribute = ethers.parseUnits("27786", 18); // User4 contributes 27,786 EXH
    const totalExpectedRaised = user1Contribute + user2Contribute + user3Contribute + user4Contribute; // 125,000 EXH

    console.log(`Planned total contributions: ${ethers.formatUnits(totalExpectedRaised, 18)} EXH`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 18)} EXH`);
    console.log(`Expected: Hard cap will be met and project should auto-finalize`);

    // Ensure enough time has passed for the project to be active for contributions
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectStartTime = Number(projectToAdvance.startTime);
    const currentBlockTimestamp = Number(await time.latest());
    let timeToAdvanceForContribution = 0;
    if (currentBlockTimestamp < projectStartTime) {
        timeToAdvanceForContribution = projectStartTime - currentBlockTimestamp + 10;
    }
    if (timeToAdvanceForContribution > 0) {
        await advanceTime(timeToAdvanceForContribution);
        console.log(`⏳ Advanced time by ${timeToAdvanceForContribution} seconds for Project.`);
    } else {
        console.log("✅ Project is already open for contributions.");
    }

    // User1 contributes
    console.log(`\n💸 User1 contributing ${ethers.formatUnits(user1Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await exhToken.connect(user1).approve(exhibitionAddress, user1Contribute); // Approve EXH
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);
    console.log("✅ SUCCESS: User1 contributed.");

    // Check status after User1
    let projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User1: ${projectStatus.status} (1=Active, 3=Successful)`);
    console.log(`Total raised after User1: ${ethers.formatUnits(projectStatus.totalRaised, 18)} EXH`);

    // User2 contributes
    console.log(`\n💸 User2 contributing ${ethers.formatUnits(user2Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await exhToken.connect(user2).approve(exhibitionAddress, user2Contribute); // Approve EXH
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);
    console.log("✅ SUCCESS: User2 contributed.");

    // Check status after User2
    projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User2: ${projectStatus.status} (1=Active, 3=Successful)`);
    console.log(`Total raised after User2: ${ethers.formatUnits(projectStatus.totalRaised, 18)} EXH`);

    // User3 contributes
    console.log(`\n💸 User3 contributing ${ethers.formatUnits(user3Contribute, 18)} EXH to Project ID ${newProjectId}...`);
    await exhToken.connect(user3).approve(exhibitionAddress, user3Contribute); // Approve EXH
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);
    console.log("✅ SUCCESS: User3 contributed.");

    // Check status after User3
    projectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status after User3: ${projectStatus.status} (1=Active, 3=Successful)`);
    console.log(`Total raised after User3: ${ethers.formatUnits(projectStatus.totalRaised, 18)} EXH`);

    // User4 contributes (This should hit the hard cap and auto-finalize)
    console.log(`\n🎯 User4 contributing ${ethers.formatUnits(user4Contribute, 18)} EXH to Project ID ${newProjectId} (SHOULD HIT HARD CAP)...`);
    await exhToken.connect(user4).approve(exhibitionAddress, user4Contribute); // Approve EXH
    const user4ContributeTx = await exhibition.connect(user4).contribute(newProjectId, user4Contribute);
    const user4ContributeReceipt = await user4ContributeTx.wait();
    console.log("✅ SUCCESS: User4 contributed (Hard Cap Hit!).");

    // Check final status - should be auto-finalized to Successful (3)
    const projectAfterContributions = await exhibition.projects(newProjectId);
    console.log(`\n🎉 HARD CAP REACHED! Project status: ${projectAfterContributions.status} (Expected: 3=Successful)`);
    console.log(`Final total raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 18)} EXH`);
    console.log(`Hard cap: ${ethers.formatUnits(fundingGoal, 18)} EXH`);

    // Verify the project was auto-finalized
    if (projectAfterContributions.totalRaised !== totalExpectedRaised) {
        console.error(`🚫 Assertion Failed: Project totalRaised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised, 18)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 18)}.`);
        process.exit(1);
    }

    if (projectAfterContributions.status !== 3n) { // Should be Successful (3) due to auto-finalization
        console.error(`🚫 Assertion Failed: Project should be auto-finalized to Successful (3), but got status ${projectAfterContributions.status}.`);
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
                    console.log(`✅ ProjectFinalized event emitted: Project ID ${parsedLog.args.projectId}, Status ${parsedLog.args.newStatus} (${statusNames[Number(parsedLog.args.newStatus)]})`);
                    break;
                }
            } catch (e) {
                // Ignore logs that cannot be parsed by this interface
            }
        }
    }

    if (!projectFinalizedEventFound) {
        console.warn("⚠️ Warning: ProjectFinalized event not found in contribution transaction logs.");
    } else {
        console.log("✅ SUCCESS: ProjectFinalized event verified in auto-finalization.");
    }

    await logBalances(`After Hard Cap Contributions for Project ID ${newProjectId}`);

    // --- UPDATED: Liquidity Deposit and Finalization for Project ---
    console.log(`\n🔄 UPDATED: Liquidity Deposit and Finalization for Project ID ${newProjectId} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId);
    console.log(`On-chain project.totalRaised: ${ethers.formatUnits(projectStateBeforeDeposit.totalRaised, 18)} EXH`);
    console.log(`On-chain project.softCap: ${ethers.formatUnits(projectStateBeforeDeposit.softCap, 18)} EXH`);
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
    const contributionDecimals = 18n; // EXH
    const projectDecimals = 18n; // NEB

    // Step 1: Normalize contribution to 18 decimals (already in 18 for EXH)
    const scaleFactor = 10n ** (18n - contributionDecimals); // 10^0 = 1
    const normalizedContribution = contributionTokensForLiquidity * scaleFactor;

    // Step 2: Apply the same calculation as the contract
    const projectTokenScaleFactor = 10n ** projectDecimals;
    const requiredProjectTokensForLiquidity = (normalizedContribution * projectTokenScaleFactor) / tokenPriceOnChain;

    const expectedDeployerPayout = netRaisedAfterFee - contributionTokensForLiquidity;

    console.log("\n--- 🟢 DEBUG: Local Recalculation using Corrected Logic ---");
    console.log(`Local Calculated Platform Fee: ${ethers.formatUnits(platformFeeAmount, 18)} EXH`);
    console.log(`Local Calculated Net Raised After Fee: ${ethers.formatUnits(netRaisedAfterFee, 18)} EXH`);
    console.log(`Local Calculated Contribution Tokens for Liquidity: ${ethers.formatUnits(contributionTokensForLiquidity, 18)} EXH`);
    console.log(`Normalized Contribution (18 decimals): ${ethers.formatUnits(normalizedContribution, 18)}`);
    console.log(`Local Calculated Required Project Tokens for Liquidity: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} NEB`);
    console.log("---------------------------------------------------------");

    // DEBUG: Balances before liquidity deposit
    console.log("\n🔍 DEBUG: Balances Before Liquidity Deposit ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Project owner (deployer) mints/gets enough NEB for liquidity if needed
    const deployerNEBBalance = await projectTokenContractNEB.balanceOf(deployer.address);
    if (deployerNEBBalance < requiredProjectTokensForLiquidity) {
        console.error(`🚫 ERROR: Deployer does not have enough NEB for liquidity. Has ${ethers.formatUnits(deployerNEBBalance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // --- NEW: Step 1 - Project owner deposits liquidity tokens using depositLiquidityTokens ---
    console.log(`\n🔄 STEP 1: Depositing Liquidity Tokens for Project ID ${newProjectId}`);
    console.log(`Deployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol} for liquidity deposit...`);
    await projectTokenContractNEB.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("✅ SUCCESS: Project Owner approved Exhibition for liquidity token deposit.");

    // Call the new depositLiquidityTokens function
    console.log(`\n🔄 Deployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).depositLiquidityTokens(newProjectId, requiredProjectTokensForLiquidity);
    console.log("✅ SUCCESS: Liquidity tokens deposited by Project Owner via depositLiquidityTokens.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n🔍 DEBUG: Balances After depositLiquidityTokens ---");
    console.log(`Deployer NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract NEB Balance: ${ethers.formatUnits(await projectTokenContractNEB.balanceOf(exhibitionAddress), 18)}`);

    // Verify deposit amount in contract mapping
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId);
    if (depositedAmount !== requiredProjectTokensForLiquidity) {
        console.error(`🚫 Assertion Failed: Deposited liquidity amount mismatch. Expected ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}, got ${ethers.formatUnits(depositedAmount, 18)}.`);
        process.exit(1);
    }
    console.log(`✅ SUCCESS: Deposited liquidity amount verified: ${ethers.formatUnits(depositedAmount, 18)} NEB`);

    // Record deployer's initial EXH balance before fund release
    const deployerInitialEXHBalance = await exhToken.balanceOf(deployer.address);
    console.log(`Deployer initial EXH balance before fund release: ${ethers.formatUnits(deployerInitialEXHBalance, 18)}`);

    const currentTimestampBeforeFinalization = await time.latest();
    console.log(`Current timestamp before finalization: ${currentTimestampBeforeFinalization}`);

    // --- NEW: Step 2 - Finalize liquidity and release funds using the updated function ---
    console.log(`\n🔄 STEP 2: Finalizing Liquidity and Releasing Funds for Project ID ${newProjectId}`);
    console.log("\n🔍 DEBUG: Balances Before Finalizing Liquidity & Releasing Funds ---");
    await logBalances("DEBUG: Balances Before Finalizing Liquidity & Releasing Funds");

    // Call the updated finalizeLiquidityAndReleaseFunds function
    console.log(`\n🔄 Calling finalizeLiquidityAndReleaseFunds for Project ID ${newProjectId}...`);
    const finalizeLiquidityTxResponse = await exhibition.connect(deployer).finalizeLiquidityAndReleaseFunds(newProjectId);
    const finalizeLiquidityReceipt: TransactionReceipt | null = await finalizeLiquidityTxResponse.wait();
    console.log("✅ SUCCESS: Liquidity finalized and funds released via updated finalizeLiquidityAndReleaseFunds.");

    // Verify project status is Completed
    const projectCompleted = await exhibition.projects(newProjectId);
    console.log(`Project ID ${newProjectId} final status: ${projectCompleted.status} (Expected: Completed (7))`);
    if (projectCompleted.status !== 7n) { // Expected Completed (7)
        console.error(`🚫 Assertion Failed: Project ID ${newProjectId} final status mismatch. Expected Completed (7), got ${projectCompleted.status}.`);
        process.exit(1);
    }
    if (!projectCompleted.liquidityAdded) {
        console.error("🚫 Assertion Failed: project.liquidityAdded flag is false.");
        process.exit(1);
    }
    console.log("✅ SUCCESS: Project status updated to Completed and liquidityAdded flag set.");

    // Verify deployer's final EXH balance (should include remaining funds + platform fee)
    const deployerFinalEXHBalance = await exhToken.balanceOf(deployer.address);
    const totalExpectedIncrease = expectedDeployerPayout + platformFeeAmount;
    const actualIncrease = deployerFinalEXHBalance - deployerInitialEXHBalance;

    console.log(`Deployer final EXH balance: ${ethers.formatUnits(deployerFinalEXHBalance, 18)}`);
    console.log(`Expected owner payout: ${ethers.formatUnits(expectedDeployerPayout, 18)} EXH`);
    console.log(`Expected platform fee payout: ${ethers.formatUnits(platformFeeAmount, 18)} EXH`);
    console.log(`Total expected increase for Deployer: ${ethers.formatUnits(totalExpectedIncrease, 18)} EXH`);
    console.log(`Actual increase for Deployer: ${ethers.formatUnits(actualIncrease, 18)} EXH`);

    if (actualIncrease !== totalExpectedIncrease) {
        console.error(`🚫 Assertion Failed: Deployer EXH balance increase incorrect. Expected ${ethers.formatUnits(totalExpectedIncrease, 18)}, got ${ethers.formatUnits(actualIncrease, 18)}.`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: Deployer's EXH balance increase verified (includes owner payout + platform fee).");

    // Verify FundsReleasedToProjectOwner event
    let fundsReleasedEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "FundsReleasedToProjectOwner" && parsedLog.args.projectOwner === deployer.address) {
                    fundsReleasedEventFound = true;
                    console.log(`✅ FundsReleasedToProjectOwner event emitted: Project ID ${parsedLog.args.projectId}, Owner ${parsedLog.args.projectOwner}, Amount ${ethers.formatUnits(parsedLog.args.amountReleased, 18)}`);
                    if (parsedLog.args.amountReleased !== expectedDeployerPayout) {
                        console.error(`🚫 Assertion Failed: FundsReleasedToProjectOwner amount mismatch. Expected ${ethers.formatUnits(expectedDeployerPayout, 18)}, got ${ethers.formatUnits(parsedLog.args.amountReleased, 18)}.`);
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
        console.error("🚫 ERROR: FundsReleasedToProjectOwner event not found.");
        process.exit(1);
    }
    console.log("✅ SUCCESS: FundsReleasedToProjectOwner event verified.");

    // Verify PlatformFeeCollected event
    let platformFeeEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "PlatformFeeCollected" && parsedLog.args.recipient === deployer.address) {
                    platformFeeEventFound = true;
                    console.log(`✅ PlatformFeeCollected event emitted: Project ID ${parsedLog.args.projectId}, Token ${parsedLog.args.tokenAddress}, Amount ${ethers.formatUnits(parsedLog.args.amount, 18)}, Recipient ${parsedLog.args.recipient}`);
                    if (parsedLog.args.amount !== platformFeeAmount) {
                        console.error(`🚫 Assertion Failed: PlatformFeeCollected amount mismatch. Expected ${ethers.formatUnits(platformFeeAmount, 18)}, got ${ethers.formatUnits(parsedLog.args.amount, 18)}.`);
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
        console.error("🚫 ERROR: PlatformFeeCollected event not found.");
        process.exit(1);
    }
    console.log("✅ SUCCESS: PlatformFeeCollected event verified.");

    console.log(`\n🔒 Testing Liquidity Lock Functionality ---`);

    // --- NEW: Verify liquidity lock was created ---
    console.log(`\n🔍 Verifying Liquidity Lock Creation ---`);

    // --- Users Claim Tokens ---
    console.log("\n🔄 Users Claiming Tokens...");
    const users = [user1, user2, user3, user4];
    for (const user of users) {
        const tx = await exhibition.connect(user).claimTokens(newProjectId);
        await tx.wait();
        const nebBalance = await projectTokenContractNEB.balanceOf(user.address);
        console.log(`✅ ${user.address} claimed ${ethers.formatUnits(nebBalance, 18)} NEB`);
    }

    // --- User1 Adds Liquidity ---
    console.log("\n🔄 User1 Adding Liquidity to EXH/NEB Pool...");
    const user1ExhBalance = await exhToken.balanceOf(user1.address);
    const user1NebBalance = await projectTokenContractNEB.balanceOf(user1.address);
    const ammExhReserve = await exhToken.balanceOf(exhibitionAMMAddress);
    const ammNebReserve = await projectTokenContractNEB.balanceOf(exhibitionAMMAddress);

    const exhAmount = ethers.parseUnits("500", 18); // 500 EXH
    const nebAmount = (exhAmount * ammNebReserve) / ammExhReserve; // Proportional NEB

    if (user1ExhBalance < exhAmount || user1NebBalance < nebAmount) {
        console.error(`🚫 User1 has insufficient funds: EXH ${ethers.formatUnits(user1ExhBalance, 18)}, NEB ${ethers.formatUnits(user1NebBalance, 18)}`);
        process.exit(1);
    }

    await exhToken.connect(user1).approve(exhibitionAMMAddress, exhAmount);
    await projectTokenContractNEB.connect(user1).approve(exhibitionAMMAddress, nebAmount);
    const txAddLiquidity = await exhibitionAMM.connect(user1).addLiquidity(
        exhTokenAddress,                // _tokenA
        newProjectTokenAddress,            // _tokenB
        exhAmount,                      // _amountADesired
        nebAmount,                      // _amountBDesired
        ethers.parseUnits("475", 18),   // _amountAMin (5% slippage tolerance)
        nebAmount * 95n / 100n,         // _amountBMin (5% slippage tolerance)
        user1.address,                  // _to (recipient of LP tokens)
        BigInt(Math.floor(Date.now() / 1000) + 3600) // _deadline (1-hour deadline as BigInt)
    );
    await txAddLiquidity.wait();
    console.log("✅ User1 added liquidity successfully");

    const user1LPBalance = await exhibitionLPTokens.balanceOf(exhTokenAddress, newProjectTokenAddress, user1.address);
    console.log(`User1 LP Balance: ${ethers.formatUnits(user1LPBalance, 18)}`);

    // --- Verify Liquidity Locks ---
    console.log("\n🔍 Verifying Liquidity Lock Status...");

    // Check Project Owner's Liquidity (should still be locked)
    const isDeployerLocked = await exhibitionAMM.isLiquidityLocked(newProjectTokenAddress, exhTokenAddress, deployer.address);
    console.log(`Project Owner Liquidity Locked: ${isDeployerLocked} (Expected: true)`);
    if (!isDeployerLocked) {
        console.error("🚫 Assertion Failed: Project owner's liquidity should be locked.");
        process.exit(1);
    }

    const deployerWithdrawable = await exhibitionAMM.getWithdrawableLPAmount(newProjectTokenAddress, exhTokenAddress, deployer.address);
    console.log(`Deployer Withdrawable LP: ${ethers.formatUnits(deployerWithdrawable, 18)} (Expected: 0)`);

    // Check User1's Liquidity (should not be locked)
    const isUser1Locked = await exhibitionAMM.isLiquidityLocked(newProjectTokenAddress, exhTokenAddress, user1.address);
    console.log(`User1 Liquidity Locked: ${isUser1Locked} (Expected: false)`);
    if (isUser1Locked) {
        console.error("🚫 Assertion Failed: User1's liquidity should not be locked.");
        process.exit(1);
    }

    const user1Withdrawable = await exhibitionAMM.getWithdrawableLPAmount(newProjectTokenAddress, exhTokenAddress, user1.address);
    console.log(`User1 Withdrawable LP: ${ethers.formatUnits(user1Withdrawable, 18)} (Expected: matches LP balance)`);
    if (user1Withdrawable !== user1LPBalance) {
        console.error(`🚫 Assertion Failed: User1 withdrawable LP (${ethers.formatUnits(user1Withdrawable, 18)}) does not match LP balance (${ethers.formatUnits(user1LPBalance, 18)})`);
        process.exit(1);
    }

    console.log("\n🎉 Test Completed Successfully!");
    console.log("✅ Verified: Hard cap met, users claimed tokens, User1 added unlocked liquidity, Project owner liquidity remains locked.");
}

// Helper function to log balances
async function logBalances(label: string) {
    const [deployer, user1, user2, user3, user4] = await ethers.getSigners();
    console.log(`\n--- ${label} Balances ---`);
    console.log(`Deployer EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", deployer).then(c => c.balanceOf(deployer.address)), 18)}`);
    console.log(`User1 EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", user1).then(c => c.balanceOf(user1.address)), 18)}`);
    console.log(`User2 EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", user2).then(c => c.balanceOf(user2.address)), 18)}`);
    console.log(`User3 EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", user3).then(c => c.balanceOf(user3.address)), 18)}`);
    console.log(`User4 EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", user4).then(c => c.balanceOf(user4.address)), 18)}`);
    console.log(`Exhibition EXH: ${ethers.formatUnits(await ethers.getContractAt("Exh", "0xae6E4b95F2A40664B397298da5eb72e1BaC95482", deployer).then(c => c.balanceOf("0xBdEB859F3D9a7a2a74a172864b40ceF9778C193e")), 18)}`);
}

main().catch((error) => {
    console.error("🚫 Error:", error);
    process.exit(1);
});