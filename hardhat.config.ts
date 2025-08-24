// hardhat.config.ts
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";
dotenv.config();

const NEXUS_ALCHEMY_RPC_URL: string = process.env.NEXUS_ALCHEMY_RPC_URL || "";
const DEPLOYER_PRIVATE_KEY: string = process.env.PRIVATE_KEY || "";
const USER1_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER1 || "";
const USER2_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER2 || "";
const USER3_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER3 || "";
const USER4_PRIVATE_KEY: string = process.env.PRIVATE_KEY_USER4 || ""; // New variable for the 5th signer

// IMPORTANT: Replace with a recent block number from Nexus Testnet
// You can find this on a Nexus Testnet block explorer.
//const FORK_BLOCK_NUMBER = 9990310;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Standard number of runs
      },
      viaIR: true,
    },
  },
  networks: {
    nexusTestnet: {
      url: NEXUS_ALCHEMY_RPC_URL,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
    hardhat: {
      forking: {
        url: NEXUS_ALCHEMY_RPC_URL,
    //    blockNumber: FORK_BLOCK_NUMBER,
      },
      // Ensure 5 unique private keys for deployer, user1, user2, user3, user4
      accounts: [
        DEPLOYER_PRIVATE_KEY ? { privateKey: DEPLOYER_PRIVATE_KEY, balance: "10000000000000000000000" } : undefined, // Account #0 (Deployer)
        USER1_PRIVATE_KEY ? { privateKey: USER1_PRIVATE_KEY, balance: "10000000000000000000000" } : undefined, // Account #1 (User1)
        USER2_PRIVATE_KEY ? { privateKey: USER2_PRIVATE_KEY, balance: "10000000000000000000000" } : undefined, // Account #2 (User2)
        USER3_PRIVATE_KEY ? { privateKey: USER3_PRIVATE_KEY, balance: "10000000000000000000000" } : undefined, // Account #3 (User3)
        USER4_PRIVATE_KEY ? { privateKey: USER4_PRIVATE_KEY, balance: "10000000000000000000000" } : undefined  // Account #4 (User4)
      ].filter(Boolean) as { privateKey: string; balance: string }[], // Filter out undefined if keys are missing
    },
  },
};

export default config;