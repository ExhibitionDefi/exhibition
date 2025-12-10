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
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
      timeout: 120000, // 2 minutes
    },
    hardhat: {
      forking: {
        url: NEXUS_TESTNET_III_RPC_URL,
      },
      mining: {
        auto: true,
        interval: 0,
      },
      accounts: [
        DEPLOYER_PRIVATE_KEY ? { privateKey: DEPLOYER_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER1_PRIVATE_KEY ? { privateKey: USER1_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER2_PRIVATE_KEY ? { privateKey: USER2_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER3_PRIVATE_KEY ? { privateKey: USER3_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER4_PRIVATE_KEY ? { privateKey: USER4_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER5_PRIVATE_KEY ? { privateKey: USER5_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER6_PRIVATE_KEY ? { privateKey: USER6_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER7_PRIVATE_KEY ? { privateKey: USER7_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER8_PRIVATE_KEY ? { privateKey: USER8_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
        USER9_PRIVATE_KEY ? { privateKey: USER9_PRIVATE_KEY, balance: "100000000000000000000000" } : undefined,
      ].filter(Boolean) as { privateKey: string; balance: string }[],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      timeout: 120000, // Add 2 minute timeout here too
    },
  },
};

export default config;