// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const NEXUS_TESTNET_III_RPC_URL: string = process.env.NEXUS_TESTNET_III_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY: string = process.env.PRIVATE_KEY || "";
const USER1_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER1 || "";
const USER2_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER2 || "";
const USER3_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER3 || "";
const USER4_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER4 || "";
const USER5_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER5 || "";
const USER6_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER6 || "";
const USER7_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER7 || "";
const USER8_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER8 || "";
const USER9_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER9 || "";

// Helper function to build accounts array
const buildAccountsArray = (): string[] => {
  const keys = [
    DEPLOYER_PRIVATE_KEY,
    USER1_PRIVATE_KEY,
    USER2_PRIVATE_KEY,
    USER3_PRIVATE_KEY,
    USER4_PRIVATE_KEY,
    USER5_PRIVATE_KEY,
    USER6_PRIVATE_KEY,
    USER7_PRIVATE_KEY,
    USER8_PRIVATE_KEY,
    USER9_PRIVATE_KEY,
  ];
  return keys.filter(key => key !== "");
};

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    nexusTestnet: {
      url: NEXUS_TESTNET_III_RPC_URL,
      accounts: buildAccountsArray(),
      timeout: 120000, // 2 minutes
      chainId: 3945,
      gas: "auto",
      gasPrice: "auto",
    },
    hardhat: {
      forking: NEXUS_TESTNET_III_RPC_URL ? {
        url: NEXUS_TESTNET_III_RPC_URL,
        enabled: true,
      } : undefined,
      mining: {
        auto: true,
        interval: 0,
      },
      accounts: buildAccountsArray().map(privateKey => ({
        privateKey,
        balance: "100000000000000000000000" // 100,000 ETH
      })),
      chainId: 31337, // Default Hardhat chainId
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 120000,
      accounts: buildAccountsArray(),
    },
  },
};
export default config;