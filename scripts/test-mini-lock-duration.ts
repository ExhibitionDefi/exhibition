import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { TransactionReceipt } from "ethers";

// Import Typechain generated types for your contracts
import { Exhibition, ExhibitionToken, ExhibitionUSD, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";
import { IERC20Metadata } from "../typechain-types/@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata";

async function main() {
    console.log("Starting local Project Scenario 3 (exUSD Contribution - HARD CAP MET - Auto Finalization - NO VESTING) testing script...");

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
    const exhibitionUSDAddress = deployedAddresses.ExhibitionUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH: ${ExhibitionTokenAddress}`);
    console.log(`ExhibitionUSD: ${exhibitionUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const EXH: ExhibitionToken = await ethers.getContractAt("ExhibitionToken", ExhibitionTokenAddress, deployer);
    const exhibitionUSD: ExhibitionUSD = await ethers.getContractAt("ExhibitionUSD", exhibitionUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionNEX: ExhibitionNEX = await ethers.getContractAt("ExhibitionNEX", exhibitionNEXAddress, deployer);
    const exhibitionAMM: ExhibitionAMM = await ethers.getContractAt("ExhibitionAMM", exhibitionAMMAddress, deployer);
    const exhibitionLPTokens: ExhibitionLPTokens = await ethers.getContractAt("ExhibitionLPTokens", exhibitionLPTokensAddress, deployer);

    // Fetch immutable constants from the deployed Exhibition contract
    const minStartDelay = await exhibition.MIN_START_DELAY();
    const maxProjectDuration = await exhibition.MAX_PROJECT_DURATION();

    // Declare projectTokenContractBON at a higher scope
    let projectTokenContractBON: IERC20Metadata;

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer EXH: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);
        console.log(`Deployer exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(deployer.address), 6)}`);
        console.log(`Deployer exNEX: ${ethers.formatUnits(await exhibitionNEX.balanceOf(deployer.address), 18)}`);
        console.log(`User1 EXH: ${ethers.formatUnits(await EXH.balanceOf(user1.address), 18)}`);
        console.log(`User1 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 EXH: ${ethers.formatUnits(await EXH.balanceOf(user2.address), 18)}`);
        console.log(`User2 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 EXH: ${ethers.formatUnits(await EXH.balanceOf(user3.address), 18)}`);
        console.log(`User3 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 EXH: ${ethers.formatUnits(await EXH.balanceOf(user4.address), 18)}`);
        console.log(`User4 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user4.address), 6)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition Contract exUSD Balance: ${ethers.formatUnits(await exhibitionUSD.balanceOf(exhibitionAddress), 6)}`);
        // Conditionally log project token balance
        if (projectTokenContractBON) { // Check if it's initialized
            console.log(`Exhibition Contract Project Token Balance: ${ethers.formatUnits(await projectTokenContractBON.balanceOf(exhibitionAddress), 18)}`);
            console.log(`Exhibition AMM Project Token Balance: ${ethers.formatUnits(await projectTokenContractBON.balanceOf(exhibitionAMMAddress), 18)}`);
        } else {
            console.log(`Exhibition Contract Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
            console.log(`Exhibition AMM Project Token Balance: N/A (Project Token not yet deployed/initialized)`);
        }
        console.log(`Exhibition Contract exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition AMM exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAMMAddress), 18)}`);
        console.log(`Exhibition AMM exUSD Balance: ${ethers.formatUnits(await exhibitionUSD.balanceOf(exhibitionAMMAddress), 6)}`);
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

    // --- Helper to get current timestamp with buffer ---
    const getCurrentTimestamp = async (): Promise<bigint> => {
        const block = await ethers.provider.getBlock("latest");
        return BigInt(block?.timestamp || Math.floor(Date.now() / 1000));
    };

    // --- Initial Faucet Requests for Users in This Test ---
    await logBalances("After Faucet Requests for Project Scenario 3");
    
    // --- MIN LOCK DURATION VALIDATION TEST ---
    console.log("\n--- Testing Minimum Lock Duration Validation ---");
    
    // Get the minimum lock duration from contract
    const minLockDuration = await exhibition.MIN_LOCK_DURATION();
    console.log(`Minimum required lock duration: ${Number(minLockDuration)} seconds (${Number(minLockDuration) / (24 * 60 * 60)} days)`);
    
    // Test parameters for invalid lock duration project
    const testProjectTokenName = "TestLockToken";
    const testProjectTokenSymbol = "TLT";
    const testInitialTotalSupply = ethers.parseUnits("1000000", 18);
    const testProjectTokenLogoURI = "https://test.com/logo.png";
    const testContributionTokenAddress = exhibitionUSDAddress; // Using exUSD
    const testFundingGoal = ethers.parseUnits("1000", 6); // 1000 exUSD
    const testSoftCap = ethers.parseUnits("510", 6); // 510 exUSD
    const testMinContribution = ethers.parseUnits("100", 6);
    const testMaxContribution = ethers.parseUnits("500", 6);
    const testTokenPrice = ethers.parseUnits("0.01", 18); // 0.01 exUSD per token
    
    let testCurrentTimestamp = await getCurrentTimestamp();
    const testBaseStartTime = testCurrentTimestamp + minStartDelay + 300n; // Extra buffer for tests
    const testAmountTokensForSale = ethers.parseUnits("100000", 18);
    const testLiquidityPercentage = 7000n; // 70%
    
    // Test vesting parameters (disabled)
    const testVestingEnabled = false;
    const testVestingCliff = 0n;
    const testVestingDuration = 0n;
    const testVestingInterval = 0n;
    const testVestingInitialRelease = 0n;

    // Admin Action: Add exUSD as an approved contribution token
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(testContributionTokenAddress);
        console.log(`exUSD (${testContributionTokenAddress}) successfully added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add exUSD as approved token: ${e.message}`);
        } else {
            console.log("exUSD is already an approved contribution token.");
        }
    }

    // TEST 1: Try to create project with lock duration LESS than minimum (should fail)
    const invalidLockDuration = minLockDuration - 86400n; // 1 day less than minimum
    console.log(`\n🔴 TEST 1: Attempting to create project with INVALID lock duration (${Number(invalidLockDuration)} seconds)...`);
    
    const testStartTime1 = testBaseStartTime + 100n;
    const testEndTime1 = testStartTime1 + maxProjectDuration;
    
    try {
        await exhibition.connect(deployer).createLaunchpadProject(
            testProjectTokenName,
            testProjectTokenSymbol,
            testInitialTotalSupply,
            testProjectTokenLogoURI,
            testContributionTokenAddress,
            testFundingGoal,
            testSoftCap,
            testMinContribution,
            testMaxContribution,
            testTokenPrice,
            testStartTime1,
            testEndTime1,
            testAmountTokensForSale,
            testLiquidityPercentage,
            invalidLockDuration, // INVALID - less than minimum
            testVestingEnabled,
            testVestingCliff,
            testVestingDuration,
            testVestingInterval,
            testVestingInitialRelease
        );
        
        console.error("❌ ASSERTION FAILED: Project creation should have failed with invalid lock duration!");
        process.exit(1);
        
    } catch (error: any) {
        if (error.message.includes("InvalidLockDuration") || 
            error.message.includes("revert") && error.message.toLowerCase().includes("lock")) {
            console.log("✅ SUCCESS: Project creation correctly failed with invalid lock duration");
            console.log(`Error message: ${error.message.split('\n')[0]}`);
        } else {
            console.error("❌ UNEXPECTED ERROR:", error.message);
            process.exit(1);
        }
    }

    // TEST 2: Try to create project with lock duration EQUAL to minimum (should succeed)
    const validLockDuration = minLockDuration;
    console.log(`\n🟡 TEST 2: Attempting to create project with MINIMUM valid lock duration (${Number(validLockDuration)} seconds)...`);
    
    const testStartTime2 = testBaseStartTime + 200n;
    const testEndTime2 = testStartTime2 + maxProjectDuration;
    
    try {
        const validTestProjectName = "ValidLockToken";
        const validTestProjectSymbol = "VLT";
        
        const validProjectTx = await exhibition.connect(deployer).createLaunchpadProject(
            validTestProjectName,
            validTestProjectSymbol,
            testInitialTotalSupply,
            testProjectTokenLogoURI,
            testContributionTokenAddress,
            testFundingGoal,
            testSoftCap,
            testMinContribution,
            testMaxContribution,
            testTokenPrice,
            testStartTime2,
            testEndTime2,
            testAmountTokensForSale,
            testLiquidityPercentage,
            validLockDuration, // VALID - exactly minimum
            testVestingEnabled,
            testVestingCliff,
            testVestingDuration,
            testVestingInterval,
            testVestingInitialRelease
        );
        
        const validProjectReceipt = await validProjectTx.wait();
        console.log("✅ SUCCESS: Project creation succeeded with minimum valid lock duration");
        
        // Extract project ID from receipt
        let validProjectId: bigint | undefined;
        if (validProjectReceipt && validProjectReceipt.logs) {
            for (const log of validProjectReceipt.logs) {
                try {
                    const parsedLog = exhibition.interface.parseLog(log as any);
                    if (parsedLog && parsedLog.name === "ProjectCreated") {
                        validProjectId = parsedLog.args.projectId;
                        break;
                    }
                } catch (e) {
                    // Ignore unparseable logs
                }
            }
        }
        
        if (validProjectId) {
            console.log(`Valid project created with ID: ${validProjectId}`);
            
            // Verify the lock duration was stored correctly
            const storedProject = await exhibition.projects(validProjectId);
            console.log(`Stored lock duration: ${Number(storedProject.lockDuration)} seconds`);
            
            if (storedProject.lockDuration === validLockDuration) {
                console.log("✅ SUCCESS: Lock duration stored correctly in project");
            } else {
                console.error("❌ ASSERTION FAILED: Stored lock duration doesn't match input");
                process.exit(1);
            }
        }
        
    } catch (error: any) {
        console.error("❌ UNEXPECTED ERROR: Valid lock duration should have succeeded:", error.message);
        process.exit(1);
    }

    // TEST 3: Try to create project with lock duration GREATER than minimum (should succeed)
    const extendedLockDuration = minLockDuration + 86400n * 30n; // 30 days more than minimum
    console.log(`\n🟢 TEST 3: Attempting to create project with EXTENDED lock duration (${Number(extendedLockDuration)} seconds)...`);
    
    const testStartTime3 = testBaseStartTime + 400n;
    const testEndTime3 = testStartTime3 + maxProjectDuration;
    
    try {
        const extendedTestProjectName = "ExtendedLockToken";
        const extendedTestProjectSymbol = "ELT";
        
        const extendedProjectTx = await exhibition.connect(deployer).createLaunchpadProject(
            extendedTestProjectName,
            extendedTestProjectSymbol,
            testInitialTotalSupply,
            testProjectTokenLogoURI,
            testContributionTokenAddress,
            testFundingGoal,
            testSoftCap,
            testMinContribution,
            testMaxContribution,
            testTokenPrice,
            testStartTime3,
            testEndTime3,
            testAmountTokensForSale,
            testLiquidityPercentage,
            extendedLockDuration, // VALID - greater than minimum
            testVestingEnabled,
            testVestingCliff,
            testVestingDuration,
            testVestingInterval,
            testVestingInitialRelease
        );
        
        await extendedProjectTx.wait();
        console.log("✅ SUCCESS: Project creation succeeded with extended lock duration");
        
    } catch (error: any) {
        console.error("❌ UNEXPECTED ERROR: Extended lock duration should have succeeded:", error.message);
        process.exit(1);
    }

    // TEST 4: Test getter function for minimum lock duration
    console.log(`\n🔍 TEST 4: Testing getMinLockDuration() getter function...`);
    
    try {
        const retrievedMinLockDuration = await exhibition.getMinLockDuration();
        console.log(`Retrieved minimum lock duration: ${Number(retrievedMinLockDuration)} seconds`);
        
        if (retrievedMinLockDuration === minLockDuration) {
            console.log("✅ SUCCESS: Getter function returns correct minimum lock duration");
        } else {
            console.error("❌ ASSERTION FAILED: Getter function returns incorrect value");
            process.exit(1);
        }
        
    } catch (error: any) {
        console.error("❌ ERROR: getMinLockDuration() function not found or failed:", error.message);
        console.log("ℹ️  Note: This is expected if you haven't added the getter function yet");
    }

    console.log("\n🎉 MIN LOCK DURATION VALIDATION TESTS COMPLETED!");
    console.log("✅ Invalid lock duration correctly rejected");
    console.log("✅ Valid lock durations correctly accepted");
    console.log("✅ Lock duration validation working as expected");
    console.log("---------------------------------------------------");

    // Continue with the main project creation test...
    await logBalances("After Min Lock Duration Tests");

    // --- Launchpad Project Creation Test (Scenario 3: exUSD Contribution - Hard Cap - NO VESTING) ---
    console.log("\n--- Launchpad Project Creation Test (Scenario 3: exUSD Contribution - HARD CAP MET - NO VESTING) ---");

    // Define parameters for a new launchpad project
    const projectTokenName = "Builders On Nexus";
    const projectTokenSymbol = "BON";
    const initialTotalSupply = ethers.parseUnits("100000000", 18); // 100 million BON
    const projectTokenLogoURI = "https://launchpad.com/BON_logo.png";

    const contributionTokenAddress = exhibitionUSDAddress; // Using exUSD as contribution token
    const fundingGoal = ethers.parseUnits("130005", 6); // Hard Cap: 130005 exUSD
    const softCap = ethers.parseUnits("70000", 6); // Soft Cap: 70000 exUSD
    const minContribution = ethers.parseUnits("500", 6); // Minimum contribution: 500 exUSD
    const maxContribution = ethers.parseUnits("50000", 6); // Increased max contribution to allow hard cap

    const adjustedTokenPrice = ethers.parseUnits("0.002889", 18); // 1 BON costs 0.002889 exUSD (in 18 decimals)

    // ✅ FIX: Get fresh timestamp and add proper buffer for main project
    const mainProjectTimestamp = await getCurrentTimestamp();
    const startTime = mainProjectTimestamp + minStartDelay + 600n; // Extra buffer after test projects
    const endTime = startTime + maxProjectDuration; // Use the fetched constant (21 days)

    const amountTokensForSale = ethers.parseUnits("45000000", 18); // 45,000,000 BON for sale

    const liquidityPercentage = 7500n; // 75%
    const lockDuration = 365n * 24n * 60n * 60n; // 1 year

    // ✅ VESTING DISABLED - All parameters set to disable vesting
    const vestingEnabled = false; // DISABLED
    const vestingCliff = 0n; // Set to 0 since vesting is disabled
    const vestingDuration = 0n; // Set to 0 since vesting is disabled
    const vestingInterval = 0n; // Set to 0 since vesting is disabled
    const vestingInitialRelease = 0n; // Set to 0 since vesting is disabled

    console.log("\n--- Project Configuration (NO VESTING) ---");
    console.log(`Vesting Enabled: ${vestingEnabled}`);
    console.log(`Token Price: ${ethers.formatUnits(adjustedTokenPrice, 18)} per BON`);
    console.log(`Tokens for sale: ${ethers.formatUnits(amountTokensForSale, 18)} BON`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} exUSD`);
    console.log(`Soft Cap: ${ethers.formatUnits(softCap, 6)} exUSD`);
    console.log(`Start Time: ${startTime} (${new Date(Number(startTime) * 1000).toISOString()})`);
    console.log(`End Time: ${endTime} (${new Date(Number(endTime) * 1000).toISOString()})`);

    console.log("Calling createLaunchpadProject for Project 3... (NO VESTING)");
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
        // Vesting Parameters - ALL DISABLED
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
        console.error("ERROR: Could not find ProjectCreated event or projectId/projectToken in receipt for Project 3.");
        process.exit(1);
    }
    console.log(`Successfully created project with ID: ${newProjectId}`);
    console.log(`Newly created Project Token Address: ${newProjectTokenAddress}`);

    projectTokenContractBON = await ethers.getContractAt("IERC20Metadata", newProjectTokenAddress, deployer);

    // Project Owner approves Exhibition to spend project tokens (for tokens for sale)
    console.log(`\nDeployer (Project Owner) is approving Exhibition contract to spend ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol} (for sale)...`);
    await projectTokenContractBON.connect(deployer).approve(exhibitionAddress, amountTokensForSale);
    console.log("SUCCESS: Project Owner approved Exhibition to spend tokens for sale.");

    // Project Owner deposits tokens for sale and activates project
    console.log(`\nCalling depositProjectTokens for Project ID ${newProjectId} with ${ethers.formatUnits(amountTokensForSale, 18)} ${projectTokenSymbol}...`);
    await exhibition.connect(deployer).depositProjectTokens(newProjectId, amountTokensForSale);
    console.log("SUCCESS: Tokens for sale deposited and project activated.");

    // --- Contributions for Project 3 (HARD CAP MET - Should Auto Finalize) ---
    console.log("\n--- Contributions for Project 3 (HARD CAP MET - Should Auto Finalize) ---");
    
    const user1Contribute = ethers.parseUnits("40005", 6); // User1 contributes 40005 exUSD
    const user2Contribute = ethers.parseUnits("35000", 6); // User2 contributes 35000 exUSD  
    const user3Contribute = ethers.parseUnits("25000", 6); // User3 contributes 25000 exUSD
    const user4Contribute = ethers.parseUnits("30000", 6); // User4 contributes 30000 exUSD
    const totalExpectedRaised = user1Contribute + user2Contribute + user3Contribute + user4Contribute; // 130,005 exUSD (Hard Cap)

    console.log(`Planned total contributions: ${ethers.formatUnits(totalExpectedRaised, 6)} exUSD`);
    console.log(`Hard Cap: ${ethers.formatUnits(fundingGoal, 6)} exUSD`);

    // Ensure enough time has passed for the project to be active for contributions
    const projectToAdvance = await exhibition.projects(newProjectId);
    const projectStartTime = Number(projectToAdvance.startTime);
    const currentBlockTimestamp = Number(await time.latest());
    let timeToAdvanceForContribution3 = 0;
    if (currentBlockTimestamp < projectStartTime) {
        timeToAdvanceForContribution3 = projectStartTime - currentBlockTimestamp + 10;
    }
    if (timeToAdvanceForContribution3 > 0) {
        await advanceTime(timeToAdvanceForContribution3);
        console.log(`Advanced time by ${timeToAdvanceForContribution3} seconds for Project 3.`);
    } else {
        console.log("Project 3 is already open for contributions.");
    }
    
    // All users contribute to reach hard cap
    console.log(`\nUser1 contributing ${ethers.formatUnits(user1Contribute, 6)} exUSD...`);
    await exhibitionUSD.connect(user1).approve(exhibitionAddress, user1Contribute);
    await exhibition.connect(user1).contribute(newProjectId, user1Contribute);

    console.log(`\nUser2 contributing ${ethers.formatUnits(user2Contribute, 6)} exUSD...`);
    await exhibitionUSD.connect(user2).approve(exhibitionAddress, user2Contribute);
    await exhibition.connect(user2).contribute(newProjectId, user2Contribute);

    console.log(`\nUser3 contributing ${ethers.formatUnits(user3Contribute, 6)} exUSD...`);
    await exhibitionUSD.connect(user3).approve(exhibitionAddress, user3Contribute);
    await exhibition.connect(user3).contribute(newProjectId, user3Contribute);

    console.log(`\n🎯 User4 contributing ${ethers.formatUnits(user4Contribute, 6)} exUSD (SHOULD HIT HARD CAP)...`);
    await exhibitionUSD.connect(user4).approve(exhibitionAddress, user4Contribute);
    await exhibition.connect(user4).contribute(newProjectId, user4Contribute);

    // Check final status - should be auto-finalized to Successful
    const projectAfterContributions3 = await exhibition.projects(newProjectId);
    console.log(`\n🎉 HARD CAP REACHED! Project status: ${projectAfterContributions3.status} (Expected: 2=Successful)`);
    console.log(`Final total raised: ${ethers.formatUnits(projectAfterContributions3.totalRaised, 6)} exUSD`);

    if (projectAfterContributions3.status !== 2n) {
        console.error(`Assertion Failed: Project 3 should be auto-finalized to Successful (2), but got status ${projectAfterContributions3.status}.`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: Hard cap reached and project auto-finalized!");

    // --- NO VESTING CLAIMING TESTS ---
    console.log(`\n--- Claiming Tests for Project ID ${newProjectId} (NO VESTING) ---`);

    // First ensure project is completed
    const currentProjectStatus = await exhibition.projects(newProjectId);
    console.log(`Project status before claims: ${currentProjectStatus.status}`);

    // Calculate expected tokens for each user
    const contributionDecimalsForClaim = 6n; // exUSD
    const projectDecimalsForClaim = 18n; // BON
    const scaleFactorForClaim = 10n ** (18n - contributionDecimalsForClaim);
    const projectTokenScaleFactorForClaim = 10n ** projectDecimalsForClaim;

    const user1ContributionAmountForClaim = user1Contribute;
    const user2ContributionAmountForClaim = user2Contribute;
    const user3ContributionAmountForClaim = user3Contribute;
    const user4ContributionAmountForClaim = user4Contribute;

    const user1TotalBONDue = (user1ContributionAmountForClaim * scaleFactorForClaim * projectTokenScaleFactorForClaim) / adjustedTokenPrice;
    const user2TotalBONDue = (user2ContributionAmountForClaim * scaleFactorForClaim * projectTokenScaleFactorForClaim) / adjustedTokenPrice;
    const user3TotalBONDue = (user3ContributionAmountForClaim * scaleFactorForClaim * projectTokenScaleFactorForClaim) / adjustedTokenPrice;
    const user4TotalBONDue = (user4ContributionAmountForClaim * scaleFactorForClaim * projectTokenScaleFactorForClaim) / adjustedTokenPrice;

    console.log(`User1 should get: ${ethers.formatUnits(user1TotalBONDue, 18)} BON`);
    console.log(`User2 should get: ${ethers.formatUnits(user2TotalBONDue, 18)} BON`);
    console.log(`User3 should get: ${ethers.formatUnits(user3TotalBONDue, 18)} BON`);
    console.log(`User4 should get: ${ethers.formatUnits(user4TotalBONDue, 18)} BON`);

    // Test immediate claiming (no vesting delays needed)
    console.log("\n--- User1 claiming tokens (should get ALL tokens immediately) ---");
    const user1BalanceBeforeClaimTest = await projectTokenContractBON.balanceOf(user1.address);
    await exhibition.connect(user1).claimTokens(newProjectId);
    const user1BalanceAfterClaimTest = await projectTokenContractBON.balanceOf(user1.address);
    const user1ClaimedAmountTest = user1BalanceAfterClaimTest - user1BalanceBeforeClaimTest;

    console.log(`User1 claimed: ${ethers.formatUnits(user1ClaimedAmountTest, 18)} BON`);
    console.log(`Expected: ${ethers.formatUnits(user1TotalBONDue, 18)} BON`);

    if (user1ClaimedAmountTest !== user1TotalBONDue) {
        console.error(`Assertion Failed: User1 claim amount incorrect.`);
        console.error(`Expected: ${user1TotalBONDue}, Got: ${user1ClaimedAmountTest}`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: User1 claimed correct amount immediately (no vesting)!");

    // Test other users claiming as well
    console.log("\n--- User2 claiming tokens ---");
    const user2BalanceBeforeClaimTest = await projectTokenContractBON.balanceOf(user2.address);
    await exhibition.connect(user2).claimTokens(newProjectId);
    const user2BalanceAfterClaimTest = await projectTokenContractBON.balanceOf(user2.address);
    const user2ClaimedAmountTest = user2BalanceAfterClaimTest - user2BalanceBeforeClaimTest;

    console.log(`User2 claimed: ${ethers.formatUnits(user2ClaimedAmountTest, 18)} BON`);
    if (user2ClaimedAmountTest !== user2TotalBONDue) {
        console.error(`Assertion Failed: User2 claim amount incorrect.`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: User2 claimed correct amount immediately!");

    console.log("\n--- User3 claiming tokens ---");
    const user3BalanceBeforeClaimTest = await projectTokenContractBON.balanceOf(user3.address);
    await exhibition.connect(user3).claimTokens(newProjectId);
    const user3BalanceAfterClaimTest = await projectTokenContractBON.balanceOf(user3.address);
    const user3ClaimedAmountTest = user3BalanceAfterClaimTest - user3BalanceBeforeClaimTest;

    console.log(`User3 claimed: ${ethers.formatUnits(user3ClaimedAmountTest, 18)} BON`);
    if (user3ClaimedAmountTest !== user3TotalBONDue) {
        console.error(`Assertion Failed: User3 claim amount incorrect.`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: User3 claimed correct amount immediately!");

    console.log("\n--- User4 claiming tokens ---");
    const user4BalanceBeforeClaimTest = await projectTokenContractBON.balanceOf(user4.address);
    await exhibition.connect(user4).claimTokens(newProjectId);
    const user4BalanceAfterClaimTest = await projectTokenContractBON.balanceOf(user4.address);
    const user4ClaimedAmountTest = user4BalanceAfterClaimTest - user4BalanceBeforeClaimTest;

    console.log(`User4 claimed: ${ethers.formatUnits(user4ClaimedAmountTest, 18)} BON`);
    if (user4ClaimedAmountTest !== user4TotalBONDue) {
        console.error(`Assertion Failed: User4 claim amount incorrect.`);
        process.exit(1);
    }
    console.log("✅ SUCCESS: User4 claimed correct amount immediately!");

    // Test attempting to claim again (should fail)
    console.log("\n--- Testing double claim prevention ---");
    try {
        await exhibition.connect(user1).claimTokens(newProjectId);
        console.error("❌ ASSERTION FAILED: Second claim should have failed!");
        process.exit(1);
    } catch (error: any) {
        if (error.message.includes("NoTokensToClaim") || 
            error.message.includes("AlreadyClaimed") ||
            error.message.includes("revert")) {
            console.log("✅ SUCCESS: Double claiming correctly prevented");
        } else {
            console.error("❌ UNEXPECTED ERROR on double claim:", error.message);
            process.exit(1);
        }
    }

    await logBalances("After All Claims");

    console.log("\n🎉 NO VESTING TEST COMPLETED SUCCESSFULLY!");
    console.log("✅ Project created with vesting disabled");
    console.log("✅ Users can claim 100% of tokens immediately after project completion");
    console.log("✅ Double claiming is properly prevented");
    console.log("✅ Hard cap auto-finalization working correctly");
    console.log("✅ Lock duration validation working correctly");
    
    console.log("\n📊 FINAL TEST SUMMARY:");
    console.log("🔒 Lock Duration Validation: ✅ PASSED");
    console.log("🚀 Project Creation (No Vesting): ✅ PASSED");
    console.log("💰 Hard Cap Auto-Finalization: ✅ PASSED");
    console.log("🎯 Immediate Token Claims: ✅ PASSED");
    console.log("🛡️ Double Claim Prevention: ✅ PASSED");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});