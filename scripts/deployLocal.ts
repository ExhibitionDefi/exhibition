import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    console.log("Deploying Full Exhibition Platform (Faucet + Factory + AMM + Launchpad Structs)...");

    const [deployer, user1] = await ethers.getSigners();

    console.log(`Deploying contracts with the account: ${deployer.address}`);
    console.log(`User1 account: ${user1.address}`);

    // --- 1. Deploy Core Tokens (ExhibitionToken, NexusUSD) ---
    const ExhibitionTokenFactory = await ethers.getContractFactory("ExhibitionToken");
    const EXH = await ExhibitionTokenFactory.deploy(deployer.address);
    await EXH.waitForDeployment();
    const ExhibitionTokenAddress = await EXH.getAddress();
    console.log(`ExhibitionToken (EXH) deployed to: ${ExhibitionTokenAddress}`);

    const NexusUSD = await ethers.getContractFactory("NexusUSD");
    const nexusUSD = await NexusUSD.deploy(deployer.address);
    await nexusUSD.waitForDeployment();
    const NexusUSDAddress = await nexusUSD.getAddress();
    console.log(`NexusUSD deployed to: ${NexusUSDAddress}`);

    // --- 2. Deploy ExhibitionNEX (exNEX) ---
    const ExhibitionNEXFactory = await ethers.getContractFactory("ExhibitionNEX");
    const exhibitionNEX = await ExhibitionNEXFactory.deploy();
    await exhibitionNEX.waitForDeployment();
    const exhibitionNEXAddress = await exhibitionNEX.getAddress();
    console.log(`ExhibitionNEX (exNEX) deployed to: ${exhibitionNEXAddress}`);

    console.log(`\nExhibitionToken automatically minted 10M EXH to Deployer in constructor.`);
    console.log(`Deployer EXH: ${ethers.formatUnits(await EXH.balanceOf(deployer.address), 18)}`);

    // --- 3. Deploy ExhibitionLPTokens (Real LP Token Manager) ---
    const ExhibitionLPTokensFactory = await ethers.getContractFactory("ExhibitionLPTokens");
    const exhibitionLPTokens = await ExhibitionLPTokensFactory.deploy();
    const exhibitionLPTokensAddress = await exhibitionLPTokens.getAddress();
    console.log(`ExhibitionLPTokens deployed to: ${exhibitionLPTokensAddress}`);

    // --- 4. Deploy ExhibitionAMM ---
    const ExhibitionAMMFactory = await ethers.getContractFactory("ExhibitionAMM");

    // Constructor args: (uint256 _tradingFeeBps, uint256 _protocolFeeBps, address _feeRecipient)
    const tradingFeeBps = 30;     // 0.30% trading fee
    const protocolFeeBps = 1600;  // 16% of trading fee (example)
    const feeRecipient = user1.address;
 
    const exhibitionAMM = await ExhibitionAMMFactory.deploy(tradingFeeBps, protocolFeeBps, feeRecipient);
    await exhibitionAMM.waitForDeployment();
    const exhibitionAMMAddress = await exhibitionAMM.getAddress();
    console.log(`ExhibitionAMM deployed to: ${exhibitionAMMAddress}`);

    // --- 5. Set the correct AMM address on ExhibitionLPTokens ---
    console.log("\nSetting ExhibitionAMM address on ExhibitionLPTokens...");
    let tx = await exhibitionLPTokens.setExhibitionAmmAddress(exhibitionAMMAddress);
    await tx.wait();
    console.log(`ExhibitionLPTokens.sol: AMM Address set to ${await exhibitionLPTokens.EXHIBITION_AMM_ADDRESS()}`);

    // --- 6. Deploy ExhibitionFactory ---
    const ExhibitionFactory = await ethers.getContractFactory("ExhibitionFactory");
    const factory = await ExhibitionFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`ExhibitionFactory deployed to: ${factoryAddress}`);

    // --- 7. Deploy Exhibition (Main Platform) ---
    const ExhibitionContract = await ethers.getContractFactory("Exhibition");
    const exhibition = await ExhibitionContract.deploy();
    await exhibition.waitForDeployment();
    const exhibitionAddress = await exhibition.getAddress();
    console.log(`Exhibition (Main Platform) deployed to: ${exhibitionAddress}`);

    // --- Set Exhibition contract as the minter for ExhibitionToken and NexusUSD ---
    console.log("\nSetting Exhibition contract as minter for ExhibitionToken and NexusUSD...");
    tx = await EXH.setMinter(exhibitionAddress);
    await tx.wait();
    console.log(`ExhibitionToken minter set to ${exhibitionAddress}`);

    tx = await nexusUSD.setMinter(exhibitionAddress);
    await tx.wait();
    console.log(`NexusUSD minter set to ${exhibitionAddress}`);

    console.log("\nSetting faucet token addresses and amounts...");
    tx = await exhibition.setExhTokenAddress(ExhibitionTokenAddress);
    await tx.wait();
    console.log(`Exhibition.sol: ExhibitionToken Address set to ${ExhibitionTokenAddress}`);

    tx = await exhibition.setUSDXTokenAddress(NexusUSDAddress);
    await tx.wait();
    console.log(`Exhibition.sol: NexusUSD Address set to ${NexusUSDAddress}`);

    tx = await exhibition.setFaucetAmountEXH(ethers.parseUnits("100000", 18));
    await tx.wait();
    console.log(`Exhibition.sol: Faucet EXH Amount set to ${ethers.formatUnits(await exhibition.faucetAmountEXH(), 18)}`);

    tx = await exhibition.setFaucetAmountUSDX(ethers.parseUnits("100000", 6));
    await tx.wait();
    console.log(`Exhibition.sol: Faucet USDX Amount set to ${ethers.formatUnits(await exhibition.faucetAmountUSDX(), 6)}`);

    // Faucet cooldown: 1 day = 86,400 blocks at 1 block/second 
    tx = await exhibition.setFaucetCooldown(86400);
    await tx.wait();
    console.log(`Exhibition.sol: Faucet Cooldown set to ${await exhibition.faucetCooldownBlocks()} blocks`);

    console.log("\nSetting ExhibitionFactory address on Exhibition contract...");
    tx = await exhibition.setExhibitionFactoryAddress(factoryAddress);
    await tx.wait();
    console.log(`Exhibition.sol: ExhibitionFactory Address set to ${factoryAddress}`);

    console.log("\nSetting ExhibitionAMM address on Exhibition contract...");
    tx = await exhibition.setExhibitionAMMAddress(exhibitionAMMAddress);
    await tx.wait();
    console.log(`Exhibition.sol: ExhibitionAMM Address set to ${exhibitionAMMAddress}`);

    console.log("\nSetting Exhibition contract address on ExhibitionFactory...");
    tx = await factory.setExhibitionContractAddress(exhibitionAddress);
    await tx.wait();
    console.log(`ExhibitionFactory.sol: Exhibition Contract Address set to ${exhibitionAddress}`);

    console.log("\nSetting Exhibition contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExhibitionContract(exhibitionAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: Exhibition Contract Address set to ${exhibitionAddress}`);

    console.log("\nSetting ExhibitionLPTokens contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setLPTokensAddress(exhibitionLPTokensAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: ExhibitionLPTokens Contract Address set to ${exhibitionLPTokensAddress}`);

    console.log("\nSetting ExhibitionToken contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExhTokenAddress(ExhibitionTokenAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: ExhibitionToken Contract Address set to ${ExhibitionTokenAddress}`);

    console.log("\nSetting NexusUSD contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setUSDXAddress(NexusUSDAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: NexusUSD Contract Address set to ${NexusUSDAddress}`);

    console.log("\nSetting exNEX contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExNEXAddress(exhibitionNEXAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: exNEX Contract Address set to ${exhibitionNEXAddress}`);

    console.log("\nSetting platform-wide fees...");
    tx = await exhibition.setPlatformFeePercentage(300); // 3.00%
    await tx.wait();
    console.log(`Exhibition.sol: Platform Fee Percentage set to ${Number(await exhibition.platformFeePercentage()) / 100}%`);

    tx = await exhibition.setPlatformFeeRecipient(user1.address);
    await tx.wait();
    console.log(`Exhibition.sol: Platform Fee Recipient set to ${await exhibition.platformFeeRecipient()}`);

    // Save deployed addresses to a JSON file for testing scripts
    const deployedAddresses = {
        EXH: ExhibitionTokenAddress,
        NexusUSD: NexusUSDAddress,
        ExhibitionNEX: exhibitionNEXAddress,
        ExhibitionLPTokens: exhibitionLPTokensAddress,
        ExhibitionFactory: factoryAddress,
        ExhibitionAMM: exhibitionAMMAddress,
        Exhibition: exhibitionAddress,
    };

    const outputFilePath = path.join(__dirname, 'deployed_full_platform_addresses_local.json');
    fs.writeFileSync(outputFilePath, JSON.stringify(deployedAddresses, null, 4));
    console.log(`\nDeployed full platform addresses saved to ${outputFilePath}`);

    console.log("Full platform deployment and configuration complete.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});