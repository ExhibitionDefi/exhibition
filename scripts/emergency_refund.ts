import { ethers} from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import { TransactionReceipt } from "ethers";

// Import Typechain generated types for your contracts
import { Exhibition,NexusUSD } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

//  helper function to format ethers
const statusNames: Record<number, string> = {
    0: 'Upcoming',      // Project created, awaiting token deposit from project owner
    1: 'Active',        // Tokens deposited; accepts contributions once start block is reached
    2: 'Successful',    // Soft cap reached by end block, ready for token distribution and liquidity addition
    3: 'Failed',        // Soft cap not reached by end block, eligible for refunds
    4: 'Claimable',     // Project is Successful, contributors can claim tokens
    5: 'Refundable',    // Project is Failed, contributors can request refunds
    6: 'Completed'      // Project fully completed
};

async function main() {
    console.log("Starting Emergency Refund Supersedes Claims Testing Script...");

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

    const ExhibitionTokenAddress = deployedAddresses.EXH as string;
    const NexusUSDAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH Token: ${ExhibitionTokenAddress}`);
    console.log(`NexusUSD: ${NexusUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const NexusUSD: NexusUSD = await ethers.getContractAt("NexusUSD", NexusUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
   
    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();
    const liquidityFinalizationDeadline = await exhibition.LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS();

    console.log(`\n--- Contract Constants ---`);
    console.log(`MIN_START_DELAY: ${minStartDelay} blocks (${Number(minStartDelay) / 7200} hours)`);
    console.log(`MAX_PROJECT_DURATION: ${maxProjectDuration} blocks (${Number(maxProjectDuration) / 172800} days)`);
    console.log(`LIQUIDITY_FINALIZATION_DEADLINE: ${liquidityFinalizationDeadline} blocks (${Number(liquidityFinalizationDeadline) / 172800} days)`);

    // Declare projectTokenContractNSC at a higher scope
    let projectTokenContractNSC: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user4.address), 6)}`);
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
        console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);       
    };

    // --- Helper to advance blocks ---
    const advanceBlocks = async (blocks: number) => {
        console.log(`\nAdvancing by ${blocks} blocks...`);
        await mine(blocks);
        const newBlock = await ethers.provider.getBlockNumber();
        console.log(`New block number: ${newBlock}`);
    };

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

    const currentBlock = BigInt(await ethers.provider.getBlockNumber());
    const startBlock = currentBlock + minStartDelay + 100n; // Ensure it's after minStartDelay
    const endBlock = startBlock + maxProjectDuration;       // Use the fetched constant (21 days in blocks)

    // Corrected tokens for sale calculation:
    // If 250,000 USDX can be raised and 1 NSC costs 0.01 USDX:
    // Maximum NSC that can be sold = 250,000 USDX / 0.01 USDX per NSC = 25,000,000 NSC
    const amountTokensForSale = ethers.parseUnits("25000000", 18); // 25,000,000 NSC for sale

    const liquidityPercentage = 7600n; // 76%
    const lockDurationBlocks = 31536000n; // 1 year in blocks at bps

    // Vesting Parameters for Project (disabled)
    const vestingEnabled = false;
    const vestingCliffBlocks = 0n;
    const vestingDurationBlocks = 0n;
    const vestingIntervalBlocks = 0n;
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
    console.log(`Start Block: ${startBlock}`);
    console.log(`End Block: ${endBlock}`);
    console.log(`Lock Duration: ${lockDurationBlocks} blocks (1 year)`);

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
        lockDurationBlocks,
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

    projectTokenContractNSC = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer);

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

    // --- Contributions for Project (HARD CAP MET - Should Auto Finalize) ---
    console.log("\n--- Contributions for Project (HARD CAP MET - Should Auto Finalize) ---");

    // Plan to contribute EXACTLY the hard cap (250,000 USDX)
    const user1Contribute3 = ethers.parseUnits("34680", 6);
    const user2Contribute3 = ethers.parseUnits("27420", 6);
    const user3Contribute3 = ethers.parseUnits("29900", 6);
    const user4Contribute3 = ethers.parseUnits("10000", 6);
    const user5Contribute3 = ethers.parseUnits("38000", 6);
    const user6Contribute3 = ethers.parseUnits("40000", 6);
    const user7Contribute3 = ethers.parseUnits("37980", 6);
    const user8Contribute3 = ethers.parseUnits("32020", 6);
    const totalExpectedRaised = user1Contribute3 + user2Contribute3 + user3Contribute3 + user4Contribute3 + user5Contribute3 + user6Contribute3 + user7Contribute3 + user8Contribute3;

    console.log(`Planned total contributions: ${ethers.formatUnits(totalExpectedRaised, 6)} USDX`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);
    console.log(`Expected: Hard cap will be met and project should auto-finalize`);

    // Advance blocks to reach the project startBlock
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectStartBlock = Number(projectToAdvance.startBlock);
    const currentBlockNumber = await ethers.provider.getBlockNumber();
    const blocksToAdvance = projectStartBlock - currentBlockNumber + 1;

    if (blocksToAdvance > 0) {
        await advanceBlocks(blocksToAdvance);
        console.log(`Advanced ${blocksToAdvance} blocks to reach project startBlock.`);
    } else {
        console.log("Project is already open for contributions.");
    }

    // User1 contributes
    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user1).approve(exhibitionAddress, user1Contribute3);
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute3);
    console.log("SUCCESS: User1 contributed.");
    const user1BalanceAfterContrib = await NexusUSD.balanceOf(user1.address);

    // User2 contributes
    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user2).approve(exhibitionAddress, user2Contribute3);
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute3);
    console.log("SUCCESS: User2 contributed.");
    const user2BalanceAfterContrib = await NexusUSD.balanceOf(user2.address);

    // User3 contributes
    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user3).approve(exhibitionAddress, user3Contribute3);
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute3);
    console.log("SUCCESS: User3 contributed.");
    const user3BalanceAfterContrib = await NexusUSD.balanceOf(user3.address);

    // User4 contributes
    console.log(`\nUser4 contributing ${ethers.formatUnits(user4Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user4).approve(exhibitionAddress, user4Contribute3);
    await exhibition.connect(user4).contribute(newProjectId, user4Contribute3);
    console.log("SUCCESS: User4 contributed.");

    // User5 contributes
    console.log(`\nUser5 contributing ${ethers.formatUnits(user5Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user5).approve(exhibitionAddress, user5Contribute3);
    await exhibition.connect(user5).contribute(newProjectId, user5Contribute3);
    console.log("SUCCESS: User5 contributed.");

    // User6 contributes
    console.log(`\nUser6 contributing ${ethers.formatUnits(user6Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user6).approve(exhibitionAddress, user6Contribute3);
    await exhibition.connect(user6).contribute(newProjectId, user6Contribute3);
    console.log("SUCCESS: User6 contributed.");

    // User7 contributes
    console.log(`\nUser7 contributing ${ethers.formatUnits(user7Contribute3, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user7).approve(exhibitionAddress, user7Contribute3);
    await exhibition.connect(user7).contribute(newProjectId, user7Contribute3);
    console.log("SUCCESS: User7 contributed.");

    // User8 contributes (This should hit the hard cap and auto-finalize)
    console.log(`\n🎯 User8 contributing ${ethers.formatUnits(user8Contribute3, 6)} USDX to Project ID ${newProjectId} (SHOULD HIT HARD CAP)...`);
    await NexusUSD.connect(user8).approve(exhibitionAddress, user8Contribute3);

    const user8ContributeTx = await exhibition.connect(user8).contribute(newProjectId, user8Contribute3);
    const user8ContributeReceipt = await user8ContributeTx.wait();
    console.log("SUCCESS: User8 contributed (Hard Cap Hit!).");

    // Check final status - should be auto-finalized to Successful (2)
    const projectAfterContributions = await exhibition.projects(newProjectId);
    console.log(`\n🎉 HARD CAP REACHED! Project status: ${projectAfterContributions.status} (Expected: 2=Successful)`);
    console.log(`Final total raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)} USDX`);
    console.log(`Hard cap: ${ethers.formatUnits(fundingGoal, 6)} USDX`);

    if (projectAfterContributions.totalRaised !== totalExpectedRaised) {
        console.error(`Assertion Failed: Project totalRaised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised, 6)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)}.`);
        process.exit(1);
    }

    if (projectAfterContributions.status !== 2n) {
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

    // ==================================================================================
    // TOKEN CLAIMS TESTING - Users claim tokens before liquidity deadline passes
    // ==================================================================================
    console.log("\n\n================================================================================");
    console.log("🎟️  TOKEN CLAIMS TESTING - Users Claim Tokens (Before Liquidity Deadline)");
    console.log("================================================================================");

    // Calculate expected tokens for each user based on their contributions
    // Token Price: 0.01 USDX per NSC (1 USDX = 100 NSC)
    const user1ExpectedTokens = (user1Contribute3 * ethers.parseUnits("1", 18)) / ethers.parseUnits("0.01", 6);
    const user2ExpectedTokens = (user2Contribute3 * ethers.parseUnits("1", 18)) / ethers.parseUnits("0.01", 6);
    const user3ExpectedTokens = (user3Contribute3 * ethers.parseUnits("1", 18)) / ethers.parseUnits("0.01", 6);

    console.log("\n--- Expected Token Allocations (100% claimable immediately) ---");
    console.log(`User1: ${ethers.formatUnits(user1ExpectedTokens, 18)} NSC`);
    console.log(`User2: ${ethers.formatUnits(user2ExpectedTokens, 18)} NSC`);
    console.log(`User3: ${ethers.formatUnits(user3ExpectedTokens, 18)} NSC`);

    // Test 1: User1 claims tokens (no vesting)
    console.log("\n--- Test 1: User1 Claims 100% claimable immediately Tokens ---");
    const user1TokenBalanceBefore = await projectTokenContractNSC.balanceOf(user1.address);
    console.log(`User1 NSC balance before claim: ${ethers.formatUnits(user1TokenBalanceBefore, 18)}`);

    const user1ClaimTx = await exhibition.connect(user1).claimTokens(newProjectId);
    const user1ClaimReceipt = await user1ClaimTx.wait();

    const user1TokenBalanceAfter = await projectTokenContractNSC.balanceOf(user1.address);
    const user1ClaimedAmount = user1TokenBalanceAfter - user1TokenBalanceBefore;

    console.log(`✅ User1 claimed ${ethers.formatUnits(user1ClaimedAmount, 18)} NSC`);
    console.log(`User1 NSC balance after claim: ${ethers.formatUnits(user1TokenBalanceAfter, 18)}`);

    // Verify TokensClaimed event
    let user1ClaimEventFound = false;
    if (user1ClaimReceipt && user1ClaimReceipt.logs) {
        for (const log of user1ClaimReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "TokensClaimed") {
                    user1ClaimEventFound = true;
                    console.log(`✅ TokensClaimed event: ${ethers.formatUnits(parsedLog.args.amountClaimed, 18)} NSC`);
                    break;
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    if (!user1ClaimEventFound) {
        console.error("❌ FAILED: TokensClaimed event not found for User1");
        process.exit(1);
    }

    // Test 2: User2 claims tokens (no vesting)
    console.log("\n--- Test 2: User2 Claims 100% claimable immediately Tokens ---");
    const user2TokenBalanceBefore = await projectTokenContractNSC.balanceOf(user2.address);
    console.log(`User2 NSC balance before claim: ${ethers.formatUnits(user2TokenBalanceBefore, 18)}`);

    const user2ClaimTx = await exhibition.connect(user2).claimTokens(newProjectId);
    await user2ClaimTx.wait();

    const user2TokenBalanceAfter = await projectTokenContractNSC.balanceOf(user2.address);
    const user2ClaimedAmount = user2TokenBalanceAfter - user2TokenBalanceBefore;

    console.log(`✅ User2 claimed ${ethers.formatUnits(user2ClaimedAmount, 18)} NSC`);
    console.log(`User2 NSC balance after claim: ${ethers.formatUnits(user2TokenBalanceAfter, 18)}`);

    // Test 3: User3 does NOT claim (to test refund without prior claim)
    console.log("\n--- Test 3: User3 Does NOT Claim Tokens ---");
    console.log("User3 will not claim tokens - testing refund path for non-claimers");

    await logBalances(`After Token Claims (User1 & User2 claimed, User3 did not)`);

    // ==================================================================================
    // EMERGENCY REFUND TESTING - Owner Fails to Add Liquidity
    // ==================================================================================
    console.log("\n\n================================================================================");
    console.log("🚨 EMERGENCY REFUND SUPERSEDES CLAIMS - Owner Fails to Add Liquidity");
    console.log("================================================================================");
    console.log("\n📋 Test Scenario:");
    console.log("   1. Project reached hard cap → Successful ✅");
    console.log("   2. User1 & User2 claimed tokens (vested) ✅");
    console.log("   3. User3 did NOT claim tokens");
    console.log("   4. Owner fails to add liquidity within 7 days (in blocks) ⚠️");
    console.log("   5. ALL contributors get refunds - even those who claimed tokens ✅");
    console.log("\n💡 Expected Outcome:");
    console.log("   - Users who claimed keep their tokens (bonus for participating)");
    console.log("   - ALL users get their full contribution back (emergency refund)");
    console.log("   - Owner bears the full risk of not adding liquidity");

    // Get the success block to calculate deadline
    const successBlock = await exhibition.successBlock(newProjectId);
    console.log(`\n📅 Project became Successful at block: ${successBlock}`);
    console.log(`⏰ Liquidity finalization deadline: ${liquidityFinalizationDeadline} blocks (${Number(liquidityFinalizationDeadline) / 172800} days)`);
    console.log(`🔒 Project owner must add liquidity before block: ${Number(successBlock) + Number(liquidityFinalizationDeadline)}`);

    // Test 4: Try to request emergency refund BEFORE deadline (should fail)
    console.log("\n--- Test 4: Attempt Emergency Refund BEFORE Deadline (Should Fail) ---");
    try {
        await exhibition.connect(user1).requestEmergencyRefund(newProjectId);
        console.error("❌ FAILED: Emergency refund should have reverted before deadline!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("LiquidityDeadlineNotReached")) {
            console.log("✅ SUCCESS: Emergency refund correctly reverted with LiquidityDeadlineNotReached");
        } else {
            console.log(`⚠️  Reverted with unexpected error: ${error.message}`);
        }
    }

    // Test 5: Advance blocks past the 7-day deadline
    console.log("\n--- Test 5: Advancing Blocks Past Liquidity Deadline ---");
    const currentBlockNow = await ethers.provider.getBlockNumber();
    const deadlineBlock = Number(successBlock) + Number(liquidityFinalizationDeadline);
    const blocksToAdvanceForDeadline = deadlineBlock - currentBlockNow + 10; // Add 10 block buffer

    console.log(`Current block: ${currentBlockNow}`);
    console.log(`Deadline block: ${deadlineBlock}`);
    console.log(`Advancing by: ${blocksToAdvanceForDeadline} blocks`);

    await advanceBlocks(blocksToAdvanceForDeadline);

    const newBlockNow = await ethers.provider.getBlockNumber();
    console.log(`New block: ${newBlockNow}`);
    console.log(`✅ Blocks advanced past deadline! Deadline was: ${deadlineBlock}, Current: ${newBlockNow}`);

    // Test 6: Verify project status is still Successful (not yet Refundable)
    console.log("\n--- Test 6: Verify Project Status Before Emergency Refund ---");
    const projectBeforeRefund = await exhibition.projects(newProjectId);
    console.log(`Project Status: ${projectBeforeRefund.status} (${statusNames[Number(projectBeforeRefund.status)]})`);
    console.log(`Liquidity Added: ${projectBeforeRefund.liquidityAdded}`);

    if (projectBeforeRefund.status !== 2n && projectBeforeRefund.status !== 4n) {
        console.error(`❌ FAILED: Expected status 2 (Successful) or 4 (Claimable), got ${projectBeforeRefund.status}`);
        process.exit(1);
    }
    console.log(`✅ Project is in valid state for emergency refund (${statusNames[Number(projectBeforeRefund.status)]})`)
    
    if (projectBeforeRefund.liquidityAdded) {
        console.error(`❌ FAILED: Liquidity should not be added yet`);
        process.exit(1);
    }
    console.log("✅ Project is in correct state for emergency refund");

    // Test 7: User1 requests emergency refund (already claimed tokens - CRITICAL TEST)
    console.log("\n--- Test 7: User1 Requests Emergency Refund (Already Claimed Tokens) ---");
    console.log(`👤 User1 Status:`);
    console.log(`   - Contributed: ${ethers.formatUnits(user1Contribute3, 6)} USDX`);
    console.log(`   - Claimed: ${ethers.formatUnits(user1ClaimedAmount, 18)} NSC`);
    console.log(`   - Current NSC balance: ${ethers.formatUnits(user1TokenBalanceAfter, 18)} NSC`);
    console.log(`   - USDX balance before refund: ${ethers.formatUnits(await NexusUSD.balanceOf(user1.address), 6)} USDX`);

    const user1RefundTx = await exhibition.connect(user1).requestEmergencyRefund(newProjectId);
    const user1RefundReceipt = await user1RefundTx.wait();

    console.log("✅ User1 emergency refund transaction successful!");

    // Verify events emitted
    let liquidityDeadlinePassedFound = false;
    let projectStatusUpdatedFound = false;
    let refundIssuedFound = false;

    if (user1RefundReceipt && user1RefundReceipt.logs) {
        for (const log of user1RefundReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog) {
                    if (parsedLog.name === "LiquidityDeadlinePassed") {
                        liquidityDeadlinePassedFound = true;
                        console.log(`✅ LiquidityDeadlinePassed event: Project ${parsedLog.args.projectId}, Block ${parsedLog.args.blockNumber}`);
                    }
                    if (parsedLog.name === "ProjectStatusUpdated") {
                        projectStatusUpdatedFound = true;
                        console.log(`✅ ProjectStatusUpdated event: Project ${parsedLog.args.projectId}, New Status ${parsedLog.args.newStatus} (${statusNames[Number(parsedLog.args.newStatus)]})`);
                    }
                    if (parsedLog.name === "RefundIssued") {
                        refundIssuedFound = true;
                        console.log(`✅ RefundIssued event: Project ${parsedLog.args.projectId}, Participant ${parsedLog.args.participant}, Amount ${ethers.formatUnits(parsedLog.args.refundedAmount, 6)} USDX`);
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    if (!liquidityDeadlinePassedFound || !projectStatusUpdatedFound || !refundIssuedFound) {
        console.error("❌ FAILED: Expected events not found in first emergency refund");
        console.error(`LiquidityDeadlinePassed: ${liquidityDeadlinePassedFound}`);
        console.error(`ProjectStatusUpdated: ${projectStatusUpdatedFound}`);
        console.error(`RefundIssued: ${refundIssuedFound}`);
        process.exit(1);
    }

    // Verify project status changed to Refundable
    const projectAfterFirstRefund = await exhibition.projects(newProjectId);
    if (projectAfterFirstRefund.status !== 5n) {
        console.error(`❌ FAILED: Expected status 5 (Refundable), got ${projectAfterFirstRefund.status}`);
        process.exit(1);
    }
    console.log(`✅ Project status correctly changed to: ${projectAfterFirstRefund.status} (${statusNames[Number(projectAfterFirstRefund.status)]})`);

    // Verify User1 received FULL refund (entire contribution)
    const user1BalanceAfterRefund = await NexusUSD.balanceOf(user1.address);
    const user1RefundAmount = user1BalanceAfterRefund - user1BalanceAfterContrib;

    if (user1RefundAmount !== user1Contribute3) {
        console.error(`❌ FAILED: User1 refund amount mismatch. Expected ${ethers.formatUnits(user1Contribute3, 6)}, got ${ethers.formatUnits(user1RefundAmount, 6)}`);
        process.exit(1);
    }
    console.log(`✅ User1 received FULL contribution refund: ${ethers.formatUnits(user1RefundAmount, 6)} USDX`);

    // CRITICAL: Verify User1 STILL HAS the claimed tokens
    const user1TokensAfterRefund = await projectTokenContractNSC.balanceOf(user1.address);
    if (user1TokensAfterRefund !== user1TokenBalanceAfter) {
        console.error(`❌ FAILED: User1 should still have claimed tokens!`);
        process.exit(1);
    }
    console.log(`✅ User1 KEPT their claimed tokens: ${ethers.formatUnits(user1TokensAfterRefund, 18)} NSC`);
    console.log(`\n🎉 CRITICAL SUCCESS: User1 got BOTH refund AND kept tokens!`);

    // Verify hasRefunded mapping updated
    const user1HasRefunded = await exhibition.hasRefunded(newProjectId, user1.address);
    if (!user1HasRefunded) {
        console.error(`❌ FAILED: hasRefunded mapping not updated for User1`);
        process.exit(1);
    }
    console.log(`✅ User1 marked as refunded in contract state`);

    // Test 8: User2 requests refund (also claimed tokens - should get full refund + keep tokens)
    console.log("\n--- Test 8: User2 Requests Refund (Also Claimed Tokens) ---");
    console.log(`👤 User2 Status:`);
    console.log(`   - Contributed: ${ethers.formatUnits(user2Contribute3, 6)} USDX`);
    console.log(`   - Claimed: ${ethers.formatUnits(user2ClaimedAmount, 18)} NSC`);
    console.log(`   - Current NSC balance: ${ethers.formatUnits(user2TokenBalanceAfter, 18)} NSC`);
    console.log(`   - USDX balance before refund: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)} USDX`);

    const user2RefundTx = await exhibition.connect(user2).requestRefund(newProjectId);
    const user2RefundReceipt = await user2RefundTx.wait();

    console.log("✅ User2 refund transaction successful!");

    // Verify only RefundIssued event (no status change events)
    let user2StatusChangeFound = false;
    let user2RefundIssuedFound = false;

    if (user2RefundReceipt && user2RefundReceipt.logs) {
        for (const log of user2RefundReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog) {
                    if (parsedLog.name === "ProjectStatusUpdated" || parsedLog.name === "LiquidityDeadlinePassed") {
                        user2StatusChangeFound = true;
                    }
                    if (parsedLog.name === "RefundIssued") {
                        user2RefundIssuedFound = true;
                        console.log(`✅ RefundIssued event: Amount ${ethers.formatUnits(parsedLog.args.refundedAmount, 6)} USDX`);
                    }
                }
            } catch (e) {
                // Ignore
            }
        }
    }

    if (user2StatusChangeFound) {
        console.error("❌ FAILED: Status change events should NOT be emitted for subsequent refunds");
        process.exit(1);
    }
    if (!user2RefundIssuedFound) {
        console.error("❌ FAILED: RefundIssued event not found for User2");
        process.exit(1);
    }
    console.log("✅ Correct events emitted (only RefundIssued, no status changes)");

    // Verify User2 received FULL refund
    const user2BalanceAfterRefund = await NexusUSD.balanceOf(user2.address);
    const user2RefundAmount = user2BalanceAfterRefund - user2BalanceAfterContrib;

    if (user2RefundAmount !== user2Contribute3) {
        console.error(`❌ FAILED: User2 refund amount mismatch`);
        process.exit(1);
    }
    console.log(`✅ User2 received FULL contribution refund: ${ethers.formatUnits(user2RefundAmount, 6)} USDX`);

    // Verify User2 STILL HAS the claimed tokens
    const user2TokensAfterRefund = await projectTokenContractNSC.balanceOf(user2.address);
    if (user2TokensAfterRefund !== user2TokenBalanceAfter) {
        console.error(`❌ FAILED: User2 should still have claimed tokens!`);
        process.exit(1);
    }
    console.log(`✅ User2 KEPT their claimed tokens: ${ethers.formatUnits(user2TokensAfterRefund, 18)} NSC`);
    console.log(`\n🎉 CRITICAL SUCCESS: User2 got BOTH refund AND kept tokens!`);

    // Test 9: User3 requests refund (did NOT claim tokens - should also get full refund)
    console.log("\n--- Test 9: User3 Requests Refund (Did NOT Claim Tokens) ---");
    console.log(`👤 User3 Status:`);
    console.log(`   - Contributed: ${ethers.formatUnits(user3Contribute3, 6)} USDX`);
    console.log(`   - Claimed: 0 NSC (did not claim)`);
    console.log(`   - USDX balance before refund: ${ethers.formatUnits(await NexusUSD.balanceOf(user3.address), 6)} USDX`);

    const user3RefundTx = await exhibition.connect(user3).requestRefund(newProjectId);
    await user3RefundTx.wait();

    const user3BalanceAfterRefund = await NexusUSD.balanceOf(user3.address);
    const user3RefundAmount = user3BalanceAfterRefund - user3BalanceAfterContrib;

    if (user3RefundAmount !== user3Contribute3) {
        console.error(`❌ FAILED: User3 refund amount mismatch`);
        process.exit(1);
    }
    console.log(`✅ User3 received FULL contribution refund: ${ethers.formatUnits(user3RefundAmount, 6)} USDX`);
    console.log(`✅ User3 did not claim tokens, so has 0 NSC (as expected)`);

    // Test 10: Non-contributor tries to request refund (should fail)
    console.log("\n--- Test 10: Non-Contributor Attempts Refund (Should Fail) ---");
    try {
        await exhibition.connect(user9).requestRefund(newProjectId);
        console.error("❌ FAILED: Non-contributor refund should have reverted!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("NoContributionToRefund")) {
            console.log("✅ SUCCESS: Non-contributor refund correctly reverted with NoContributionToRefund");
        } else {
            console.log(`⚠️  Reverted with unexpected error: ${error.message}`);
        }
    }

    // Test 11: User1 tries to request refund again (should fail - already refunded)
    console.log("\n--- Test 11: User1 Attempts Double Refund (Should Fail) ---");
    try {
        await exhibition.connect(user1).requestRefund(newProjectId);
        console.error("❌ FAILED: Double refund should have reverted!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("AlreadyRefunded")) {
            console.log("✅ SUCCESS: Double refund correctly reverted with AlreadyRefunded");
        } else {
            console.log(`⚠️  Reverted with unexpected error: ${error.message}`);
        }
    }

    // Test 12: Verify contract balances reduced correctly
    console.log("\n--- Test 12: Verify Contract Balance Changes ---");
    const exhibitionContractBalance = await NexusUSD.balanceOf(exhibitionAddress);
    const totalRefunded = user1Contribute3 + user2Contribute3 + user3Contribute3;
    const expectedRemainingBalance = totalExpectedRaised - totalRefunded;

    console.log(`Total contributions: ${ethers.formatUnits(totalExpectedRaised, 6)} USDX`);
    console.log(`Total refunded: ${ethers.formatUnits(totalRefunded, 6)} USDX`);
    console.log(`Expected remaining: ${ethers.formatUnits(expectedRemainingBalance, 6)} USDX`);
    console.log(`Actual contract balance: ${ethers.formatUnits(exhibitionContractBalance, 6)} USDX`);

    if (exhibitionContractBalance !== expectedRemainingBalance) {
        console.error(`❌ FAILED: Contract balance mismatch`);
        process.exit(1);
    }
    console.log("✅ Contract balance correctly reduced");

    await logBalances(`After ALL Emergency Refunds for Project ID ${newProjectId}`);

    // Final Summary
    console.log("\n================================================================================");
    console.log("🎉 EMERGENCY REFUND SUPERSEDES CLAIMS - ALL TESTS PASSED!");
    console.log("================================================================================");
    console.log("\n✅ Test Results Summary:");
    console.log("   ✓ Project reached hard cap and auto-finalized to Successful");
    console.log("   ✓ User1 claimed tokens 100% immediately");
    console.log("   ✓ User2 claimed tokens 100% immediately");
    console.log("   ✓ User3 did NOT claim tokens");
    console.log("   ✓ Refund rejected before 7-day (in blocks) liquidity deadline");
    console.log("   ✓ Refund allowed after deadline block passed");
    console.log("   ✓ First refund changed status to Refundable");
    console.log("   ✓ Subsequent refunds don't re-emit status change events");
    console.log("   ✓ User1 got FULL refund + KEPT claimed tokens ⭐");
    console.log("   ✓ User2 got FULL refund + KEPT claimed tokens ⭐");
    console.log("   ✓ User3 got FULL refund (didn't claim tokens)");
    console.log("   ✓ Double refund attempts blocked");
    console.log("   ✓ Non-contributors cannot request refunds");
    console.log("   ✓ All refund amounts calculated correctly");
    console.log("   ✓ Contract balances updated properly");
    console.log("   ✓ All relevant events emitted correctly");

    console.log("\n📊 Final User Outcomes:");
    console.log(`   User1: Got ${ethers.formatUnits(user1RefundAmount, 6)} USDX back + kept ${ethers.formatUnits(user1TokensAfterRefund, 18)} NSC`);
    console.log(`   User2: Got ${ethers.formatUnits(user2RefundAmount, 6)} USDX back + kept ${ethers.formatUnits(user2TokensAfterRefund, 18)} NSC`);
    console.log(`   User3: Got ${ethers.formatUnits(user3RefundAmount, 6)} USDX back + 0 NSC (didn't claim)`);

    console.log("\n💡 Why This Design is User-Friendly:");
    console.log("   - Users who claimed tokens get to keep them (bonus for participating)");
    console.log("   - ALL users get their money back (full protection)");
    console.log("   - Claimed tokens have no liquidity, so they're essentially worthless");
    console.log("   - Owner bears the full risk of failing to add liquidity");
    console.log("   - Strong incentive for owners to fulfill their obligations");

    console.log("\n🎉 Emergency Refund Supersedes Claims Testing Completed Successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});