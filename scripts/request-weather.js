const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const contractAddress = process.env.WEATHER_ORACLE_CONTRACT_ADDRESS;
  const defaultCity = process.env.WEATHER_DEFAULT_CITY || "London";
  const city = process.argv[2] || defaultCity;

  if (!contractAddress) {
    throw new Error("Missing WEATHER_ORACLE_CONTRACT_ADDRESS in .env");
  }

  const weatherOracle = await hre.ethers.getContractAt("WeatherOracle", contractAddress);
  const tx = await weatherOracle.requestWeather(city, { value: 0 });
  console.log("Submitted tx:", tx.hash);

  const receipt = await tx.wait();
  const evt = receipt.logs
    .map((log) => {
      try {
        return weatherOracle.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed && parsed.name === "WeatherRequested");

  if (evt) {
    console.log("Request ID:", evt.args.requestId);
    console.log("City:", evt.args.city);
  } else {
    console.log("WeatherRequested event not found in receipt logs");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});