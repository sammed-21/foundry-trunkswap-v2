const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers } = hre;

// Chainlink AggregatorV3Interface ABI
const AGGREGATOR_ABI = [
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint80", name: "_roundId", type: "uint80" }],
    name: "getRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { internalType: "uint80", name: "roundId", type: "uint80" },
      { internalType: "int256", name: "answer", type: "int256" },
      { internalType: "uint256", name: "startedAt", type: "uint256" },
      { internalType: "uint256", name: "updatedAt", type: "uint256" },
      { internalType: "uint80", name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
]



// Chainlink feed addresses on Arbitrum Sepolia
const PRICE_FEED_ADDRESSES = {
  ETH: "0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165",
  USDC: "0x0153002d20B96532C639313c2d54c3dA09109309",
  DAI: "0xb113F5A928BCfF189C998ab20d753a47F9dE5A61",
  WBTC: "0x56a43EB56Da12C0dc1D972ACb089c06a5dEF8e69",
  ARB: "0xD1092a65338d049DB68D7Be6bD89d17a0929945e",
  USDT: "0x80EDee6f667eCc9f63a0a6f55578F870651f06A4",
};

// Fetch real prices from Arbitrum Sepolia
async function fetchRealPrices(provider) {
  const prices = {};

  for (const [symbol, address] of Object.entries(PRICE_FEED_ADDRESSES)) {
    try {
      const feed = new ethers.Contract(address, AGGREGATOR_ABI, provider);
      const decimals = await feed.decimals();
      console.log({decimals, symbol})
      const roundData = await feed.latestRoundData();
      const answer = roundData.answer;

      if (!answer || answer <= 0) {
        console.warn(`⚠️ Warning: ${symbol} price is zero or invalid`);
        continue;
      }

      prices[symbol] = {
        price: ethers.utils.formatUnits(answer, decimals),
        decimals,
      };
    } catch (err) {
      console.warn(`❌ Failed to fetch price for ${symbol}: ${err.message}`);
    }
  }

  return prices;
}

// Deploy mocks with real prices
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);

  const provider = new ethers.getDefaultProvider("https://sepolia-rollup.arbitrum.io/rpc");
  const realPrices = await fetchRealPrices(provider);

  const MockPriceFeed = await ethers.getContractFactory("MockPriceFeed");
  const deployedFeeds = {};

  for (const [symbol, { price, decimals }] of Object.entries(realPrices)) {
    const feed = await MockPriceFeed.deploy(
      ethers.utils.parseUnits(price.toString(), decimals),
      decimals
    );
    await feed.deployed();

    console.log(`✅ ${symbol}_USD Feed deployed at: ${feed.address}`);

    deployedFeeds[`${symbol}_USD`] = {
      address: feed.address,
      decimals,
      price,
      timestamp: Date.now(),
    };
  }

  const outputPath = path.join(__dirname, "../mock-price-feeds.json");
  fs.writeFileSync(outputPath, JSON.stringify(deployedFeeds, null, 2));
  console.log("📦 All feeds saved to mock-price-feeds.json");
}

// Execute
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
