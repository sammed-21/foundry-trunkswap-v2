 
// const fs = require("fs");
// const path = require("path");
// const hre = require("hardhat");
// const { ethers, network } = hre;
// const ether = ethers.utils.parseEther;
// const TOKENS = ["WETH","USDC", "DAI","WBTC","ARB",   "USDT"];

// // Generate all pairs
// function generateAllPairs(tokens) {
//   const pairs = [];
//   for (let i = 0; i < tokens.length; i++) {
//     for (let j = i + 1; j < tokens.length; j++) {
//       pairs.push([tokens[i], tokens[j]]);
//     }
//   }
//   return pairs;
// }
// function getOracleKey(symbol) {
//   return `${symbol === "WETH" ? "ETH"  : symbol}_USD`;
// }

// const PAIRS = generateAllPairs(TOKENS);

// async function main() {
//   const [deployer] = await ethers.getSigners();
//   const netName = network.name;
//   const deployData = {};

//   console.log(`🔨 Network: ${netName}`);
//   console.log(`👤 Deployer: ${deployer.address}`);

//   // 1. Deploy mock ERC20 tokens
//   const Token = await ethers.getContractFactory("Token");
//   const tokenMap = {};

//   console.log("\n📦 Deploying Tokens...");
//   for (const symbol of TOKENS) {
//    const token = await Token.deploy(`${symbol} Token`, symbol, ether('1000000'));
//     await token.deployed();



//     const address =  token.address;
 

//     const ownerbalance = await token.balanceOf(deployer.address)
//     const symbols = await token.symbol()
 
//     const decimals = await token.decimals();
//     console.log({ownerbalance,symbols,decimals })
//     console.log(`✅ ${symbol}: ${address}`);
//     tokenMap[symbol] = token;

//     deployData[symbol] = {
//       [netName]: {
//         address,
//         deployer: deployer.address,
//       },
//     };
//   }

//   // 2. Deploy Uniswap V2 Factory
//   const Factory = await ethers.getContractFactory("UniswapV2Factory");
//   const factory = await Factory.deploy(deployer.address);
//   await factory.deployed();

//   const factoryAddress = await factory.address;
//   console.log(`\n🏭 Factory deployed: ${factoryAddress}`);
//   deployData["UniswapV2Factory"] = {
//     [netName]: {
//       address: factoryAddress,
//       deployer: deployer.address,
//     },
//   };

//   // 3. Deploy Router
//   const Router = await ethers.getContractFactory("UniswapV2Router02");
//   const router = await Router.deploy(factoryAddress, await tokenMap["WETH"].address);
//   await router.deployed();

//   const routerAddress = await router.address;
//   console.log(`🧭 Router deployed: ${routerAddress}`);
//   deployData["UniswapV2Router02"] = {
//     [netName]: {
//       address: routerAddress,
//       deployer: deployer.address,
//     },
//   };

//   // 4. Read price feed
//   const priceFeedPath = path.join(__dirname, "../mock-price-feeds.json");
//   const mockPrices = JSON.parse(fs.readFileSync(priceFeedPath, "utf-8"));
  
//   console.log(mockPrices)
//   // 5. Add liquidity based on oracle prices
//   console.log("\n💧 Adding liquidity with oracle prices...");

//   for (const [symbolA, symbolB] of PAIRS) {
//     const tokenA = tokenMap[symbolA];
//     const tokenB = tokenMap[symbolB];
//     console.log(tokenA.symbol, tokenB.symbol)

//     console.log(symbolA,symbolB)

//     const oracleA = mockPrices[`${getOracleKey(symbolA)}`];
//     const oracleB = mockPrices[`${getOracleKey(symbolB)}`];
//    console.log(getOracleKey(symbolA),getOracleKey(symbolB))
//     if (!oracleA || !oracleB) {
//       console.log({oracleA,oracleB})
//       console.warn(`⚠️ Skipping ${symbolA}-${symbolB} due to missing prices`);
//       continue;
//     }
//    const priceA = parseFloat(mockPrices[getOracleKey(symbolA)]?.price || "0");
// const priceB = parseFloat(mockPrices[getOracleKey(symbolB)]?.price || "0");

   

