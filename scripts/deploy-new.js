const fs = require("fs");
const path = require("path");
const hre = require("hardhat");
const { ethers, network } = hre;
const ether = ethers.utils.parseEther;
const TOKENS = [ "USDC", "WETH","DAI", "WBTC", "ARB", "USDT"];

// Generate all pairs
function generateAllPairs(tokens) {
  // tokens = tokens.filter((i) => !["ARB", "WBTC"].includes(i));
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
  USDT: { decimals: 6, name: "Tether USD" },
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName = network.name;
  const deployData = {};

  console.log(`🔨 Network: ${netName}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  const signer = await ethers.getSigner();
  console.log("Deployer:", deployer.address);
  console.log("Signer:", signer.address);

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

  // 1. Deploy tokens with special handling for WETH
  const Token = await ethers.getContractFactory("Token");
  const WETH = await ethers.getContractFactory("WETH"); // 🔥 NEW: WETH contract factory
  const tokenMap = {};

  console.log("\n📦 Deploying Tokens...");
  for (const symbol of TOKENS) {
    const config = TOKEN_CONFIG[symbol];
    const decimals = config.decimals;

    // Mint a very large supply to ensure enough liquidity
    const pairsPerToken = TOKENS.length - 1;
    const liquidityPerPair = 50000;
    const price = parseFloat(mockPrices[getOracleKey(symbol)]?.price || "1");
    const tokensNeededPerPair = liquidityPerPair / price;
    const totalTokensNeeded = tokensNeededPerPair * pairsPerToken * 3;
    const minSupply = Math.max(totalTokensNeeded, 1000000000000);

    const mintAmountPerToken = {
      6: "1000000000000",
      8: "100000000000000", 
      18: "1000000000000000000000000",
    };

    const totalSupply = ethers.BigNumber.from(mintAmountPerToken[decimals]);

    let token;
    let address;

    // 🔥 SPECIAL HANDLING FOR WETH
    if (symbol === "WETH") {
      console.log(`🔄 Deploying WETH as proper wrapped ether contract...`);
      
      // Deploy WETH contract (no constructor parameters needed)
      token = await WETH.deploy();
      await token.deployed();
      address = token.address;

      // 🔥 FUND WETH BY DEPOSITING ETH
      console.log(`💰 Depositing ETH to mint WETH tokens...`);
      const ethAmountToDeposit = ethers.utils.parseEther("0.2"); // Deposit 1000 ETH to get 1000 WETH
      
      const depositTx = await token.deposit({ value: ethAmountToDeposit });
      await depositTx.wait();
      
      console.log(`✅ Deposited ${ethers.utils.formatEther(ethAmountToDeposit)} ETH`);
      
      // Check WETH balance
      const wethBalance = await token.balanceOf(deployer.address);
      console.log(`✅ WETH Balance: ${ethers.utils.formatEther(wethBalance)}`);

    } else {
      // 🔄 DEPLOY REGULAR ERC20 TOKENS
      console.log(`🔄 Deploying ${symbol} as regular ERC20...`);
      
      token = await Token.deploy(config.name, symbol, totalSupply);
      await token.deployed();
      address = token.address;
    }

    const balance = await token.balanceOf(deployer.address);
    console.log(
      `${symbol} balance:`,
      ethers.utils.formatUnits(balance, decimals)
    );

    const ownerBalance = await token.balanceOf(deployer.address);
    const tokenSymbol = await token.symbol();
    const tokenDecimals = await token.decimals();

    console.log(`✅ ${symbol}: ${address}`);
    console.log(`   Price: ${price}`);
    console.log(`   Tokens needed per pair: ${tokensNeededPerPair.toFixed(6)}`);
    console.log(`   Total pairs for this token: ${pairsPerToken}`);
    console.log(`   Total supply minted: ${minSupply.toFixed(6)}`);
    console.log(
      `   Supply: ${ethers.utils.formatUnits(totalSupply, decimals)}`
    );
    console.log(
      `   Owner Balance: ${ethers.utils.formatUnits(ownerBalance, decimals)}`
    );
    console.log(`   Decimals: ${tokenDecimals}`);

    tokenMap[symbol] = token;

    deployData[symbol] = {
      [netName]: {
        address,
        deployer: deployer.address,
        decimals: tokenDecimals,
        totalSupply: symbol === "WETH" ? "0" : totalSupply.toString(), // WETH supply is dynamic
        contractType: symbol === "WETH" ? "WETH" : "ERC20", // 🔥 Track contract type
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

  // 3. Deploy Router with WETH address
  const Router = await ethers.getContractFactory("UniswapV2Router02");
  const router = await Router.deploy(factoryAddress, tokenMap["WETH"].address); // 🔥 Using proper WETH address
  await router.deployed();

  const routerAddress = router.address;
  console.log(`🧭 Router deployed: ${routerAddress}`);
  console.log(`🔗 Router connected to WETH: ${tokenMap["WETH"].address}`);
  deployData["UniswapV2Router02"] = {
    [netName]: {
      address: routerAddress,
      deployer: deployer.address,
      wethAddress: tokenMap["WETH"].address, // 🔥 Store WETH reference
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
      console.warn(
        `⚠️ Skipping ${symbolA}-${symbolB} due to missing price data`
      );
      continue;
    }

    const priceA = parseFloat(priceDataA.price);
    const priceB = parseFloat(priceDataB.price);

    console.log(`   ${symbolA} price: $${priceA}`);
    console.log(`   ${symbolB} price: $${priceB}`);

    const decimalsA = await tokenA.decimals();
    const decimalsB = await tokenB.decimals();

    // Calculate liquidity amounts
    const baseLiquidityUSD = symbolA ;
    const amountAInTokens = baseLiquidityUSD / priceA;
    const amountBInTokens = baseLiquidityUSD / priceB;

    const amountADesired = ethers.utils.parseUnits(
      amountAInTokens.toFixed(decimalsA),
      decimalsA
    );
    const amountBDesired = ethers.utils.parseUnits(
      amountBInTokens.toFixed(decimalsB),
      decimalsB
    );

    console.log(`   Amount A: ${amountAInTokens.toFixed(6)} ${symbolA}`);
    console.log(`   Amount B: ${amountBInTokens.toFixed(6)} ${symbolB}`);

    // Check and ensure sufficient balances
    const balanceA = await tokenA.balanceOf(deployer.address);
    const balanceB = await tokenB.balanceOf(deployer.address);
    
    console.log(
      `   ${symbolA} balance: ${ethers.utils.formatUnits(balanceA, decimalsA)} required: ${ethers.utils.formatUnits(amountADesired, decimalsA)}`
    );
    console.log(
      `   ${symbolB} balance: ${ethers.utils.formatUnits(balanceB, decimalsB)} required: ${ethers.utils.formatUnits(amountBDesired, decimalsB)}`
    );
    
    // 🔥 HANDLE INSUFFICIENT WETH BALANCE
    if (symbolA === "WETH" && balanceA.lt(amountADesired)) {
      const missingWETH = amountADesired.sub(balanceA);
      const extraWETH = ethers.utils.parseEther("100"); // Extra 100 WETH
      const totalETHNeeded = missingWETH.add(extraWETH);
      
      console.log(`💰 Depositing ${ethers.utils.formatEther(totalETHNeeded)} ETH to get more WETH...`);
      const depositTx = await tokenA.deposit({ value: totalETHNeeded });
      await depositTx.wait();
      console.log(`✅ WETH balance increased`);
    }
    
    if (symbolB === "WETH" && balanceB.lt(amountBDesired)) {
      const missingWETH = amountBDesired.sub(balanceB);
      const extraWETH = ethers.utils.parseEther("100"); // Extra 100 WETH
      const totalETHNeeded = missingWETH.add(extraWETH);
      
      console.log(`💰 Depositing ${ethers.utils.formatEther(totalETHNeeded)} ETH to get more WETH...`);
      const depositTx = await tokenB.deposit({ value: totalETHNeeded });
      await depositTx.wait();
      console.log(`✅ WETH balance increased`);
    }

    // Handle regular token minting
    if (symbolA !== "WETH" && balanceA.lt(amountADesired)) {
      const missingA = amountADesired.sub(balanceA);
      const extraAAmount = ethers.utils.parseUnits("0.05", decimalsA);
      const mintAmountA = missingA.add(extraAAmount);

      console.log(`⚠️ Minting ${symbolA}: missing ${ethers.utils.formatUnits(missingA, decimalsA)} (+ extra 10000)`);
      const mintTxA = await tokenA.connect(deployer).mint(mintAmountA);
      await mintTxA.wait();
    }

    if (symbolB !== "WETH" && balanceB.lt(amountBDesired)) {
      const missingB = amountBDesired.sub(balanceB);
      const extraBAmount = ethers.utils.parseUnits("10000", decimalsB);
      const mintAmountB = missingB.add(extraBAmount);

      console.log(`⚠️ Minting ${symbolB}: missing ${ethers.utils.formatUnits(missingB, decimalsB)} (+ extra 10000)`);
      const mintTxB = await tokenB.connect(deployer).mint(mintAmountB);
      await mintTxB.wait();
    }

    // Approve tokens
    console.log(`   Approving tokens...`);
    await (await tokenA.approve(routerAddress, amountADesired)).wait();
    await (await tokenB.approve(routerAddress, amountBDesired)).wait();

    // Add liquidity with proper slippage protection
    try {
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 600;

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
      console.error(
        `❌ Failed to add liquidity for ${symbolA}-${symbolB}:`,
        err.message
      );
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
        console.log(
          `   Reserve 0: ${ethers.utils.formatUnits(reserves.reserve0, 18)}`
        );
        console.log(
          `   Reserve 1: ${ethers.utils.formatUnits(reserves.reserve1, 18)}`
        );

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

        console.log(
          `   ${symbol0} Reserve: ${ethers.utils.formatUnits(reserve0, decimals0)}`
        );
        console.log(
          `   ${symbol1} Reserve: ${ethers.utils.formatUnits(reserve1, decimals1)}`
        );

        // Calculate pool prices safely
        if (reserve0.gt(0) && reserve1.gt(0)) {
          const price0 = reserve1
            .mul(ethers.utils.parseUnits("1", decimals0))
            .div(reserve0);
          const price1 = reserve0
            .mul(ethers.utils.parseUnits("1", decimals1))
            .div(reserve1);

          console.log(
            `   Pool price: 1 ${symbol0} = ${ethers.utils.formatUnits(
              price0,
              decimals1
            )} ${symbol1}`
          );
          console.log(
            `   Pool price: 1 ${symbol1} = ${ethers.utils.formatUnits(
              price1,
              decimals0
            )} ${symbol0}`
          );
        }
      } else {
        console.log(
          `   ⚠️ Could not fetch reserves for pair ${symbolA}-${symbolB}`
        );
      }
    } catch (reserveError) {
      console.log(
        `   ⚠️ Error fetching reserves for ${symbolA}-${symbolB}:`,
        reserveError.message
      );
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
      symbolB: symbolB,
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
  console.log(`WETH: ${tokenMap["WETH"].address} (Proper WETH Contract)`); // 🔥 Highlight WETH
  console.log(
    `Pairs created: ${Object.keys(deployData["Pairs"]?.[netName] || {}).length}`
  );

  console.log("\nToken Addresses:");
  for (const symbol of TOKENS) {
    const contractType = symbol === "WETH" ? "(WETH Contract)" : "(ERC20 Token)";
    console.log(`${symbol}: ${deployData[symbol][netName].address} ${contractType}`);
  }

  // 🔥 ADDITIONAL WETH INFO
  console.log("\n🎯 WETH CONTRACT VERIFICATION:");
  const wethContract = tokenMap["WETH"];
  const wethBalance = await wethContract.balanceOf(deployer.address);
  const contractETHBalance = await ethers.provider.getBalance(wethContract.address);
  
  console.log(`WETH Balance: ${ethers.utils.formatEther(wethBalance)}`);
  console.log(`Contract ETH Balance: ${ethers.utils.formatEther(contractETHBalance)}`);
  console.log(`Total Supply: ${ethers.utils.formatEther(await wethContract.totalSupply())}`);
  console.log("✅ WETH is ready for router operations!");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});