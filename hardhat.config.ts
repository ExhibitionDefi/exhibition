import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * 1. DYNAMIC ACCOUNT LOADER
 * Automatically pulls PRIVATE_KEY and PRIVATE_KEY_USER1 through 50 from .env
 */
const getAccounts = (): string[] => {
  const accounts: string[] = [];
  
  // Primary Deployer
  if (process.env.PRIVATE_KEY) accounts.push(process.env.PRIVATE_KEY);

  // Additional Users (1-50)
  for (let i = 1; i <= 10; i++) {
    const key = process.env[`PRIVATE_KEY_USER${i}`];
    if (key) accounts.push(key);
  }

  return accounts;
};

const accounts = getAccounts();
const RPC_URL = process.env.NEXUS_TESTNET_RPC_URL || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    // Live Nexus Testnet
    nexusTestnet: {
      url: RPC_URL,
      accounts: accounts,
      chainId: Number(process.env.NEXUS_TESTNET_CHAIN_ID),
    },
    // Local Node with Forking Enabled
    hardhat: {
      forking: RPC_URL ? {
        url: RPC_URL,
        enabled: true,
      } : undefined,
      mining: {
        auto: true,
        interval: 0,
      },
      accounts: accounts.map(pk => ({
        privateKey: pk,
        balance: "100000000000000000000000" // 100,000 ETH for local testing
      })),
      chainId: 31337,
    },
    // Localhost for npx hardhat node
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: accounts,
    },
  },
  etherscan: {
    apiKey: {
      nexusTestnet: "placeholder",
    },
    customChains: [
      {
        network: "nexusTestnet",
        chainId: Number(process.env.NEXUS_TESTNET_CHAIN_ID),
        urls: {
          apiURL: process.env.NEXUS_TESTNET_API_URL || "",
          browserURL: process.env.NEXUS_TESTNET_EXPLORER_URL || "",
        },
      },
    ],
  },
};

export default config;