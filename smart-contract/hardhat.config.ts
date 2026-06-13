import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { defineConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin],

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 40000,
  },

  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      {
        version: "0.8.20",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },

  networks: {
    sepolia: {
      type: "http",
      chainId: 11155111,
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: process.env.SEPOLIA_PRIVATE_KEY ? [process.env.SEPOLIA_PRIVATE_KEY] : [],
    },
  },

  etherscan: {
    apiKey: { sepolia: "BQUF6YWJ51896SFFPX11FNU4UUBRPMBH2G" },
},
});