// contracts/MockPriceFeed.sol
// SPDX-License-Identifier: MIT
pragma solidity =0.8.13;

contract MockPriceFeed {
    int256 public latestAnswer;
    uint8 public decimals;
    uint256 public updatedAt;

    constructor(int256 _initialAnswer, uint8 _decimals) {
        latestAnswer = _initialAnswer;
        decimals = _decimals;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 _updatedAt,
            uint80 answeredInRound
        )
    {
        return (1, latestAnswer, updatedAt, updatedAt, 1);
    }

    function setPrice(int256 _answer) external {
        latestAnswer = _answer;
        updatedAt = block.timestamp;
    }
}
