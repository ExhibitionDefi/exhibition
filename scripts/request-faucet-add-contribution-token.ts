import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Import Typechain generated types for your contracts
import { Exhibition, ExhibitionToken, NexusUSD, ExhibitionNEX } from "../typechain-types";

async function main() {
    console.log("Starting Faucet Request and Token Setup Script...");

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
    console.log(`Testing with User9 account: ${user9.address}`);

    // --- Load deployed addresses ---
    const filePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    if (!fs.existsSync(filePath)) {
        console.error(`Error: ${filePath} not found. Please run deploy.ts first.`);
        process.exit(1);
    }
    const deployedAddresses = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const ExhibitionTokenAddress = deployedAddresses.EXH as string;
    const nexusUSDAddress = deployedAddresses.NexusUSD as string;
    const exhibitionAddress = deployedAddresses.Exhibition as string;
    const exhibitionNEXAddress = deployedAddresses.ExhibitionNEX as string;
    const exhibitionAMMAddress = deployedAddresses.ExhibitionAMM as string;
    const exhibitionLPTokensAddress = deployedAddresses.ExhibitionLPTokens as string;

    console.log("\n--- Loaded Deployed Addresses ---");
    console.log(`EXH: ${ExhibitionTokenAddress}`);
    console.log(`NexusUSD: ${nexusUSDAddress}`);
    console.log(`ExhibitionNEX: ${exhibitionNEXAddress}`);
    console.log(`ExhibitionLPTokens: ${exhibitionLPTokensAddress}`);
    console.log(`ExhibitionAMM: ${exhibitionAMMAddress}`);
    console.log(`Exhibition (Main Platform): ${exhibitionAddress}`);

    // --- Get Contract Instances ---
    const EXH: ExhibitionToken = await ethers.getContractAt("ExhibitionToken", ExhibitionTokenAddress, deployer);
    const nexusUSD: NexusUSD = await ethers.getContractAt("NexusUSD", nexusUSDAddress, deployer);
    const exhibition: Exhibition = await ethers.getContractAt("Exhibition", exhibitionAddress, deployer);
    const exhibitionNEX: ExhibitionNEX = await ethers.getContractAt("ExhibitionNEX", exhibitionNEXAddress, deployer);

    // --- Helper to log balances ---
    const logBalances = async (label: string) => {
        console.log(`\n--- ${label} Balances ---`);
        console.log(`Deployer EXH: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);
        console.log(`Deployer USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(deployer.address), 6)}`);
        console.log(`Deployer exNEX: ${ethers.formatUnits(await exhibitionNEX.balanceOf(deployer.address), 18)}`);
        console.log(`User1 EXH: ${ethers.formatUnits(await EXH.balanceOf(user1.address), 18)}`);
        console.log(`User1 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user1.address), 6)}`);
        console.log(`User2 EXH: ${ethers.formatUnits(await EXH.balanceOf(user2.address), 18)}`);
        console.log(`User2 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user2.address), 6)}`);
        console.log(`User3 EXH: ${ethers.formatUnits(await EXH.balanceOf(user3.address), 18)}`);
        console.log(`User3 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user3.address), 6)}`);
        console.log(`User4 EXH: ${ethers.formatUnits(await EXH.balanceOf(user4.address), 18)}`);
        console.log(`User4 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user4.address), 6)}`);
        console.log(`User5 EXH: ${ethers.formatUnits(await EXH.balanceOf(user5.address), 18)}`);
        console.log(`User5 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user5.address), 6)}`);
        console.log(`User6 EXH: ${ethers.formatUnits(await EXH.balanceOf(user6.address), 18)}`);
        console.log(`User6 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user6.address), 6)}`);
        console.log(`User7 EXH: ${ethers.formatUnits(await EXH.balanceOf(user7.address), 18)}`);
        console.log(`User7 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user7.address), 6)}`);
        console.log(`User8 EXH: ${ethers.formatUnits(await EXH.balanceOf(user8.address), 18)}`);
        console.log(`User8 USDX: ${ethers.formatUnits(await nexusUSD.balanceOf(user8.address), 6)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition Contract USDX Balance: ${ethers.formatUnits(await nexusUSD.balanceOf(exhibitionAddress), 6)}`);
        console.log(`Exhibition Contract exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition AMM exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAMMAddress), 18)}`);
        console.log(`Exhibition AMM USDX Balance: ${ethers.formatUnits(await nexusUSD.balanceOf(exhibitionAMMAddress), 6)}`);
        console.log(`Exhibition AMM EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAMMAddress), 18)}`);
    };

    // --- Initial Faucet Requests for Users ---
    console.log("\n--- Requesting Faucet Tokens for Users ---");
    
    console.log("User1 requesting faucet tokens...");
    await exhibition.connect(user1).requestFaucetTokens();
    console.log("SUCCESS: User1 faucet request completed.");
    
    console.log("User2 requesting faucet tokens...");
    await exhibition.connect(user2).requestFaucetTokens();
    console.log("SUCCESS: User2 faucet request completed.");
    
    console.log("User3 requesting faucet tokens...");
    await exhibition.connect(user3).requestFaucetTokens();
    console.log("SUCCESS: User3 faucet request completed.");

    console.log("User4 requesting faucet tokens...");
    await exhibition.connect(user4).requestFaucetTokens();
    console.log("SUCCESS: User4 faucet request completed.");

    console.log("User5 requesting faucet tokens...");
    await exhibition.connect(user5).requestFaucetTokens();
    console.log("SUCCESS: User5 faucet request completed.");

    console.log("User6 requesting faucet tokens...");
    await exhibition.connect(user6).requestFaucetTokens();
    console.log("SUCCESS: User6 faucet request completed.");

    console.log("User7 requesting faucet tokens...");
    await exhibition.connect(user7).requestFaucetTokens();
    console.log("SUCCESS: User7 faucet request completed.");

    console.log("User8 requesting faucet tokens...");
    await exhibition.connect(user8).requestFaucetTokens();
    console.log("SUCCESS: User8 faucet request completed.");

    console.log("User9 requesting faucet tokens...");
    await exhibition.connect(user9).requestFaucetTokens();
    console.log("SUCCESS: User9 faucet request completed.");

    // --- Add EXH as Approved Contribution Token ---
    console.log("\n--- Adding EXH as Approved Contribution Token ---");
    
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(ExhibitionTokenAddress);
        console.log(`SUCCESS: EXH (${ExhibitionTokenAddress}) added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add EXH as approved token: ${e.message}`);
        } else {
            console.log("EXH is already an approved contribution token.");
        }
    }

    // Verify EXH is now approved
    const isEXHApproved = await exhibition.isExhibitionContributionToken(ExhibitionTokenAddress);
    console.log(`EXH contribution token approved status: ${isEXHApproved}`);
    
    if (!isEXHApproved) {
        console.error("ERROR: EXH is not marked as approved contribution token after addition.");
        process.exit(1);
    }

    console.log("\n--- Final Token Status ---");
    console.log(`EXH Token Address: ${ExhibitionTokenAddress}`);
    console.log(`EXH Approved as Contribution Token: ${isEXHApproved}`);

    // --- Add USDX as Approved Contribution Token ---
    console.log("\n--- Adding USDX as Approved Contribution Token ---");
    
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(nexusUSDAddress);
        console.log(`SUCCESS: USDX (${nexusUSDAddress}) added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add USDX as approved token: ${e.message}`);
        } else {
            console.log("USDX is already an approved contribution token.");
        }
    }

    // Verify USDXT is now approved
    const isUSDXApproved = await exhibition.isExhibitionContributionToken(nexusUSDAddress);
    console.log(`USDX contribution token approved status: ${isUSDXApproved}`);
    
    if (!isUSDXApproved) {
        console.error("ERROR: USDX is not marked as approved contribution token after addition.");
        process.exit(1);
    }

    console.log("\n--- Final Token Status ---");
    console.log(`USDX Token Address: ${nexusUSDAddress}`);
    console.log(`USDX Approved as Contribution Token: ${isUSDXApproved}`);

    // --- Add exNEX as Approved Contribution Token ---
    console.log("\n--- Adding exNEX as Approved Contribution Token ---");
    
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(exhibitionNEXAddress);
        console.log(`SUCCESS: exNEX (${exhibitionNEXAddress}) added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add exNEX as approved token: ${e.message}`);
        } else {
            console.log("exNEX is already an approved contribution token.");
        }
    }

    // Verify exNEX is now approved
    const isexNEXApproved = await exhibition.isExhibitionContributionToken(exhibitionNEXAddress);
    console.log(`exNEX contribution token approved status: ${isexNEXApproved}`);
    
    if (!isexNEXApproved) {
        console.error("ERROR: exNEX is not marked as approved contribution token after addition.");
        process.exit(1);
    }

    console.log("\n--- Final Token Status ---");
    console.log(`exNEX Token Address: ${exhibitionNEXAddress}`);
    console.log(`exNEX Approved as Contribution Token: ${isexNEXApproved}`);


    await logBalances("Final Setup");

    console.log("\nFaucet Request and Token Setup Script completed successfully!");
    console.log("You can now run the project creation and testing script.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});