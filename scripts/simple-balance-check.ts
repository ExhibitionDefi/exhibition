import { ethers } from "hardhat";
import * as fs from "fs";

async function main() {
    console.log("=== Simple Balance Check ===");
    
    // Load deployed addresses
    const deployedAddressesPath = "./scripts/deployed_full_platform_addresses_local.json";
    
    if (!fs.existsSync(deployedAddressesPath)) {
        console.error("❌ Deployed addresses file not found!");
        return;
    }
    
    const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, 'utf8'));
    console.log("✅ Loaded deployed addresses");
    
    // Get signers
    const [deployer, user1, user2] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`User1: ${user1.address}`);
    
    // Check if contracts exist first
    console.log("\n=== Checking Contract Deployment ===");
    
    const exhCode = await ethers.provider.getCode(deployedAddresses.ExhToken);
    const usdtCode = await ethers.provider.getCode(deployedAddresses.ExhibitionUSDT);
    
    console.log(`EXH Token contract exists: ${exhCode !== "0x" ? "✅ Yes" : "❌ No"}`);
    console.log(`USDT Token contract exists: ${usdtCode !== "0x" ? "✅ Yes" : "❌ No"}`);
    
    if (exhCode === "0x" || usdtCode === "0x") {
        console.log("❌ Contracts not properly deployed. Try redeploying.");
        return;
    }
    
    // Try to connect to contracts
    console.log("\n=== Testing Contract Connections ===");
    
    try {
        // Test EXH Token
        console.log("Testing EXH Token...");
        const exhToken = await ethers.getContractAt("Exh", deployedAddresses.ExhToken);
        
        // Basic info calls
        const exhName = await exhToken.name();
        const exhSymbol = await exhToken.symbol();
        console.log(`✅ EXH Token: ${exhName} (${exhSymbol})`);
        
        // Balance check
        const deployerExhBalance = await exhToken.balanceOf(deployer.address);
        console.log(`Deployer EXH balance: ${ethers.formatEther(deployerExhBalance)}`);
        
        const user1ExhBalance = await exhToken.balanceOf(user1.address);
        console.log(`User1 EXH balance: ${ethers.formatEther(user1ExhBalance)}`);
        
    } catch (error: any) {
        console.log(`❌ EXH Token error: ${error.message}`);
    }
    
    try {
        // Test USDT Token
        console.log("\nTesting USDT Token...");
        const usdtToken = await ethers.getContractAt("ExhibitionUSDT", deployedAddresses.ExhibitionUSDT);
        
        // Basic info calls
        const usdtName = await usdtToken.name();
        const usdtSymbol = await usdtToken.symbol();
        const usdtDecimals = await usdtToken.decimals();
        console.log(`✅ USDT Token: ${usdtName} (${usdtSymbol}) - ${usdtDecimals} decimals`);
        
        // Balance checks
        const deployerUsdtBalance = await usdtToken.balanceOf(deployer.address);
        console.log(`Deployer USDT balance: ${ethers.formatUnits(deployerUsdtBalance, usdtDecimals)}`);
        
        const user1UsdtBalance = await usdtToken.balanceOf(user1.address);
        console.log(`User1 USDT balance: ${ethers.formatUnits(user1UsdtBalance, usdtDecimals)}`);
        
    } catch (error: any) {
        console.log(`❌ USDT Token error: ${error.message}`);
    }
    
    // Test faucet functionality
    console.log("\n=== Testing Faucet ===");
    try {
        const exhibition = await ethers.getContractAt("Exhibition", deployedAddresses.Exhibition);
        console.log("✅ Connected to Exhibition contract");
        
        // Try faucet request with user1
        console.log("Attempting faucet request...");
        const exhibitionAsUser1 = exhibition.connect(user1);
        
        const tx = await exhibitionAsUser1.requestFaucetTokens();
        console.log(`Transaction hash: ${tx.hash}`);
        
        const receipt = await tx.wait();
        console.log(`✅ Faucet transaction mined in block ${receipt?.blockNumber}`);
        
        // Check balance after faucet
        const usdtToken = await ethers.getContractAt("ExhibitionUSDT", deployedAddresses.ExhibitionUSDT);
        const user1BalanceAfter = await usdtToken.balanceOf(user1.address);
        const decimals = await usdtToken.decimals();
        console.log(`User1 USDT balance after faucet: ${ethers.formatUnits(user1BalanceAfter, decimals)}`);
        
    } catch (error: any) {
        console.log(`❌ Faucet error: ${error.message}`);
        
        // If it's a cooldown error, that's actually good - means faucet works
        if (error.message.includes("cooldown") || error.message.includes("wait")) {
            console.log("✅ This is actually good - faucet is working but user is in cooldown");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });