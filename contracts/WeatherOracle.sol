// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/operatorforwarder/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/operatorforwarder/Chainlink.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract WeatherOracle is ChainlinkClient, Ownable {
    using Chainlink for Chainlink.Request;

    event WeatherRequested(bytes32 indexed requestId, string city, address indexed requester);
    event WeatherReported(bytes32 indexed requestId, string city, int256 temperature, string description, uint256 timestamp);
    event ChainlinkFeeUpdated(uint256 oldFee, uint256 newFee);

    struct RequestMeta {
        string city;
        address requester;
    }

    struct WeatherReport {
        string city;
        int256 temperature;
        string description;
        uint256 timestamp;
        address requester;
    }

    mapping(bytes32 => RequestMeta) public requestMeta;
    mapping(bytes32 => WeatherReport) public weatherReports;

    bytes32 public jobId;
    uint256 public chainlinkFee;
    string public apiEndpoint;

    error EmptyCity();
    error MissingOracle();
    error MissingJobId();
    error InsufficientLink(uint256 balance, uint256 required);
    error UnknownRequest(bytes32 requestId);

    constructor(address linkToken, address chainlinkOracle, bytes32 _jobId, uint256 _chainlinkFee)
        Ownable(msg.sender)
    {
        _setChainlinkToken(linkToken);
        _setOracle(chainlinkOracle);
        jobId = _jobId;
        chainlinkFee = _chainlinkFee;
        apiEndpoint = "https://api.weatherapi.com/v1/current.json";
    }

    function requestWeather(string memory city) external payable returns (bytes32 requestId) {
        if (bytes(city).length == 0) revert EmptyCity();
        if (_chainlinkOracleAddress() == address(0)) revert MissingOracle();
        if (jobId == bytes32(0)) revert MissingJobId();

        uint256 linkBalance = LinkTokenInterface(_chainlinkTokenAddress()).balanceOf(address(this));
        if (linkBalance < chainlinkFee) revert InsufficientLink(linkBalance, chainlinkFee);

        Chainlink.Request memory req = _buildChainlinkRequest(jobId, address(this), this.fulfill.selector);
        req._add("get", apiEndpoint);
        req._add("city", city);
        req._add("path", "raw");

        requestId = _sendChainlinkRequest(req, chainlinkFee);

        requestMeta[requestId] = RequestMeta({city: city, requester: msg.sender});

        emit WeatherRequested(requestId, city, msg.sender);
    }

    function fulfill(bytes32 requestId, string memory weatherData) external recordChainlinkFulfillment(requestId) {
        RequestMeta memory meta = requestMeta[requestId];
        if (meta.requester == address(0)) revert UnknownRequest(requestId);

        string memory parsedCity = _extractStringValue(weatherData, "city");
        string memory finalCity = bytes(parsedCity).length > 0 ? parsedCity : meta.city;
        int256 temperature = _extractIntValue(weatherData, "temperature");
        string memory description = _extractStringValue(weatherData, "description");

        weatherReports[requestId] = WeatherReport({
            city: finalCity,
            temperature: temperature,
            description: description,
            timestamp: block.timestamp,
            requester: meta.requester
        });

        emit WeatherReported(requestId, finalCity, temperature, description, block.timestamp);

        delete requestMeta[requestId];
    }

    function setChainlinkOracle(address newOracle) external onlyOwner {
        _setOracle(newOracle);
    }

    function setJobId(bytes32 newJobId) external onlyOwner {
        jobId = newJobId;
    }

    function setChainlinkFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = chainlinkFee;
        chainlinkFee = newFee;
        emit ChainlinkFeeUpdated(oldFee, newFee);
    }

    function setApiEndpoint(string calldata newEndpoint) external onlyOwner {
        apiEndpoint = newEndpoint;
    }

    function withdrawLink(address to, uint256 amount) external onlyOwner {
        (bool ok, bytes memory data) = _chainlinkTokenAddress().call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "LINK transfer failed");
    }

    function _setOracle(address newOracle) internal {
        if (newOracle == address(0)) revert MissingOracle();
        _setChainlinkOracle(newOracle);
    }

    function _extractStringValue(string memory json, string memory key) internal pure returns (string memory) {
        bytes memory data = bytes(json);
        bytes memory keyPattern = bytes(string.concat('"', key, '":"'));

        uint256 index = _findIndex(data, keyPattern);
        if (index == type(uint256).max) {
            return "";
        }

        uint256 valueStart = index + keyPattern.length;
        uint256 valueEnd = valueStart;

        while (valueEnd < data.length && data[valueEnd] != '"') {
            valueEnd++;
        }

        bytes memory out = new bytes(valueEnd - valueStart);
        for (uint256 i = 0; i < out.length; i++) {
            out[i] = data[valueStart + i];
        }
        return string(out);
    }

    function _extractIntValue(string memory json, string memory key) internal pure returns (int256) {
        bytes memory data = bytes(json);
        bytes memory keyPattern = bytes(string.concat('"', key, '":'));

        uint256 index = _findIndex(data, keyPattern);
        if (index == type(uint256).max) {
            return 0;
        }

        uint256 cursor = index + keyPattern.length;
        bool isNegative;

        if (cursor < data.length && data[cursor] == '-') {
            isNegative = true;
            cursor++;
        }

        int256 value;
        while (cursor < data.length) {
            bytes1 ch = data[cursor];
            if (ch >= '0' && ch <= '9') {
                value = value * 10 + int256(uint256(uint8(ch) - uint8(bytes1('0'))));
                cursor++;
                continue;
            }
            if (ch == '.') {
                break;
            }
            break;
        }

        return isNegative ? -value : value;
    }

    function _findIndex(bytes memory haystack, bytes memory needle) internal pure returns (uint256) {
        if (needle.length == 0 || haystack.length < needle.length) {
            return type(uint256).max;
        }

        for (uint256 i = 0; i <= haystack.length - needle.length; i++) {
            bool matchFound = true;
            for (uint256 j = 0; j < needle.length; j++) {
                if (haystack[i + j] != needle[j]) {
                    matchFound = false;
                    break;
                }
            }

            if (matchFound) {
                return i;
            }
        }

        return type(uint256).max;
    }

    receive() external payable {}
}