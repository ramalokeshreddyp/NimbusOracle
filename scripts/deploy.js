const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const link = process.env.LINK_TOKEN_ADDRESS;
  const oracle = process.env.CHAINLINK_ORACLE_ADDRESS;
  const jobId = process.env.CHAINLINK_JOB_ID;
  const fee = process.env.CHAINLINK_FEE_WEI;

  if (!link || !oracle || !jobId || !fee) {
    throw new Error("Missing required env vars: LINK_TOKEN_ADDRESS, CHAINLINK_ORACLE_ADDRESS, CHAINLINK_JOB_ID, CHAINLINK_FEE_WEI");
  }

  const WeatherOracle = await hre.ethers.getContractFactory("WeatherOracle");
  const weatherOracle = await WeatherOracle.deploy(link, oracle, jobId, fee);
  await weatherOracle.waitForDeployment();

  const address = await weatherOracle.getAddress();
  console.log("WeatherOracle deployed:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});