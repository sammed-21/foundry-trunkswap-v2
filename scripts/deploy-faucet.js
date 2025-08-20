// const { ethers } = require("hardhat");
// const tokenData = require("./deployed-contracts.json"); // Import token data

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   console.log("Deploying contracts with the account:", deployer.address);

//   // Check deployer ETH balance
//   const ethBalance = await ethers.provider.getBalance(deployer.address);
//   console.log("Deployer ETH balance:", ethers.utils.formatEther(ethBalance));
//   if (ethBalance.lt(ethers.utils.parseEther("0.01"))) {
//     throw new Error("Insufficient ETH for deployment. Please fund the wallet.");
//   }

//   // Deploy MultiTokenFaucet contract
//   const MultiTokenFaucet = await ethers.getContractFactory("MultiTokenFaucet");
//   const initialCooldownTime = 86400; // 24 hours in seconds
//   const faucet = await MultiTokenFaucet.deploy(initialCooldownTime);
//   await faucet.deployed();
//   console.log("MultiTokenFaucet deployed to:", faucet.address);

//   // Define tokens to add (WETH, USDC, DAI, WBTC, ARB, USDT)
//   const supportedTokens = ["WETH", "USDC", "DAI", "WBTC", "ARB", "USDT"];
//   const chainName = "holesky"; // Target Holesky network

//   // Define custom claim values per token (as strings for parseUnits)
//   const claimValues = {
//     "USDC": "10",    // Stablecoin: 10 tokens
//     "DAI": "10",     // Stablecoin: 10 tokens
//     "USDT": "10",    // Stablecoin: 10 tokens
//     "WETH": "0.01",  // ETH-like: 0.01 tokens
//     "WBTC": "0.005", // BTC-like: 0.005 tokens
//     "ARB": "10",     // Assuming 10 for ARB (adjust based on value if needed)
//   };

//   // Prepare token configurations
//   const tokens = supportedTokens.map((symbol) => {
//     const tokenInfo = tokenData[symbol]?.[chainName];
//     if (!tokenInfo) {
//       throw new Error(`Token ${symbol} not found for ${chainName}`);
//     }
//     const claimValue = claimValues[symbol];
//     if (!claimValue) {
//       throw new Error(`Claim value not defined for ${symbol}`);
//     }
//     const claimAmount = ethers.utils.parseUnits(claimValue, tokenInfo.decimals);
//     const fundingAmount = claimAmount.mul(15); // Fund with 100x the claim amount (adjust multiplier as needed)

//     return {
//       name: symbol,
//       address: tokenInfo.address,
//       decimals: tokenInfo.decimals,
//       claimAmount,
//       fundingAmount,
//     };
//   });

//   // Add tokens to the faucet
//   for (const token of tokens) {
//     console.log(`Adding ${token.name} to faucet...`);
//     const tx = await faucet.addToken(token.address, token.claimAmount);
//     await tx.wait();
//     console.log(`${token.name} added with claim amount: ${ethers.utils.formatUnits(token.claimAmount, token.decimals)}`);
//   }

//   // Fund the faucet with tokens
//   for (const token of tokens) {
//     const tokenContract = await ethers.getContractAt("IERC20", token.address, deployer);
//     const balance = await tokenContract.balanceOf(deployer.address);
//     console.log(`Deployer ${token.name} balance: ${ethers.utils.formatUnits(balance, token.decimals)}`);

//     if (balance.lt(token.fundingAmount)) {
//       console.warn(`Insufficient ${token.name} balance to fund faucet. Skipping funding for ${token.name}.`);
//       continue;
//     }

//     console.log(`Funding faucet with ${ethers.utils.formatUnits(token.fundingAmount, token.decimals)} ${token.name}...`);
//     const tx = await tokenContract.transfer(faucet.address, token.fundingAmount);
//     await tx.wait();
//     console.log(`Faucet funded with ${ethers.utils.formatUnits(token.fundingAmount, token.decimals)} ${token.name}`);
//   }

//   console.log("Deployment and funding complete!");
//   console.log("Faucet address:", faucet.address);
// }

// main()
//   .then(() => process.exit(0))
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   });


const { ethers } = require("hardhat");
const tokenData = require("./deployed-contracts.json"); // Import token data

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Check deployer ETH balance
  const ethBalance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer ETH balance:", ethers.utils.formatEther(ethBalance));
  if (ethBalance.lt(ethers.utils.parseEther("0.01"))) {
    throw new Error("Insufficient ETH for deployment. Please fund the wallet.");
  }

  // Deploy MultiTokenFaucet contract
  const MultiTokenFaucet = await ethers.getContractFactory("MultiTokenFaucet");
  const initialCooldownTime = 86400; // 24 hours in seconds
  const faucet = await MultiTokenFaucet.deploy(initialCooldownTime);
  await faucet.deployed();
  console.log("MultiTokenFaucet deployed to:", faucet.address);

  // Define tokens to add (WETH, USDC, DAI, WBTC, ARB, USDT)
  const supportedTokens = ["WETH", "USDC", "DAI", "WBTC", "ARB", "USDT"];
  const chainName = "localhost"; // Target Holesky network

  // Define custom claim values per token (as strings for parseUnits)
  const claimValues = {
    USDC: "10", // Stablecoin: 10 tokens
    DAI: "10", // Stablecoin: 10 tokens
    USDT: "10", // Stablecoin: 10 tokens
    WETH: "0.01", // ETH-like: 0.01 tokens
    WBTC: "0.005", // BTC-like: 0.005 tokens
    ARB: "10", // Assuming 10 for ARB
  };

  // Prepare token configurations
  const tokens = supportedTokens.map((symbol) => {
    const tokenInfo = tokenData[symbol]?.[chainName];
    if (!tokenInfo) {
      throw new Error(`Token ${symbol} not found for ${chainName}`);
    }
    const claimValue = claimValues[symbol];
    if (!claimValue) {
      throw new Error(`Claim value not defined for ${symbol}`);
    }
    const claimAmount = ethers.utils.parseUnits(claimValue, tokenInfo.decimals);
    const fundingAmount = claimAmount.mul(100); // Fund with 100x the claim amount

    return {
      name: symbol,
      address: tokenInfo.address,
      decimals: tokenInfo.decimals,
      claimAmount,
      fundingAmount,
    };
  });

  // Add tokens to the faucet
  for (const token of tokens) {
    console.log(`Adding ${token.name} to faucet...`);
    const tx = await faucet.addToken(token.address, token.claimAmount);
    await tx.wait();
    console.log(`${token.name} added with claim amount: ${ethers.utils.formatUnits(token.claimAmount, token.decimals)}`);
  }

  // Fund the faucet with tokens
  for (const token of tokens) {
    const tokenContract = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      token.address,
      deployer
    );
    const balance = await tokenContract.balanceOf(deployer.address);
    console.log(`Deployer ${token.name} balance: ${ethers.utils.formatUnits(balance, token.decimals)}`);

    if (balance.lt(token.fundingAmount)) {
      console.warn(`Insufficient ${token.name} balance to fund faucet. Skipping funding for ${token.name}.`);
      continue;
    }

    console.log(`Funding faucet with ${ethers.utils.formatUnits(token.fundingAmount, token.decimals)} ${token.name}...`);
    const tx = await tokenContract.transfer(faucet.address, token.fundingAmount);
    await tx.wait();
    console.log(`Faucet funded with ${ethers.utils.formatUnits(token.fundingAmount, token.decimals)} ${token.name}`);
  }

  console.log("Deployment and funding complete!");
  console.log("Faucet address:", faucet.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });