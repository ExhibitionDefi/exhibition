import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Import Typechain generated types for your contracts
// Ensure these are available after a successful 'npx hardhat compile'
import { Exhibition, Exh, ExhibitionUSDT, ExhibitionFactory, ExhibitionNEX, ExhibitionLPTokens, ExhibitionAMM } from "../typechain-types";

async function main() {
    console.log("Deploying Full Exhibition Platform (Faucet + Factory + AMM + Launchpad Structs)...");

    const [deployer] = await ethers.getSigners();

    console.log(`Deploying contracts with the account: ${deployer.address}`);

    // --- 1. Deploy Core Tokens (Exh, ExhibitionUSDT) ---
    const Exh = await ethers.getContractFactory("Exh");
    const exh = await Exh.deploy(deployer.address);
    await exh.waitForDeployment();
    const exhAddress = await exh.getAddress();
    console.log(`Exh Token deployed to: ${exhAddress}`);

    const ExhibitionUSDT = await ethers.getContractFactory("ExhibitionUSDT");
    const exhibitionUSDT = await ExhibitionUSDT.deploy(deployer.address);
    await exhibitionUSDT.waitForDeployment();
    const exhibitionUSDTAddress = await exhibitionUSDT.getAddress();
    console.log(`ExhibitionUSDT deployed to: ${exhibitionUSDTAddress}`);

    // --- 2. Deploy ExhibitionNEX (Real exNEX) ---
    const ExhibitionNEXFactory = await ethers.getContractFactory("ExhibitionNEX");
    const exhibitionNEX = await ExhibitionNEXFactory.deploy(); // ExhibitionNEX constructor takes no args
    await exhibitionNEX.waitForDeployment();
    const exhibitionNEXAddress = await exhibitionNEX.getAddress();
    console.log(`ExhibitionNEX (exNEX) deployed to: ${exhibitionNEXAddress}`);

    // --- Provide initial token supply to deployer for testing ---
    const initialDeployerSupplyExh = ethers.parseUnits("10000000", 18); // 10 million EXH
    const initialDeployerSupplyNEX = ethers.parseUnits("5000", 18); // 5,000 native NEX (ETH)

    console.log(`\nMinting initial ${ethers.formatUnits(initialDeployerSupplyExh, 18)} EXH to Deployer...`);
    // Note: The first mint happens in the constructor of Exh.sol, so this is an additional mint.
    // If the constructor already minted 10M, this will add another 10M.
    // Ensure your initialDeployerSupplyExh here aligns with your testing needs.
    // Since the deployer is initially the minter, this call will succeed.
    await exh.mint(deployer.address, initialDeployerSupplyExh);
    console.log("SUCCESS: EXH minted to Deployer.");

    console.log(`Depositing initial ${ethers.formatUnits(initialDeployerSupplyNEX, 18)} native NEX to get exNEX for Deployer...`);
    await exhibitionNEX.deposit({ value: initialDeployerSupplyNEX });
    console.log("SUCCESS: exNEX acquired by Deployer via deposit.");
    // --- END NEW ---

    // --- 3. Deploy ExhibitionLPTokens (Real LP Token Manager) ---
    const ExhibitionLPTokensFactory = await ethers.getContractFactory("ExhibitionLPTokens");
    const exhibitionLPTokens = await ExhibitionLPTokensFactory.deploy();
    const exhibitionLPTokensAddress = await exhibitionLPTokens.getAddress();
    console.log(`ExhibitionLPTokens deployed to: ${exhibitionLPTokensAddress}`);

    // --- 4. Deploy ExhibitionAMM (Real AMM) ---
    const ExhibitionAMMFactory = await ethers.getContractFactory("ExhibitionAMM");
    const exhibitionAMM = await ExhibitionAMMFactory.deploy();
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

    // --- NEW: Set Exhibition contract as the minter for Exh and ExhibitionUSDT ---
    console.log("\nSetting Exhibition contract as minter for Exh and ExhibitionUSDT...");
    tx = await exh.setMinter(exhibitionAddress);
    await tx.wait();
    console.log(`Exh Token minter set to ${exhibitionAddress}`);

    tx = await exhibitionUSDT.setMinter(exhibitionAddress);
    await tx.wait();
    console.log(`ExhibitionUSDT minter set to ${exhibitionAddress}`);

    console.log("\nSetting faucet token addresses and amounts...");
    tx = await exhibition.setExhTokenAddress(exhAddress);
    await tx.wait();
    console.log(`Exhibition.sol: Exh Token Address set to ${exhAddress}`);

    tx = await exhibition.setExUSDTTokenAddress(exhibitionUSDTAddress);
    await tx.wait();
    console.log(`Exhibition.sol: ExhibitionUSDT Address set to ${exhibitionUSDTAddress}`);

    tx = await exhibition.setFaucetAmountEXH(ethers.parseUnits("50000", 18));
    await tx.wait();
    console.log(`Exhibition.sol: Faucet EXH Amount set to ${ethers.formatUnits(await exhibition.faucetAmountEXH(), 18)}`);

    tx = await exhibition.setFaucetAmountUSDT(ethers.parseUnits("50000", 6));
    await tx.wait();
    console.log(`Exhibition.sol: Faucet USDT Amount set to ${ethers.formatUnits(await exhibition.faucetAmountUSDT(), 6)}`);

    tx = await exhibition.setFaucetCooldown(86400);
    await tx.wait();
    console.log(`Exhibition.sol: Faucet Cooldown set to ${await exhibition.faucetCooldownSeconds()} seconds`);

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

    console.log("\nSetting ExhToken contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExhTokenAddress(exhAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: ExhToken Contract Address set to ${exhAddress}`);

    console.log("\nSetting exhibitionUSDT contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExUSDTAddress(exhibitionUSDTAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: exhibitionUSDT Contract Address set to ${exhibitionUSDTAddress}`);

    console.log("\nSetting ExNEX contract address on ExhibitionAMM...");
    tx = await exhibitionAMM.setExNEXAddress(exhibitionNEXAddress);
    await tx.wait();
    console.log(`ExhibitionAMM.sol: ExNEX Contract Address set to ${exhibitionNEXAddress}`);

    console.log("\nSetting platform-wide fees...");
    tx = await exhibition.setPlatformFeePercentage(300); // 3.00%
    await tx.wait();
    console.log(`Exhibition.sol: Platform Fee Percentage set to ${Number(await exhibition.platformFeePercentage()) / 100}%`);

    tx = await exhibition.setPlatformFeeRecipient(deployer.address);
    await tx.wait();
    console.log(`Exhibition.sol: Platform Fee Recipient set to ${await exhibition.platformFeeRecipient()}`);

    // Save deployed addresses to a JSON file for testing scripts
    const deployedAddresses = {
        ExhToken: exhAddress,
        ExhibitionUSDT: exhibitionUSDTAddress,
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
