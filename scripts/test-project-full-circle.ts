import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import {TransactionReceipt } from "ethers";

// Import Typechain generated types for your contracts
import { Exhibition, ExhibitionToken, NexusUSD, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM, ExhibitionFactory__factory, Exhibition__factory } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

async function main() {
    console.log("Starting local Project FullCircle (USDX Contribution, addliquidity and Swap) testing script...");

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

    const ExhibitionTokenAddress = deployedAddresses.EXH as string;
    const NexusUSDAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH: ${ExhibitionTokenAddress}`);
    console.log(`NexusUSD: ${NexusUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const EXH: ExhibitionToken = await ethers.getContractAt("ExhibitionToken", ExhibitionTokenAddress, deployer);
    const NexusUSD: NexusUSD = await ethers.getContractAt("NexusUSD", NexusUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionNEX: ExhibitionNEX = await ethers.getContractAt("ExhibitionNEX", exhibitionNEXAddress, deployer);
    const exhibitionAMM: ExhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const exhibitionLPTokens: ExhibitionLPTokens = await ethers.getContractAt("ExhibitionLPTokens", exhibitionLPTokensAddress, deployer);

    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY_BLOCKS();
    const maxProjectDuration = await exhibition.MAX_END_DURATION_BLOCKS();

    // Declare projectTokenContractPOT at a higher scope
    let projectTokenContractPOT: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer EXH: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
        console.log(`Deployer exNEX: ${ethers.formatUnits(await exhibitionNEX.balanceOf(deployer.address), 18)}`);
        console.log(`User1 EXH: ${ethers.formatUnits(await EXH.balanceOf(user1.address), 18)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 EXH: ${ethers.formatUnits(await EXH.balanceOf(user2.address), 18)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 EXH: ${ethers.formatUnits(await EXH.balanceOf(user3.address), 18)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 EXH: ${ethers.formatUnits(await EXH.balanceOf(user4.address), 18)}`);
        console.log(`User4 USDX: ${ethers.formatUnits(await NexusUSD.balanceOf(user4.address), 6)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
        // Conditionally log project token balance
        if (projectTokenContractPOT) { // Check if it's initialized
            console.log(`Exhibition Contract Project Token Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);
            console.log(`Exhibition AMM Project Token Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAMMAddress), 18)}`);
        } else {
            console.log(`Exhibition Contract Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
            console.log(`Exhibition AMM Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
        }
        console.log(`Exhibition Contract exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition AMM exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAMMAddress), 18)}`);
        console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);
        console.log(`Exhibition AMM EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAMMAddress), 18)}`);
    };

    // --- Helper to advance time ---
    const advanceTime = async (seconds: number) => {
        console.log(`\nAdvancing time by ${seconds} seconds...`);
        await network.provider.send("evm_increaseTime", [seconds]);
        await network.provider.send("evm_mine"); // Mine a new block to apply time change
        const newTimestamp = (await ethers.provider.getBlock("latest"))?.timestamp;
        console.log(`New block timestamp: ${newTimestamp}`);
    };

    // --- Launchpad Project Creation Test (Scenario 3: USDX Contribution) ---
    console.log("\n--- Launchpad Project Creation Test (project fullcircle: USDX Contribution) ---");

    // Define parameters for a new launchpad project
    const projectTokenName = "ProjectThreeToken";
    const projectTokenSymbol = "POT3";
    const initialTotalSupply = ethers.parseUnits("100000000", 18); // 100 million POT3
    const projectTokenLogoURI = "https://launchpad.com/pot3_logo.png";

    const contributionTokenAddress = NexusUSDAddress; // Using USDX as contribution token
    const fundingGoal = ethers.parseUnits("10000", 6); // Hard Cap: 10000 USDX
    const softCap = ethers.parseUnits("5100", 6); // Soft Cap: 5100 USDX
    const minContribution = ethers.parseUnits("500", 6); // Minimum contribution: 500 USDX
    const maxContribution = ethers.parseUnits("2000", 6);

    // contribution token (USDX has 6 decimals) but the contract logic required 18 decimals format.
    const adjustedTokenPrice = ethers.parseUnits("0.01", 18); // 1 POT3 costs 0.01 USDX (in 6 decimals)

    const currentBlock = BigInt((await ethers.provider.getBlock("latest"))?.number || 0);
    const startBlock = currentBlock + minStartDelay + 100n;
    const endBlock = startBlock + maxProjectDuration;

    // Corrected tokens for sale calculation:
    // If 10000 USDX can be raised and 1 POT3 costs 0.01 USDX:
    // Maximum POT3 that can be sold = 10000 USDX / 0.01 USDX per POT3 = 1,000,000 POT3
    const amountTokensForSale = ethers.parseUnits("1000000", 18); // 1,000,000 POT3 for sale

    const liquidityPercentage = 7000n; // 70%
    const lockDuration = 31536000n; // 1 year in block number

    // Vesting Parameters for Project 3 (Enable vesting)in block numbers for consistency with contract logic
    const vestingEnabled = true;
    const vestingCliffBlocks = 2592000n; // 30 days cliff
    const vestingDurationBlocks = 31536000n; // 365 days vesting duration (from project start)
    const vestingIntervalBlocks = 2592000n; // 30 days interval
    const vestingInitialRelease = 2000n; // 20.00% initial release

    // ADD LOGGING FOR VERIFICATION
    console.log("\n--- Token Price Configuration ---");
    console.log(`Token Price (raw): ${adjustedTokenPrice.toString()}`);
    console.log(`Token Price (formatted): ${ethers.formatUnits(adjustedTokenPrice, 18)} USDX per POT3`);
    console.log(`Expected: 1 POT3 costs 0.01 USDX`);
    console.log(`Expected: 100 POT3 for 1 USDX`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} POT3`);
    const tokensForSaleFormatted = ethers.formatUnits(amountTokensForSale, 18);
    const tokenPriceFormatted = ethers.formatUnits(adjustedTokenPrice, 18);
    const maxRaiseFormatted = parseFloat(tokensForSaleFormatted) * parseFloat(tokenPriceFormatted);
    console.log(`Max raise at full sale: ${maxRaiseFormatted} USDX`);


    // Admin Action: Add USDX as an approved contribution token
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(contributionTokenAddress);
        console.log(`USDX (${contributionTokenAddress}) successfully added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add USDX as approved token: ${e.message}`);
        } else {
            console.log("USDX is already an approved contribution token.");
        }
    }

    console.log("Calling createLaunchpadProject for Project 3... with corrected token price");
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
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken in receipt for Project 3.");
        process.exit(1);
    }
    console.log(`Successfully created project with ID: ${newProjectId}`);
    console.log(`Newly created Project Token Address: ${newProjectTokenAddress}`);

    projectTokenContractPOT = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer); // Initialize here

    // DEBUG: Log balances before tokens for sale deposit
    console.log("\n--- DEBUG: Balances Before Tokens For Sale Deposit ---");
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);

    // Project Owner approves Exhibition to spend project tokens (for tokens for sale)
    console.log(`\nDeployer (Project Owner) is approving Exhibition contract to spend ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol} (for sale)...`);
    await projectTokenContractPOT.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("SUCCESS: Project Owner approved Exhibition to spend tokens for sale.");

    // Project Owner deposits tokens for sale and activates project
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol}...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("SUCCESS: Tokens for sale deposited and project activated.");

    // DEBUG: Log balances after tokens for sale deposit
    console.log("\n--- DEBUG: Balances After Tokens For Sale Deposit ---");
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);

    // --- Contributions for Project (Soft Cap Met, Hard Cap Not Met) ---
    console.log("\n--- Contributions for Project (Soft Cap Met, Hard Cap Not Met) ---");
    // Target: Raise 6550 USDX (soft cap 6550, below hard cap 10000)

    const user1Contribute = ethers.parseUnits("2000", 6); // User1 contributes 2000 USDX
    const user2Contribute = ethers.parseUnits("1500", 6); // User2 contributes 1500 USDX
    const user3Contribute = ethers.parseUnits("1500", 6); // User3 contributes 1500 USDX
    const user4Contribute = ethers.parseUnits("1550", 6); // User4 contributes 1550 USDX
    const totalExpectedRaised3 = user1Contribute + user2Contribute + user3Contribute + user4Contribute; // 6550 USDX

    // Ensure enough time has passed for the project to be active for contributions
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectStartBlock = Number(projectToAdvance.startBlock);
    const currentBlock1 = await ethers.provider.getBlockNumber();

    let blocksToMine = 0;
    if (currentBlock1 < projectStartBlock) {
        blocksToMine = projectStartBlock - currentBlock1 + 10;
    }

    if (blocksToMine > 0) {
        await mine(blocksToMine);
        console.log(`Mined ${blocksToMine} blocks for Project 3.`);
    } else {
        console.log("Project 3 is already open for contributions.");
    }
    
    // User1 contributes
    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user1).approve(exhibitionAddress, user1Contribute); // Approve USDX
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);
    console.log("SUCCESS: User1 contributed.");

    // User2 contributes
    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user2).approve(exhibitionAddress, user2Contribute); // Approve USDX
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);
    console.log("SUCCESS: User2 contributed.");

    // User3 contributes
    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user3).approve(exhibitionAddress, user3Contribute); // Approve USDX
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);
    console.log("SUCCESS: User3 contributed.");

     // User4 contributes
    console.log(`\nUser4 contributing ${ethers.formatUnits(user4Contribute, 6)} USDX to Project ID ${newProjectId}...`);
    await NexusUSD.connect(user4).approve(exhibitionAddress, user4Contribute); // Approve USDX
    await exhibition.connect(user4).contribute(newProjectId, user4Contribute);
    console.log("SUCCESS: User4 contributed.");


    await logBalances(`After Contributions for Project ID ${newProjectId}`);
    const projectAfterContributions = await exhibition.projects(newProjectId);
    if (projectAfterContributions.totalRaised !== totalExpectedRaised3) {
        console.error(`Assertion Failed: Project 3 totalRaised incorrect. Expected ${ethers.formatUnits(totalExpectedRaised3, 6)}, got ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)}.`);
        process.exit(1);
    }
    console.log(`Project 3 Total Raised: ${ethers.formatUnits(projectAfterContributions.totalRaised, 6)} (Expected: ${ethers.formatUnits(totalExpectedRaised3, 6)})`);
    console.log(`Project 3 Status: ${projectAfterContributions.status} (Expected: Active (1))`); // Should still be Active if hard cap not hit
    if (projectAfterContributions.status !== 1n) {
        console.error("Assertion Failed: Project 3 status should still be Active (1) if hard cap not met.");
        process.exit(1);
    }
    console.log("SUCCESS: Project 3 contributions verified.");

    // --- Finalize Project 3 (Soft Cap Met) ---
    console.log(`\n--- Finalize Project ID ${newProjectId} (Soft Cap Met) ---`);
    // We convert to Number since it returns a BigInt
    const blocksRemaining = Number(await exhibition.getProjectBlocksRemaining(newProjectId));

    if (blocksRemaining > 0) { 
        // We must mine blocks, not just advance time
        // We add +1 to ensure we are strictly PAST the endBlock
        const blocksToMine = blocksRemaining + 1;
    
        console.log(`Mining ${blocksToMine} blocks to reach endBlock...`);
    
        // Hardhat helper to mine multiple blocks at once
        await network.provider.send("hardhat_mine", [ethers.toBeHex(blocksToMine)]);
        const newBlock = await ethers.provider.getBlockNumber();
        console.log(`Advanced to block: ${newBlock}. Project is now closed.`);
    } else {
        console.log(`Project ID ${newProjectId} is already closed (endBlock reached).`); 
    }

    // Call finalizeProject
    console.log(`Calling finalizeProject for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).finalizeProject(newProjectId);
    console.log("SUCCESS: Project 3 finalized.");

    // Verify final status
    const projectFinalized3 = await exhibition.projects(newProjectId);
    console.log(`Project ID ${newProjectId} final status: ${projectFinalized3.status} (Expected: Successful (2))`);
    if (projectFinalized3.status !== 2n) { // Expected Successful (2)
        console.error(`Assertion Failed: Project ID ${newProjectId} final status mismatch. Expected Successful (2), got ${projectFinalized3.status}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Project 3 finalization to Successful verified.");

    // --- Liquidity Deposit and Finalization for Project 3 ---
    console.log(`\n--- Liquidity Deposit and Finalization for Project ID ${newProjectId} ---`);

    // --- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---
    console.log("\n--- 🔴 DEBUG: On-chain State Check Before Liquidity Deposit ---");
    const projectStateBeforeDeposit = await exhibition.projects(newProjectId);
    console.log(`On-chain project.totalRaised: ${ethers.formatUnits(projectStateBeforeDeposit.totalRaised, 6)} USDX`);
    console.log(`On-chain project.softCap: ${ethers.formatUnits(projectStateBeforeDeposit.softCap, 6)} USDX`);
    console.log(`On-chain project.liquidityPercentage: ${projectStateBeforeDeposit.liquidityPercentage.toString()}`);
    console.log(`On-chain project.tokenPrice: ${ethers.formatUnits(projectStateBeforeDeposit.tokenPrice, 6)} USDX per POT3`);

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

    // ✅ CORRECTION: Match the contract's _calculateTokensDue logic exactly
    const contributionDecimals = 6n; // USDX
    const projectDecimals = 18n; // POT3
    
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
    console.log(`Local Calculated Required Project Tokens for Liquidity: ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} POT3`);
    console.log("---------------------------------------------------------");

    // DEBUG: Balances before liquidity deposit
    console.log("\n--- DEBUG: Balances Before Liquidity Deposit ---");
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);

    // Project owner (deployer) mints/gets enough POT3 for liquidity if needed
    const deployerPOT3Balance = await projectTokenContractPOT.balanceOf(deployer.address);
    if (deployerPOT3Balance < requiredProjectTokensForLiquidity) {
        console.error(`ERROR: Deployer does not have enough POT3 for liquidity. Has ${ethers.formatUnits(deployerPOT3Balance, 18)}, needs ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}`);
        process.exit(1);
    }

    // Project owner approves Exhibition to spend liquidity tokens
    console.log(`\nDeployer (Project Owner) approving Exhibition to spend ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)} ${projectTokenSymbol} for liquidity...`);
    await projectTokenContractPOT.connect(deployer).approve(exhibitionAddress, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Project Owner approved Exhibition for liquidity tokens.");

    // Project owner deposits liquidity tokens
    console.log(`\nDeployer (Project Owner) calling depositLiquidityTokens for Project ID ${newProjectId}...`);
    await exhibition.connect(deployer).depositLiquidityTokens(newProjectId, requiredProjectTokensForLiquidity);
    console.log("SUCCESS: Liquidity tokens deposited by Project Owner.");

    // DEBUG: Log balances after liquidity deposit
    console.log("\n--- DEBUG: Balances After Liquidity Deposit ---");
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAMMAddress), 18)}`);

    // Verify deposit
    const depositedAmount = await exhibition.projectLiquidityTokenDeposits(newProjectId);
    // Verify that the deposited amount is what we sent
    if (depositedAmount !== requiredProjectTokensForLiquidity) {
        console.error(`Assertion Failed: Deposited liquidity amount mismatch. Expected ${ethers.formatUnits(requiredProjectTokensForLiquidity, 18)}, got ${ethers.formatUnits(depositedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Deposited liquidity amount verified.");

    // Record deployer's initial USDX balance before fund release
    const deployerInitialUSDXBalance = await NexusUSD.balanceOf(deployer.address);
    console.log(`Deployer initial USDX balance before fund release: ${ethers.formatUnits(deployerInitialUSDXBalance, 6)}`);

    // DEBUG: Log balances before finalizing liquidity and releasing funds
    console.log("\n--- DEBUG: Balances Before Finalizing Liquidity & Releasing Funds ---");
    console.log(`Deployer USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(deployer.address), 6)}`);
    console.log(`Deployer POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(deployer.address), 18)}`);
    console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAddress), 6)}`);
    console.log(`Exhibition Contract POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAddress), 18)}`);
    console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await NexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);
    console.log(`Exhibition AMM POT3 Balance: ${ethers.formatUnits(await projectTokenContractPOT.balanceOf(exhibitionAMMAddress), 18)}`);

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

    // Verify deployer's final USDX balance (should include remaining funds + platform fee)
    const deployerFinalUSDXBalance = await NexusUSD.balanceOf(deployer.address);
    // The expected payout is now based on the net raised AFTER the fee and AFTER the liquidity portion
    const totalExpectedIncrease = expectedDeployerPayout;
    const actualIncrease = deployerFinalUSDXBalance - deployerInitialUSDXBalance;

    console.log(`Deployer final USDX balance: ${ethers.formatUnits(deployerFinalUSDXBalance, 6)}`);
    console.log(`Expected owner payout: ${ethers.formatUnits(expectedDeployerPayout, 6)} USDX`);
    console.log(`Expected platform fee payout: ${ethers.formatUnits(platformFeeAmount, 6)} USDX`);
    console.log(`Total expected increase for Deployer: ${ethers.formatUnits(totalExpectedIncrease, 6)} USDX`);
    console.log(`Actual increase for Deployer: ${ethers.formatUnits(actualIncrease, 6)} USDX`);

    // Allow for minor floating point discrepancies if any, by comparing BigInts directly
    if (actualIncrease !== totalExpectedIncrease) {
        console.error(`Assertion Failed: Deployer USDX balance increase incorrect. Expected ${ethers.formatUnits(totalExpectedIncrease, 6)}, got ${ethers.formatUnits(actualIncrease, 6)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Deployer's USDX balance increase verified (owner payout).");

    // Verify FundsReleasedToProjectOwner event
    let fundsReleasedEventFound = false;
    if (finalizeLiquidityReceipt && finalizeLiquidityReceipt.logs) {
        for (const log of finalizeLiquidityReceipt.logs) {
            try {
                const parsedLog = exhibition.interface.parseLog(log as any);
                if (parsedLog && parsedLog.name === "FundsReleasedToProjectOwner" && parsedLog.args.projectOwner === deployer.address) {
                    fundsReleasedEventFound = true;
                    // ✅ CORRECTION: Use correct 6 decimals for USDX in log
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


    // --- Swap Test on ExhibitionAMM (EXH for POT3) ---
    console.log("\n--- Swap Test on ExhibitionAMM (USDX for POT3) ---");

    const swapAmountUSDX = ethers.parseUnits("477", 6); // User1 wants to swap 477 USDX
    // Calculate expected POT3 out based on AMM's current reserves
    // Formula: amountOut = (amountIn * reserveOut * 997) / (reserveIn * 1000 + amountIn * 997)
    // Assuming 0.3% fee (997/1000)
    const ammUSDXReserveBeforeSwap = await NexusUSD.balanceOf(exhibitionAMMAddress);
    const ammPot3ReserveBeforeSwap = await projectTokenContractPOT.balanceOf(exhibitionAMMAddress);

    if (ammUSDXReserveBeforeSwap === 0n || ammPot3ReserveBeforeSwap === 0n) {
        console.error("ERROR: AMM has zero reserves for USDX or POT3. Cannot perform swap. This might mean liquidity wasn't added correctly or AMM not initialized with these pairs.");
        process.exit(1);
    }

    const expectedPot3Out = (swapAmountUSDX * ammPot3ReserveBeforeSwap * 997n) / (ammUSDXReserveBeforeSwap * 1000n + swapAmountUSDX * 997n);
    const minOutAmountPOT3 = expectedPot3Out * 99n / 100n; // Allow 1% slippage for test (99% of expected)

    console.log(`AMM USDX Reserve before swap: ${ethers.formatUnits(ammUSDXReserveBeforeSwap, 6)}`);
    console.log(`AMM POT3 Reserve before swap: ${ethers.formatUnits(ammPot3ReserveBeforeSwap, 18)}`);
    console.log(`Expected POT3 out: ${ethers.formatUnits(expectedPot3Out, 18)}`);
    console.log(`Minimum POT3 out for swap: ${ethers.formatUnits(minOutAmountPOT3, 18)}`);


    // Capture User1's balances BEFORE the swap transaction
    const user1USDXBalanceBeforeSwap = await NexusUSD.balanceOf(user1.address);
    const user1Pot3BalanceBeforeSwap = await projectTokenContractPOT.balanceOf(user1.address);

    console.log(`User1 initial USDX balance: ${ethers.formatUnits(user1USDXBalanceBeforeSwap, 6)}`);
    console.log(`User1 initial POT3 balance: ${ethers.formatUnits(user1Pot3BalanceBeforeSwap, 18)}`);


    // User1 approves AMM to spend USDX
    console.log(`User1 approving ExhibitionAMM (${exhibitionAMMAddress}) to spend ${ethers.formatUnits(swapAmountUSDX, 6)} USDX for swap...`);
    await NexusUSD.connect(user1).approve(exhibitionAMMAddress, swapAmountUSDX);
    console.log("SUCCESS: User1 approved AMM for USDX swap.");

    const currentBlock2 = await ethers.provider.getBlockNumber();
    const swapDeadline = BigInt(currentBlock2) + 600n;

    // Perform the swap (USDX for POT3)
    console.log(`User1 calling swapTokenForToken on AMM to swap ${ethers.formatUnits(swapAmountUSDX, 6)} USDX for POT3 with deadline ${swapDeadline}...`);
    await exhibitionAMM.connect(user1).swapTokenForToken(
        NexusUSDAddress,        // _tokenIn (address)
        newProjectTokenAddress, // _tokenOut (address)
        swapAmountUSDX,          // _amountIn (uint256)
        minOutAmountPOT3,       // _minAmountOut (uint256)
        user1.address,          // _to (address)
        swapDeadline            // _deadline (uint256)
    );
    console.log("SUCCESS: User1 performed swap on AMM.");

    // Verify balances after swap
    const user1FinalUSDXBalance = await NexusUSD.balanceOf(user1.address);
    const user1FinalPot3Balance = await projectTokenContractPOT.balanceOf(user1.address);
    const ammFinalUSDXBalance = await NexusUSD.balanceOf(exhibitionAMMAddress);
    const ammFinalPot3Balance = await projectTokenContractPOT.balanceOf(exhibitionAMMAddress);

    console.log(`User1 final USDX balance: ${ethers.formatUnits(user1FinalUSDXBalance, 6)}`);
    console.log(`User1 final POT3 balance: ${ethers.formatUnits(user1FinalPot3Balance, 18)}`);
    console.log(`AMM final USDX balance: ${ethers.formatUnits(ammFinalUSDXBalance, 6)}`);
    console.log(`AMM final POT3 balance: ${ethers.formatUnits(ammFinalPot3Balance, 18)}`);

    // Assertion 1: User1's USDX balance should have decreased
    if (user1FinalUSDXBalance >= user1USDXBalanceBeforeSwap) {
        console.error("Assertion Failed: User1 USDX balance did not decrease after swap.");
        process.exit(1);
    }
    // Assertion 2: User1's POT3 balance should have increased
    if (user1FinalPot3Balance <= user1Pot3BalanceBeforeSwap) {
        console.error("Assertion Failed: User1 POT3 balance did not increase after swap.");
        process.exit(1);
    }
    // Assertion 3: POT3 received should be at least minOutAmountPOT3
    // The amount received by the user is (user1FinalPot3Balance - user1Pot3BalanceBeforeSwap)
    if ((user1FinalPot3Balance - user1Pot3BalanceBeforeSwap) < minOutAmountPOT3) {
        console.error(`Assertion Failed: User1 received less POT3 than minOutAmount. Expected at least ${ethers.formatUnits(minOutAmountPOT3, 18)}, got ${ethers.formatUnits(user1FinalPot3Balance - user1Pot3BalanceBeforeSwap, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: Swap operation verified (balances changed as expected and min amount met).");


   // --- Claiming Tests for Project ID 3 (with Vesting) ---
   console.log(`\n--- Claiming Tests for Project ID ${newProjectId} (with Vesting) ---`);

   // Calculate total POT3 tokens due for all Users using the SAME logic as the contract
   const user1ContributionAmountForClaim = await exhibition.contributions(newProjectId, user1.address);
   const user2ContributionAmountForClaim = await exhibition.contributions(newProjectId, user2.address);

   // Step 1: Normalize contribution to 18 decimals (like the contract does)
   const user1normalizedContribution = user1ContributionAmountForClaim * scaleFactor;
   const user2normalizedContribution = user2ContributionAmountForClaim * scaleFactor;

   // Step 2: Apply the same calculation as the contract
   const user1TotalPOT3Due = (user1normalizedContribution * projectTokenScaleFactor) / adjustedTokenPrice;
   const user2TotalPOT3Due = (user2normalizedContribution * projectTokenScaleFactor) / adjustedTokenPrice;
   
   console.log(`User1 contribution amount: ${ethers.formatUnits(user1ContributionAmountForClaim, 6)} USDX`);
   console.log(`Normalized contribution (18 decimals): ${ethers.formatUnits(user1normalizedContribution, 18)}`);
   console.log(`Token price: ${ethers.formatUnits(adjustedTokenPrice, 18)}`);
   console.log(`Calculated POT3 due to User1: ${ethers.formatUnits(user1TotalPOT3Due, 18)}`);

   console.log(`User2 contribution amount: ${ethers.formatUnits(user2ContributionAmountForClaim, 6)} USDX`);
   console.log(`Normalized contribution (18 decimals): ${ethers.formatUnits(user2normalizedContribution, 18)}`);
   console.log(`Token price: ${ethers.formatUnits(adjustedTokenPrice, 18)}`);
   console.log(`Calculated POT3 due to User2: ${ethers.formatUnits(user2TotalPOT3Due, 18)}`);

   const currentProjectStatusBeforeClaim = (await exhibition.projects(newProjectId)).status;
   console.log(`DEBUG: Project ID ${newProjectId} status BEFORE claim attempt: ${currentProjectStatusBeforeClaim}`);

   // DEBUG LOG: Check vestingEnabled flag for the project
   const project3Details = await exhibition.projects(newProjectId);
   console.log(`DEBUG: Project ID ${newProjectId} vestingEnabled: ${project3Details.vestingEnabled}`);

   // DEBUG: Log Exhibition contract's POT3 balance before claims
   const exhibitionPot3BalanceBeforeClaims = await projectTokenContractPOT.balanceOf(exhibitionAddress);
   console.log(`DEBUG: Exhibition Contract POT3 Balance before claims: ${ethers.formatUnits(exhibitionPot3BalanceBeforeClaims, 18)}`);

   // Users attempts to claim immediately (should get initial release only)
   console.log("\nUser1 attempting first claim (should get initial release)...");
   const user1BalanceBeforeFirstClaimAttempt = await projectTokenContractPOT.balanceOf(user1.address);

    await exhibition.connect(user1).claimTokens(newProjectId);
   const user1POT3BalanceAfterFirstClaim = await projectTokenContractPOT.balanceOf(user1.address);
   const user1FirstclaimedAmount= user1POT3BalanceAfterFirstClaim - user1BalanceBeforeFirstClaimAttempt;
   console.log(`User1 claimed ${ethers.formatUnits(user1FirstclaimedAmount, 18)} POT3 in first claim.`);

   console.log("\nUser2 attempting first claim (should get initial release)...");
   const user2BalanceBeforeFirstClaimAttempt = await projectTokenContractPOT.balanceOf(user2.address);

   await exhibition.connect(user2).claimTokens(newProjectId);
   const user2POT3BalanceAfterFirstClaim = await projectTokenContractPOT.balanceOf(user2.address);
   const user2FirstclaimedAmount = user2POT3BalanceAfterFirstClaim - user2BalanceBeforeFirstClaimAttempt;
   console.log(`User2 claimed ${ethers.formatUnits(user2FirstclaimedAmount, 18)} POT3 in first claim.`);

   const initialuser1ReleasePercentage = Number(project3Details.vestingInitialRelease) / 10000; // Convert 2000 to 0.20
   const expectedInitialuser1Release = user1TotalPOT3Due * BigInt(Math.floor(initialuser1ReleasePercentage * 10000)) / 10000n;
   console.log(`Expected initial release for User1: ${ethers.formatUnits(expectedInitialuser1Release, 18)} POT3.`);

   if (user1FirstclaimedAmount !== expectedInitialuser1Release) {
        console.error(`Assertion Failed: User1 first claim amount incorrect. Expected ${ethers.formatUnits(expectedInitialuser1Release, 18)}, got ${ethers.formatUnits(user1FirstclaimedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: User1 first claim (initial release) verified.");

   const initialuser2ReleasePercentage = Number(project3Details.vestingInitialRelease) / 10000; // Convert 2000 to 0.20
   const expectedInitialuser2Release = user2TotalPOT3Due * BigInt(Math.floor(initialuser2ReleasePercentage * 10000)) / 10000n;
   console.log(`Expected initial release for User2: ${ethers.formatUnits(expectedInitialuser2Release, 18)} POT3.`);

   if (user2FirstclaimedAmount !== expectedInitialuser2Release) {
        console.error(`Assertion Failed: User1 first claim amount incorrect. Expected ${ethers.formatUnits(expectedInitialuser2Release, 18)}, got ${ethers.formatUnits(user2FirstclaimedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: User2 first claim (initial release) verified.");

   // 1. Get the target from your function
   const info = await exhibition.getUserVestingInfo(newProjectId, user1.address);
   const current = BigInt(await ethers.provider.getBlockNumber());
   const nextClaimBlock = BigInt(info.nextClaimBlock);

   if (current < nextClaimBlock) {
      const blocksToMine = nextClaimBlock - current;
      await mine(blocksToMine);
    }
    console.log(`Mined ${current < nextClaimBlock ? blocksToMine : 0} blocks to reach next claim block (${nextClaimBlock}). Current block is now ${await ethers.provider.getBlockNumber()}.`);

    // User1 attempts second claim (should get more tokens linearly)
    console.log("\nUser1 attempting second claim (should get linear release)...");
    const user1BalanceBeforeSecondClaim = await projectTokenContractPOT.balanceOf(user1.address);
    await exhibition.connect(user1).claimTokens(newProjectId);
    const user1BalanceAfterSecondClaim = await projectTokenContractPOT.balanceOf(user1.address);
    const claimedAmountSecond = user1BalanceAfterSecondClaim - user1BalanceBeforeSecondClaim;
    console.log(`User1 claimed ${ethers.formatUnits(claimedAmountSecond, 18)} POT3 in second claim.`);

    // Let's verify it's greater than 0 and less than remaining.
    if (claimedAmountSecond <= 0n) {
        console.error("Assertion Failed: User1 second claim amount should be greater than 0.");
        process.exit(1);
    }
    const user1VestingInfo = await exhibition.vestingInfo(newProjectId, user1.address);
    console.log(`User1 total claimed for project 3: ${ethers.formatUnits(user1VestingInfo.releasedAmount, 18)} POT3.`);

    if (user1VestingInfo.releasedAmount <= user1FirstclaimedAmount) {
        console.error("Assertion Failed: User1 total claimed amount did not increase after second claim.");
        process.exit(1);
    }
    console.log("SUCCESS: User1 second claim (linear release) verified.");

    // User2 attempts second claim (should get more tokens linearly)
    console.log("\nUser2 attempting second claim (should get linear release)...");
    const user2BalanceBeforeSecondClaim = await projectTokenContractPOT.balanceOf(user2.address);
    await exhibition.connect(user2).claimTokens(newProjectId);
    const user2BalanceAfterSecondClaim = await projectTokenContractPOT.balanceOf(user2.address);
    const user2claimedAmountSecond = user2BalanceAfterSecondClaim - user2BalanceBeforeSecondClaim;
    console.log(`User2 claimed ${ethers.formatUnits(user2claimedAmountSecond, 18)} POT3 in second claim.`);

    // Let's verify it's greater than 0 and less than remaining.
    if (user2claimedAmountSecond <= 0n) {
        console.error("Assertion Failed: User2 second claim amount should be greater than 0.");
        process.exit(1);
    }
    const user2VestingInfo = await exhibition.vestingInfo(newProjectId, user2.address);
    console.log(`User2 total claimed for project 3: ${ethers.formatUnits(user2VestingInfo.releasedAmount, 18)} POT3.`);
    // The total claimed amount in vestingInfo should be the sum of claimed amounts,
    // NOT necessarily directly comparable to the balance if they also received tokens from swap.
    // We compare against the total vested amount from contributions.
    if (user2VestingInfo.releasedAmount <= user2FirstclaimedAmount) {
        console.error("Assertion Failed: User2 total claimed amount did not increase after second claim.");
        process.exit(1);
    }
    console.log("SUCCESS: User2 second claim (linear release) verified.");

    // Advance time to end of vesting duration
    const durationBlocks = Number(project3Details.vestingDurationBlocks);
    const MineToBlocks =(durationBlocks + 10); // Advance past full duration
    await mine(MineToBlocks);
    console.log(`Mined ${MineToBlocks} blocks to reach block ${await ethers.provider.getBlockNumber()}`);

    // User1 attempts final claim (should get all remaining tokens)
    console.log("\nUser1 attempting final claim (should get all remaining tokens)...");
    const user1BalanceBeforeFinalClaim = await projectTokenContractPOT.balanceOf(user1.address);
    await exhibition.connect(user1).claimTokens(newProjectId);
    const user1BalanceAfterFinalClaim = await projectTokenContractPOT.balanceOf(user1.address);
    const claimedAmountFinal = user1BalanceAfterFinalClaim - user1BalanceBeforeFinalClaim;
    console.log(`User1 claimed ${ethers.formatUnits(claimedAmountFinal, 18)} POT3 in final claim.`);

    const user1VestingInfoFinal = await exhibition.vestingInfo(newProjectId, user1.address);
    console.log(`User1 final total claimed for project 3: ${ethers.formatUnits(user1VestingInfoFinal.releasedAmount, 18)} POT3.`);

    if (user1VestingInfoFinal.releasedAmount !== user1TotalPOT3Due) {
        console.error(`Assertion Failed: User1 did not claim all tokens. Expected ${ethers.formatUnits(user1TotalPOT3Due, 18)}, got ${ethers.formatUnits(user1VestingInfoFinal.releasedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: User1 final claim (all remaining tokens) verified.");

    // User1 attempts to claim again after full claim (should fail)
    console.log("\nUser1 attempting to claim again after full claim (expecting failure)...");
    try {
        await exhibition.connect(user1).claimTokens(newProjectId);
        console.log("ERROR: User1 unexpectedly claimed tokens again after full claim.");
        process.exit(1);
    } catch (error: any) {
        console.log(`SUCCESS: User1's claim failed as expected: ${error.message}`);
        if (!error.message.includes("NoTokensCurrentlyVested()")) {
            console.log("WARNING: Expected 'NoTokensCurrentlyVested()' error, but got a different one.");
        }
    }

    // User2 attempts final claim (should get all remaining tokens)
    console.log("\nUser2 attempting final claim (should get all remaining tokens)...");
    const user2BalanceBeforeFinalClaim = await projectTokenContractPOT.balanceOf(user2.address);
    await exhibition.connect(user2).claimTokens(newProjectId);
    const user2BalanceAfterFinalClaim = await projectTokenContractPOT.balanceOf(user2.address);
    const user2claimedAmountFinal = user2BalanceAfterFinalClaim - user2BalanceBeforeFinalClaim;
    console.log(`User2 claimed ${ethers.formatUnits(user2claimedAmountFinal, 18)} POT3 in final claim.`);

    const user2VestingInfoFinal = await exhibition.vestingInfo(newProjectId, user2.address);
    console.log(`User2 final total claimed for project 3: ${ethers.formatUnits(user2VestingInfoFinal.releasedAmount, 18)} POT3.`);

    if (user2VestingInfoFinal.releasedAmount !== user2TotalPOT3Due) {
        console.error(`Assertion Failed: User2 did not claim all tokens. Expected ${ethers.formatUnits(user2TotalPOT3Due, 18)}, got ${ethers.formatUnits(user2VestingInfoFinal.releasedAmount, 18)}.`);
        process.exit(1);
    }
    console.log("SUCCESS: User2 final claim (all remaining tokens) verified.");

    // User2 attempts to claim again after full claim (should fail)
    console.log("\nUser2 attempting to claim again after full claim (expecting failure)...");
    try {
        await exhibition.connect(user2).claimTokens(newProjectId);
        console.log("ERROR: User2 unexpectedly claimed tokens again after full claim.");
        process.exit(1);
    } catch (error: any) {
        console.log(`SUCCESS: User2's claim failed as expected: ${error.message}`);
        if (!error.message.includes("NoTokensCurrentlyVested()")) {
            console.log("WARNING: Expected 'NoTokensCurrentlyVested()' error, but got a different one.");
        }
    }
    console.log("\nProject Scenario 3 (USDX Contribution, addliquidity, swap and claim) testing script finished successfully!");
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
