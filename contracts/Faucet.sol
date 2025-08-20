// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MultiTokenFaucet is Ownable {
    struct TokenConfig {
        bool isSupported;
        uint256 claimAmount;
    }

    mapping(address => TokenConfig) public tokens;
    mapping(address => mapping(address => uint256)) public lastClaimTime;
    uint256 public cooldownTime;
    address[] private supportedTokens; // Array to track supported token addresses

    event TokenAdded(address indexed token, uint256 claimAmount);
    event TokenRemoved(address indexed token);
    event TokensClaimed(address indexed user, address indexed token, uint256 amount);

    constructor(uint256 _cooldownTime)  {
        cooldownTime = _cooldownTime;
    }

    function addToken(address _token, uint256 _claimAmount) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_claimAmount > 0, "Claim amount must be greater than 0");
        require(!tokens[_token].isSupported, "Token already supported");

        tokens[_token] = TokenConfig(true, _claimAmount);
        supportedTokens.push(_token); // Add to array
        emit TokenAdded(_token, _claimAmount);
    }

    function removeToken(address _token) external onlyOwner {
        require(tokens[_token].isSupported, "Token not supported");

        tokens[_token].isSupported = false;
        tokens[_token].claimAmount = 0;

        // Remove from array
        for (uint256 i = 0; i < supportedTokens.length; i++) {
            if (supportedTokens[i] == _token) {
                supportedTokens[i] = supportedTokens[supportedTokens.length - 1];
                supportedTokens.pop();
                break;
            }
        }
        emit TokenRemoved(_token);
    }

    function claim(address _token) external {
        require(tokens[_token].isSupported, "Token not supported");
        require(
            block.timestamp >= lastClaimTime[msg.sender][_token] + cooldownTime,
            "Cooldown period not elapsed"
        );

        lastClaimTime[msg.sender][_token] = block.timestamp;
        IERC20(_token).transfer(msg.sender, tokens[_token].claimAmount);
        emit TokensClaimed(msg.sender, _token, tokens[_token].claimAmount);
    }

    // New function to get all supported tokens
    function getSupportedTokens() external view returns (address[] memory) {
        return supportedTokens;
    }

    function setCooldownTime(uint256 _cooldownTime) external onlyOwner {
        cooldownTime = _cooldownTime;
    }
}