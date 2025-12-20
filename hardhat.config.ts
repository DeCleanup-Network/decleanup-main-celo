import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
import "@nomicfoundation/hardhat-viem";
import "@nomicfoundation/hardhat-verify";
import "hardhat-gas-reporter";
import "solidity-coverage";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root (where hardhat.config.ts is located)
dotenv.config({ path: path.resolve(__dirname, ".env") });

// Ensure PRIVATE_KEY has 0x prefix if it exists
const rawPrivateKey = process.env.PRIVATE_KEY;
const PRIVATE_KEY = rawPrivateKey
  ? rawPrivateKey.startsWith('0x')
    ? rawPrivateKey
    : `0x${rawPrivateKey}`
  : "0x0000000000000000000000000000000000000000000000000000000000000000";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 2000 },
      viaIR: true
    }
  },

  paths: {
    tests: "contracts/test",
    ignition: "contracts/ignition"
  },

  networks: {
    hardhat: { chainId: 1337 },

    celo: {
      url: process.env.CELO_RPC_URL || "https://forno.celo.org",
      accounts: [PRIVATE_KEY],
      chainId: 42220
    },

    celoSepolia: {
      url:
        process.env.CELO_SEPOLIA_RPC_URL ||
        "https://celo-sepolia.blockscout.com/api",
      accounts: [PRIVATE_KEY],
      chainId: 11142220
    }
  },

  etherscan: {
    // Use single API key for V2 API (works with custom chains)
    apiKey: process.env.CELOSCAN_API_KEY || "",

    customChains: [
      {
        network: "celo",
        chainId: 42220,
        urls: {
          apiURL: "https://api.celoscan.io/api",
          browserURL: "https://celoscan.io/"
        }
      },
      {
        network: "celoSepolia",
        chainId: 11142220,
        urls: {
          apiURL: "https://api-sepolia.celoscan.io/api",
          browserURL: "https://celo-sepolia.blockscout.com/"
        }
      }
    ]
  },

  gasReporter: {
    enabled: !!process.env.REPORT_GAS,
    currency: "USD"
  }
};

export default config;
