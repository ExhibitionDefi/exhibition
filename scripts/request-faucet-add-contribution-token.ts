import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// Import Typechain generated types for your contracts
import { Exhibition, ExhibitionToken, ExhibitionUSD, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";

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
        console.log(`User5 EXH: ${ethers.formatUnits(await EXH.balanceOf(user5.address), 18)}`);
        console.log(`User5 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user5.address), 6)}`);
        console.log(`User6 EXH: ${ethers.formatUnits(await EXH.balanceOf(user6.address), 18)}`);
        console.log(`User6 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user6.address), 6)}`);
        console.log(`User7 EXH: ${ethers.formatUnits(await EXH.balanceOf(user7.address), 18)}`);
        console.log(`User7 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user7.address), 6)}`);
        console.log(`User8 EXH: ${ethers.formatUnits(await EXH.balanceOf(user8.address), 18)}`);
        console.log(`User8 exUSD: ${ethers.formatUnits(await exhibitionUSD.balanceOf(user8.address), 6)}`);
        console.log(`Exhibition Contract EXH Balance: ${ethers.formatUnits(await EXH.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition Contract exUSD Balance: ${ethers.formatUnits(await exhibitionUSD.balanceOf(exhibitionAddress), 6)}`);
        console.log(`Exhibition Contract exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAddress), 18)}`);
        console.log(`Exhibition AMM exNEX Balance: ${ethers.formatUnits(await exhibitionNEX.balanceOf(exhibitionAMMAddress), 18)}`);
        console.log(`Exhibition AMM exUSD Balance: ${ethers.formatUnits(await exhibitionUSD.balanceOf(exhibitionAMMAddress), 6)}`);
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

    // --- Add exUSD as Approved Contribution Token ---
    console.log("\n--- Adding exUSD as Approved Contribution Token ---");
    
    try {
        await exhibition.connect(deployer).addExhibitionContributionToken(exhibitionUSDAddress);
        console.log(`SUCCESS: exUSD (${exhibitionUSDAddress}) added as an approved contribution token.`);
    } catch (e: any) {
        if (!e.message.includes("TokenAlreadyApproved()")) {
            console.warn(`Warning: Could not add exUSD as approved token: ${e.message}`);
        } else {
            console.log("exUSD is already an approved contribution token.");
        }
    }

    // Verify exUSDT is now approved
    const isexUSDApproved = await exhibition.isExhibitionContributionToken(exhibitionUSDAddress);
    console.log(`exUSD contribution token approved status: ${isexUSDApproved}`);
    
    if (!isexUSDApproved) {
        console.error("ERROR: exUSD is not marked as approved contribution token after addition.");
        process.exit(1);
    }

    console.log("\n--- Final Token Status ---");
    console.log(`exUSD Token Address: ${exhibitionUSDAddress}`);
    console.log(`exUSD Approved as Contribution Token: ${isexUSDApproved}`);

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