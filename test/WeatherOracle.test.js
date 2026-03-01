const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("WeatherOracle", function () {
  const JOB_ID = ethers.keccak256(ethers.toUtf8Bytes("weather-job"));
  const FEE = ethers.parseUnits("1", 18);

  async function deployFixture() {
    const [owner, oracleSigner, user] = await ethers.getSigners();

    const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
    const link = await MockLinkToken.deploy();
    await link.waitForDeployment();

    const WeatherOracle = await ethers.getContractFactory("WeatherOracle");
    const weatherOracle = await WeatherOracle.deploy(
      await link.getAddress(),
      oracleSigner.address,
      JOB_ID,
      FEE
    );
    await weatherOracle.waitForDeployment();

    await link.mint(await weatherOracle.getAddress(), ethers.parseUnits("10", 18));

    return { owner, oracleSigner, user, link, weatherOracle };
  }

  it("emits WeatherRequested and stores request metadata", async function () {
    const { weatherOracle, user } = await deployFixture();
    const city = "London";

    const tx = await weatherOracle.connect(user).requestWeather(city);
    const receipt = await tx.wait();

    const parsedEvent = receipt.logs
      .map((log) => {
        try {
          return weatherOracle.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((evt) => evt && evt.name === "WeatherRequested");

    expect(parsedEvent).to.not.equal(null);
    expect(parsedEvent.args.city).to.equal(city);
    expect(parsedEvent.args.requester).to.equal(user.address);

    const meta = await weatherOracle.requestMeta(parsedEvent.args.requestId);
    expect(meta.city).to.equal(city);
    expect(meta.requester).to.equal(user.address);
  });

  it("reverts requestWeather when city is empty", async function () {
    const { weatherOracle } = await deployFixture();
    await expect(weatherOracle.requestWeather("")).to.be.revertedWithCustomError(weatherOracle, "EmptyCity");
  });

  it("reverts requestWeather when LINK is insufficient", async function () {
    const [owner, oracleSigner] = await ethers.getSigners();

    const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
    const link = await MockLinkToken.deploy();
    await link.waitForDeployment();

    const WeatherOracle = await ethers.getContractFactory("WeatherOracle");
    const weatherOracle = await WeatherOracle.deploy(
      await link.getAddress(),
      oracleSigner.address,
      JOB_ID,
      FEE
    );
    await weatherOracle.waitForDeployment();

    await expect(weatherOracle.requestWeather("Delhi")).to.be.revertedWithCustomError(
      weatherOracle,
      "InsufficientLink"
    );
  });

  it("reverts when job id is cleared by owner", async function () {
    const { weatherOracle } = await deployFixture();
    await weatherOracle.setJobId(ethers.ZeroHash);

    await expect(weatherOracle.requestWeather("Mumbai")).to.be.revertedWithCustomError(
      weatherOracle,
      "MissingJobId"
    );
  });

  it("reverts when owner tries to set zero oracle address", async function () {
    const { weatherOracle } = await deployFixture();

    await expect(weatherOracle.setChainlinkOracle(ethers.ZeroAddress)).to.be.revertedWithCustomError(
      weatherOracle,
      "MissingOracle"
    );
  });

  it("allows oracle to fulfill, parses weatherData, stores report and emits WeatherReported", async function () {
    const { weatherOracle, oracleSigner, user } = await deployFixture();
    const reqTx = await weatherOracle.connect(user).requestWeather("Berlin");
    const reqReceipt = await reqTx.wait();

    const requestEvt = reqReceipt.logs
      .map((log) => {
        try {
          return weatherOracle.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((evt) => evt && evt.name === "WeatherRequested");

    const requestId = requestEvt.args.requestId;
    const payload = '{"city":"Berlin","temperature":22,"description":"clear sky"}';

    await expect(weatherOracle.connect(oracleSigner).fulfill(requestId, payload))
      .to.emit(weatherOracle, "WeatherReported")
      .withArgs(requestId, "Berlin", 22, "clear sky", anyValue);

    const report = await weatherOracle.weatherReports(requestId);
    expect(report.city).to.equal("Berlin");
    expect(report.temperature).to.equal(22);
    expect(report.description).to.equal("clear sky");
    expect(report.requester).to.equal(user.address);
    expect(report.timestamp).to.be.gt(0);
  });

  it("rejects non-oracle fulfill calls", async function () {
    const { weatherOracle, user } = await deployFixture();

    const reqTx = await weatherOracle.requestWeather("Rome");
    const reqReceipt = await reqTx.wait();
    const requestEvt = reqReceipt.logs
      .map((log) => {
        try {
          return weatherOracle.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((evt) => evt && evt.name === "WeatherRequested");

    await expect(
      weatherOracle.connect(user).fulfill(requestEvt.args.requestId, '{"temperature":30,"description":"hot"}')
    ).to.be.revertedWith("Source must be the oracle of the request");
  });

  it("falls back to requested city when payload city is missing", async function () {
    const { weatherOracle, oracleSigner, user } = await deployFixture();
    const reqTx = await weatherOracle.connect(user).requestWeather("Paris");
    const reqReceipt = await reqTx.wait();

    const requestEvt = reqReceipt.logs
      .map((log) => {
        try {
          return weatherOracle.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((evt) => evt && evt.name === "WeatherRequested");

    const requestId = requestEvt.args.requestId;
    const payload = '{"temperature":14,"description":"rain"}';

    await expect(weatherOracle.connect(oracleSigner).fulfill(requestId, payload))
      .to.emit(weatherOracle, "WeatherReported")
      .withArgs(requestId, "Paris", 14, "rain", anyValue);

    const report = await weatherOracle.weatherReports(requestId);
    expect(report.city).to.equal("Paris");
  });

  it("restricts admin setters to owner", async function () {
    const { weatherOracle, user } = await deployFixture();

    await expect(weatherOracle.connect(user).setJobId(JOB_ID)).to.be.revertedWithCustomError(
      weatherOracle,
      "OwnableUnauthorizedAccount"
    );

    await expect(weatherOracle.connect(user).setChainlinkFee(FEE)).to.be.revertedWithCustomError(
      weatherOracle,
      "OwnableUnauthorizedAccount"
    );
  });

  it("emits fee update and updates storage", async function () {
    const { weatherOracle } = await deployFixture();
    const newFee = ethers.parseUnits("2", 18);

    await expect(weatherOracle.setChainlinkFee(newFee))
      .to.emit(weatherOracle, "ChainlinkFeeUpdated")
      .withArgs(FEE, newFee);

    expect(await weatherOracle.chainlinkFee()).to.equal(newFee);
  });
});