//     const decimalsA = await tokenA.decimals();
//     const decimalsB = await tokenB.decimals();

//     const amountA = "100"; // 10 units of token A
//     // const amountB = (priceA / priceB * parseFloat(amountA)).toString(); // adjust to keep 1:1 USD ratio
//     const rawAmountB = (priceA / priceB) * parseFloat(amountA);
// const amountB = rawAmountB.toFixed(decimalsB); // ✅ round to token decimals


//     const amountADesired =  ethers.utils.parseUnits(amountA, decimalsA);
//     const amountBDesired =  ethers.utils.parseUnits(amountB, decimalsB);

//     const balanceA = await tokenA.balanceOf(deployer.address);
//     const balanceB = await tokenB.balanceOf(deployer.address);
 
// if (balanceA.lt(amountADesired) || balanceB.lt(amountBDesired)) {
//   console.warn(`⚠️ Skipping ${symbolA}-${symbolB}: not enough balance`);
//   continue;
// }

//     // Approve tokens
//     await (await tokenA.approve(routerAddress, amountADesired)).wait();
//     await (await tokenB.approve(routerAddress, amountBDesired)).wait();

//     // Add liquidity
//     try {
//       await router.addLiquidity(
//         await tokenA.address,
//         await tokenB.address,
//         amountADesired,
//         amountBDesired,
//         0,
//         0,
//         deployer.address,

//         (await ethers.provider.getBlock("latest")).timestamp + 600  // 10 minutes ahead

//       );
//     } catch (err) {
//       console.error(`❌ Failed to add liquidity for ${symbolA}-${symbolB}`, err.message);
//       continue;
//     }

//     const pairAddress = await factory.getPair(
//       await tokenA.address,
//       await tokenB.address
//     );

//     console.log(`🔗 Pair ${symbolA}-${symbolB}: ${pairAddress}`);

//     if (!deployData["Pairs"]) deployData["Pairs"] = {};
//     if (!deployData["Pairs"][netName]) deployData["Pairs"][netName] = {};
//     deployData["Pairs"][netName][`${symbolA}-${symbolB}`] = pairAddress;
//   }

//   // 6. Save deployment data
//   const filePath = path.join(__dirname, "deployed-contracts.json");
//   let existingData = {};
//   if (fs.existsSync(filePath)) {
//     existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
//   }

//   const mergedData = { ...existingData };
//   for (const key of Object.keys(deployData)) {
//     if (!mergedData[key]) mergedData[key] = {};
//     if (key === "Pairs") {
//       mergedData[key][netName] = {
//         ...mergedData[key][netName],
//         ...deployData[key][netName],
//       };
//     } else {
//       mergedData[key][netName] = deployData[key][netName];
//     }
//   }

//   fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
//   console.log(`\n✅ Deployment saved to ${filePath}`);
// }

// main().catch((err) => {
//   console.error(err);
//   process.exit(1);
// });

 



const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers, network } = hre;
const ether = ethers.utils.parseEther;
const TOKENS = ["WETH", "USDC", "DAI", "WBTC", "ARB", "USDT"];

// Generate all pairs
function generateAllPairs(tokens) {
  const pairs = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      pairs.push([tokens[i], tokens[j]]);
    }
  }
  return pairs;
}

function getOracleKey(symbol) {
  return `${symbol === "WETH" ? "ETH" : symbol}_USD`;
}

const PAIRS = generateAllPairs(TOKENS);

// Token configuration with proper decimals
const TOKEN_CONFIG = {
  WETH: { decimals: 18, name: "Wrapped Ether" },
  USDC: { decimals: 6, name: "USD Coin" },
  DAI: { decimals: 18, name: "Dai Stablecoin" },
  WBTC: { decimals: 8, name: "Wrapped Bitcoin" },
  ARB: { decimals: 18, name: "Arbitrum" },
  USDT: { decimals: 6, name: "Tether USD" }
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName = network.name;
  const deployData = {};

  console.log(`🔨 Network: ${netName}`);
  console.log(`👤 Deployer: ${deployer.address}`);

  // Read price feed first
  const priceFeedPath = path.join(__dirname, "../mock-price-feeds.json");
  if (!fs.existsSync(priceFeedPath)) {
    throw new Error(`Price feed file not found at ${priceFeedPath}`);
  }
  
  const mockPrices = JSON.parse(fs.readFileSync(priceFeedPath, "utf-8"));
  console.log("📊 Loaded price feeds:", mockPrices);

  // Validate all required prices exist
  for (const token of TOKENS) {
    const oracleKey = getOracleKey(token);
    if (!mockPrices[oracleKey]) {
      throw new Error(`Missing price for ${token} (${oracleKey})`);
    }
  }

  // 1. Deploy mock ERC20 tokens with proper decimals
  const Token = await ethers.getContractFactory("Token");
  const tokenMap = {};

  console.log("\n📦 Deploying Tokens...");
  for (const symbol of TOKENS) {
    const config = TOKEN_CONFIG[symbol];
    const decimals = config.decimals;
    
    // Mint a very large supply to ensure enough liquidity
    // Calculate required supply based on number of pairs and liquidity amount
    const pairsPerToken = TOKENS.length - 1; // Each token appears in (n-1) pairs
    const liquidityPerPair = 50000; // $50k per pair
    const price = parseFloat(mockPrices[getOracleKey(symbol)]?.price || "1");
    const tokensNeededPerPair = liquidityPerPair / price;
    const totalTokensNeeded = tokensNeededPerPair * pairsPerToken * 2; // 2x buffer
    const minSupply = Math.max(totalTokensNeeded, 10000000000); // At least 1M tokens
    
    // const totalSupply = ethers.utils.parseUnits(minSupply.toString(), decimals);
    const rawSupply = BigInt(Math.floor(minSupply * 10 ** decimals));
const totalSupply = (rawSupply);
// const totalSupply = ethers.utils.parseUnits("1000000000", decimals); // 1 billion

console.log(`Total to mint: ${totalSupply.toString()}`);

    
    const token = await Token.deploy(config.name, symbol, totalSupply);
    await token.deployed();
const balance = await token.balanceOf(deployer.address);
console.log(`${symbol} balance:`, ethers.utils.formatUnits(balance, decimals));

    const address = token.address;
    const ownerBalance = await token.balanceOf(deployer.address);
    const tokenSymbol = await token.symbol();
    const tokenDecimals = await token.decimals();

    console.log(`✅ ${symbol}: ${address}`);
    console.log(`   Price: ${price}`);
    console.log(`   Tokens needed per pair: ${tokensNeededPerPair.toFixed(6)}`);
    console.log(`   Total pairs for this token: ${pairsPerToken}`);
    console.log(`   Total supply minted: ${minSupply.toFixed(6)}`);
    console.log(`   Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`);
    console.log(`   Owner Balance: ${ethers.utils.formatUnits(ownerBalance, decimals)}`);
    console.log(`   Decimals: ${tokenDecimals}`);
    
    tokenMap[symbol] = token;

    deployData[symbol] = {
      [netName]: {
        address,
        deployer: deployer.address,
        decimals: tokenDecimals,
        totalSupply: totalSupply.toString()
      },
    };
  }

  // 2. Deploy Uniswap V2 Factory
  const Factory = await ethers.getContractFactory("UniswapV2Factory");
  const factory = await Factory.deploy(deployer.address);
  await factory.deployed();

  const factoryAddress = factory.address;
  console.log(`\n🏭 Factory deployed: ${factoryAddress}`);
  deployData["UniswapV2Factory"] = {
    [netName]: {
      address: factoryAddress,
      deployer: deployer.address,
    },
  };

  // 3. Deploy Router
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factoryAddress, tokenMap["WETH"].address);
  await router.deployed();

  const routerAddress = router.address;
  console.log(`🧭 Router deployed: ${routerAddress}`);
  deployData["UniswapV2Router02"] = {
    [netName]: {
      address: routerAddress,
      deployer: deployer.address,
    },
  };

  // 4. Add liquidity based on oracle prices
  console.log("\n💧 Adding liquidity with oracle prices...");

  for (const [symbolA, symbolB] of PAIRS) {
    const tokenA = tokenMap[symbolA];
    const tokenB = tokenMap[symbolB];
    
    console.log(`\n🔄 Processing pair: ${symbolA}-${symbolB}`);

    const oracleKeyA = getOracleKey(symbolA);
    const oracleKeyB = getOracleKey(symbolB);
    
    const priceDataA = mockPrices[oracleKeyA];
    const priceDataB = mockPrices[oracleKeyB];

    if (!priceDataA || !priceDataB) {
      console.warn(`⚠️ Skipping ${symbolA}-${symbolB} due to missing price data`);
      continue;
    }

    const priceA = parseFloat(priceDataA.price);
    const priceB = parseFloat(priceDataB.price);
    
    console.log(`   ${symbolA} price: $${priceA}`);
    console.log(`   ${symbolB} price: $${priceB}`);

    const decimalsA = await tokenA.decimals();
    const decimalsB = await tokenB.decimals();

    // Calculate liquidity amounts - use significant amounts for better trading
    // Base amount in USD terms (e.g., $50,000 worth of each token)
    const baseLiquidityUSD = 50000;
    
    // Calculate token amounts based on USD value
    const amountAInTokens = baseLiquidityUSD / priceA;
    const amountBInTokens = baseLiquidityUSD / priceB;
    
    // Convert to proper decimal format
    const amountADesired = ethers.utils.parseUnits(amountAInTokens.toFixed(decimalsA), decimalsA);
    const amountBDesired = ethers.utils.parseUnits(amountBInTokens.toFixed(decimalsB), decimalsB);

    console.log(`   Amount A: ${amountAInTokens.toFixed(6)} ${symbolA}`);
    console.log(`   Amount B: ${amountBInTokens.toFixed(6)} ${symbolB}`);
    console.log(`   Price ratio: 1 ${symbolA} = ${(priceA / priceB).toFixed(8)} ${symbolB}`);

    // Check balances
    const balanceA = await tokenA.balanceOf(deployer.address);
    const balanceB = await tokenB.balanceOf(deployer.address);

    if (balanceA.lt(amountADesired) || balanceB.lt(amountBDesired)) {
      console.warn(`⚠️ Skipping ${symbolA}-${symbolB}: insufficient balance`);
      console.log(`   Need A: ${ethers.utils.formatUnits(amountADesired, decimalsA)}`);
      console.log(`   Have A: ${ethers.utils.formatUnits(balanceA, decimalsA)}`);
      console.log(`   Need B: ${ethers.utils.formatUnits(amountBDesired, decimalsB)}`);
      console.log(`   Have B: ${ethers.utils.formatUnits(balanceB, decimalsB)}`);
      continue;
    }

    // Approve tokens
    console.log(`   Approving tokens...`);
    await (await tokenA.approve(routerAddress, amountADesired)).wait();
    await (await tokenB.approve(routerAddress, amountBDesired)).wait();

    // Add liquidity with proper slippage protection
    try {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600; // 10 minutes
      
      console.log(`   Adding liquidity...`);
      const tx = await router.addLiquidity(
        tokenA.address,
        tokenB.address,
        amountADesired,
        amountBDesired,
        amountADesired.mul(95).div(100), // 5% slippage tolerance
        amountBDesired.mul(95).div(100), // 5% slippage tolerance
        deployer.address,
        deadline
      );
      
      await tx.wait();
      console.log(`   ✅ Liquidity added successfully`);

    } catch (err) {
      console.error(`❌ Failed to add liquidity for ${symbolA}-${symbolB}:`, err.message);
      continue;
    }

    // Get pair address
    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
    console.log(`   🔗 Pair address: ${pairAddress}`);

    // Verify the pair was created and has reserves
    try {
      const Pair = await ethers.getContractFactory("UniswapV2Pair");
      const pair = Pair.attach(pairAddress);
      const reserves = await pair.getReserves();
      
      if (reserves && reserves.reserve0 && reserves.reserve1) {
        console.log(`   Reserve 0: ${ethers.utils.formatUnits(reserves.reserve0, 18)}`);
        console.log(`   Reserve 1: ${ethers.utils.formatUnits(reserves.reserve1, 18)}`);
        
        // Get token order
        const token0 = await pair.token0();
        const token1 = await pair.token1();
        
        let reserve0, reserve1, decimals0, decimals1, symbol0, symbol1;
        if (token0.toLowerCase() === tokenA.address.toLowerCase()) {
          reserve0 = reserves.reserve0;
          reserve1 = reserves.reserve1;
          decimals0 = decimalsA;
          decimals1 = decimalsB;
          symbol0 = symbolA;
          symbol1 = symbolB;
        } else {
          reserve0 = reserves.reserve1;
          reserve1 = reserves.reserve0;
          decimals0 = decimalsB;
          decimals1 = decimalsA;
          symbol0 = symbolB;
          symbol1 = symbolA;
        }
        
        console.log(`   ${symbol0} Reserve: ${ethers.utils.formatUnits(reserve0, decimals0)}`);
        console.log(`   ${symbol1} Reserve: ${ethers.utils.formatUnits(reserve1, decimals1)}`);
        
        // Calculate pool prices safely
        if (reserve0.gt(0) && reserve1.gt(0)) {
          const price0 = reserve1.mul(ethers.utils.parseUnits("1", decimals0)).div(reserve0);
          const price1 = reserve0.mul(ethers.utils.parseUnits("1", decimals1)).div(reserve1);
          
          console.log(`   Pool price: 1 ${symbol0} = ${ethers.utils.formatUnits(price0, decimals1)} ${symbol1}`);
          console.log(`   Pool price: 1 ${symbol1} = ${ethers.utils.formatUnits(price1, decimals0)} ${symbol0}`);
        }
      } else {
        console.log(`   ⚠️ Could not fetch reserves for pair ${symbolA}-${symbolB}`);
      }
    } catch (reserveError) {
      console.log(`   ⚠️ Error fetching reserves for ${symbolA}-${symbolB}:`, reserveError.message);
    }

    // Store pair info
    if (!deployData["Pairs"]) deployData["Pairs"] = {};
    if (!deployData["Pairs"][netName]) deployData["Pairs"][netName] = {};
    deployData["Pairs"][netName][`${symbolA}-${symbolB}`] = {
      address: pairAddress,
      priceA: priceA.toString(),
      priceB: priceB.toString(),
      tokenA: tokenA.address,
      tokenB: tokenB.address,
      symbolA: symbolA,
      symbolB: symbolB
    };
  }

  // 5. Save deployment data
  const filePath = path.join(__dirname, "deployed-contracts.json");
  let existingData = {};
  if (fs.existsSync(filePath)) {
    existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  const mergedData = { ...existingData };
  for (const key of Object.keys(deployData)) {
    if (!mergedData[key]) mergedData[key] = {};
    if (key === "Pairs") {
      if (!mergedData[key][netName]) mergedData[key][netName] = {};
      mergedData[key][netName] = {
        ...mergedData[key][netName],
        ...deployData[key][netName],
      };
    } else {
      mergedData[key][netName] = deployData[key][netName];
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(mergedData, null, 2));
  console.log(`\n✅ Deployment saved to ${filePath}`);
  
  // Summary
  console.log("\n📊 DEPLOYMENT SUMMARY");
  console.log("====================");
  console.log(`Network: ${netName}`);
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Router: ${routerAddress}`);
  console.log(`Pairs created: ${Object.keys(deployData["Pairs"]?.[netName] || {}).length}`);
  
  console.log("\nToken Addresses:");
  for (const symbol of TOKENS) {
    console.log(`${symbol}: ${deployData[symbol][netName].address}`);
  }
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});