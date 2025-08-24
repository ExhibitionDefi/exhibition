# Exhibition Launchpad

A comprehensive decentralized launchpad platform for token creation, fundraising, and automated market making on Nexus Layer 1 blockchains.

## 🌟 Overview

Exhibition is a complete ecosystem that enables projects to:
- Deploy custom ERC20 tokens
- Launch fundraising campaigns with soft/hard caps
- Provide initial liquidity through an integrated AMM
- Implement token vesting schedules
- Manage liquidity locks for project security

The platform consists of four main smart contracts working together to provide a seamless launchpad experience.

## 📋 Table of Contents

- [Architecture](#-architecture)
- [Core Features](#-core-features)
- [Smart Contracts](#-smart-contracts)
- [Project Lifecycle](#-project-lifecycle)
- [Tokenomics](#-tokenomics)
- [Security Features](#-security-features)
- [Usage Guide](#-usage-guide)
- [API Reference](#-api-reference)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Contributing](#-contributing)

## 🏗 Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Exhibition    │◄──►│ExhibitionFactory │◄──►│   SimpleERC20   │
│  (Main Hub)     │    │  (Token Creator) │    │ (Project Tokens)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               
         ▼                                               
┌─────────────────┐    ┌──────────────────┐              
│ ExhibitionAMM   │◄──►│ExhibitionLPTokens│              
│ (DEX & Swaps)   │    │  (LP Management) │              
└─────────────────┘    └──────────────────┘              
```

## ✨ Core Features

### 🚀 Token Launchpad
- **Custom Token Creation**: Deploy ERC20 tokens with custom parameters
- **Fundraising Campaigns**: Configurable soft/hard caps and contribution limits
- **Flexible Timing**: Custom start/end times with built-in delays
- **Multi-Token Support**: Accept various contribution tokens (EXH, exUSDT, exNEX)

### 💧 Automated Market Maker (AMM)
- **Uniswap V2 Compatible**: Proven AMM architecture
- **Liquidity Pools**: Create and manage token pairs
- **Price Discovery**: Automatic price calculation via constant product formula
- **TWAP Oracle**: Time-weighted average price for enhanced security

### 🔒 Security & Governance
- **Liquidity Locks**: Mandatory liquidity locking for project tokens
- **Vesting Schedules**: Customizable token vesting with cliff periods
- **Platform Fees**: Configurable fee structure for sustainability
- **Emergency Controls**: Owner-controlled pause and recovery mechanisms

### 🎯 User Experience
- **Faucet System**: Testnet token distribution for testing
- **Real-time Updates**: Event-driven status tracking
- **Slippage Protection**: User-defined slippage tolerance
- **Deadline Protection**: Transaction expiry for MEV protection

## 📚 Smart Contracts

### 1. Exhibition.sol (Main Contract)
The central hub managing the entire launchpad ecosystem.

**Key Responsibilities:**
- Project creation and management
- Contribution processing
- Token distribution and vesting
- Platform fee collection
- Integration with other contracts

### 2. ExhibitionFactory.sol
Responsible for deploying new ERC20 tokens.

**Key Features:**
- Permissioned token creation
- Standardized token deployment
- Ownership transfer to project creators
- Creation tracking and analytics

### 3. ExhibitionAMM.sol
Automated Market Maker for token swapping and liquidity provision.

**Key Features:**
- Liquidity pool creation and management
- Token swapping with slippage protection
- Liquidity lock enforcement for projects
- TWAP price oracle functionality

### 4. ExhibitionLPTokens.sol
Manages liquidity provider tokens for all trading pairs.

**Key Features:**
- Multi-pair LP token management
- ERC20-like interface for each pair
- Controlled minting and burning
- Transfer and approval mechanisms

## 🔄 Project Lifecycle

### Phase 1: Project Creation
```solidity
function createLaunchpadProject(
    string memory _projectTokenName,
    string memory _projectTokenSymbol,
    uint256 _initialTotalSupply,
    // ... other parameters
) external returns (uint256 projectId, address projectTokenAddress)
```

1. **Token Deployment**: New ERC20 token created via factory
2. **Project Registration**: Core parameters stored on-chain
3. **Vesting Configuration**: Optional vesting schedule setup
4. **Status**: Project moves to `Upcoming` state

### Phase 2: Token Deposit
```solidity
function depositProjectTokens(uint256 _projectId, uint256 _amount) external
```

1. **Token Approval**: Project owner approves Exhibition contract
2. **Token Transfer**: Tokens for sale deposited to Exhibition
3. **Status Update**: Project becomes `Active`
4. **Ready for Contributions**: Users can now contribute

### Phase 3: Fundraising Period
```solidity
function contribute(uint256 _projectId, uint256 _amount) external
```

1. **Contribution Processing**: Users send contribution tokens
2. **Cap Monitoring**: Automatic hard cap detection
3. **Status Updates**: Real-time progress tracking
4. **Instant Finalization**: Hard cap triggers immediate success

### Phase 4: Project Finalization
```solidity
function finalizeProject(uint256 _projectId) external
```

1. **Time Check**: After end time, anyone can finalize
2. **Soft Cap Evaluation**: Success/failure determination
3. **Status Update**: Final project status set
4. **Next Phase**: Enables claiming or refunds

### Phase 5: Liquidity & Distribution
```solidity
function finalizeLiquidityAndReleaseFunds(uint256 _projectId) external
```

1. **Platform Fees**: Automatic fee collection
2. **Liquidity Addition**: AMM pool creation with locks
3. **Fund Release**: Remaining funds to project owner
4. **Token Claims**: Contributors can claim their tokens

## 💰 Tokenomics

### Platform Tokens

#### EXH (Exhibition Token)
- **Utility**: Primary platform token
- **Use Cases**: Contributions, governance, staking
- **Decimals**: 18
- **Mintable**: Yes (owner controlled)

#### exUSDT (Exhibition USDT)
- **Purpose**: Stable contribution token
- **Decimals**: 6 (matching USDT standard)
- **Backing**: Platform-managed stablecoin
- **Mintable**: Yes (for faucet and testing)

#### exNEX (Wrapped Native)
- **Purpose**: Wrapped native chain token
- **Use**: Native token representation in AMM
- **Decimals**: 18
- **Integration**: Automatic wrapping/unwrapping

### Fee Structure

```solidity
// Platform fee percentage (basis points)
uint256 public platformFeePercentage; // e.g., 500 = 5%

// Collected on successful projects only
// Applied to total raised amount before liquidity
```

### Token Price Calculations

The platform uses a robust calculation system with decimal handling:

```solidity
// Price always in 18-decimal format
uint256 public constant PRICE_DECIMALS = 18;

// Example: 0.001 tokens per contribution token = 1000000000000000
uint256 tokenPrice = 0.001 * 10**18;
```

## 🛡 Security Features

### Access Controls
- **Ownable**: Critical functions restricted to contract owner
- **ReentrancyGuard**: Protection against reentrancy attacks
- **SafeERC20**: Secure token transfers with failure handling

### Input Validation
```solidity
// Time constraints
uint256 public immutable MIN_START_DELAY = 15 minutes;
uint256 public immutable MAX_PROJECT_DURATION = 7 days;

// Price bounds
uint256 public constant MIN_TOKEN_PRICE = 1e12;  // 0.000001
uint256 public constant MAX_TOKEN_PRICE = 1e24;  // 1,000,000
```

### Liquidity Protection
```solidity
// Mandatory liquidity locks for projects
struct LiquidityLock {
    uint256 projectId;
    address projectOwner;
    uint256 unlockTime;
    uint256 lockedLPAmount;
    bool isActive;
}
```

## 📖 Usage Guide

### TypeScript Types and Interfaces

```typescript
import { BigNumber, ContractTransaction, ContractReceipt } from 'ethers';

// Contract interfaces
interface IExhibition {
  createLaunchpadProject: (...args: any[]) => Promise<ContractTransaction>;
  depositProjectTokens: (projectId: BigNumber, amount: BigNumber) => Promise<ContractTransaction>;
  contribute: (projectId: BigNumber, amount: BigNumber) => Promise<ContractTransaction>;
  claimTokens: (projectId: BigNumber) => Promise<ContractTransaction>;
  requestRefund: (projectId: BigNumber) => Promise<ContractTransaction>;
  finalizeProject: (projectId: BigNumber) => Promise<ContractTransaction>;
  finalizeLiquidityAndReleaseFunds: (projectId: BigNumber) => Promise<ContractTransaction>;
  requestFaucetTokens: () => Promise<ContractTransaction>;
}

interface IERC20 {
  approve: (spender: string, amount: BigNumber) => Promise<ContractTransaction>;
  balanceOf: (account: string) => Promise<BigNumber>;
  transfer: (to: string, amount: BigNumber) => Promise<ContractTransaction>;
}

interface IExhibitionAMM {
  addLiquidity: (...args: any[]) => Promise<ContractTransaction>;
  removeLiquidity: (...args: any[]) => Promise<ContractTransaction>;
  swapTokenForToken: (...args: any[]) => Promise<ContractTransaction>;
  getAmountOut: (amountIn: BigNumber, tokenIn: string, tokenOut: string) => Promise<BigNumber>;
  getPrice: (tokenA: string, tokenB: string) => Promise<BigNumber>;
  getTWAP: (tokenA: string, tokenB: string, period: number) => Promise<BigNumber>;
}

// Project creation parameters
interface ProjectCreationParams {
  projectTokenName: string;
  projectTokenSymbol: string;
  initialTotalSupply: BigNumber;
  logoURI: string;
  contributionToken: string;
  fundingGoal: BigNumber;
  softCap: BigNumber;
  minContribution: BigNumber;
  maxContribution: BigNumber;
  tokenPrice: BigNumber;
  startTime: number;
  endTime: number;
  tokensForSale: BigNumber;
  liquidityPercentage: number;
  liquidityLockDuration: number;
  vestingEnabled: boolean;
  vestingCliff: number;
  vestingDuration: number;
  vestingInterval: number;
  initialReleasePercentage: number;
}

// Liquidity parameters
interface LiquidityParams {
  tokenA: string;
  tokenB: string;
  amountADesired: BigNumber;
  amountBDesired: BigNumber;
  amountAMin: BigNumber;
  amountBMin: BigNumber;
  recipient: string;
  deadline: number;
}

// Swap parameters
interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  minAmountOut: BigNumber;
  recipient: string;
  deadline: number;
}
```

### For Project Owners

#### 1. Create Your Project
```typescript
import { ethers, BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';

interface CreateProjectResult {
  transaction: ContractTransaction;
  projectId: BigNumber;
  tokenAddress: string;
}

async function createProject(
  exhibition: IExhibition,
  params: ProjectCreationParams
): Promise<CreateProjectResult> {
  const tx: ContractTransaction = await exhibition.createLaunchpadProject(
    params.projectTokenName,       // "MyToken"
    params.projectTokenSymbol,     // "MTK"
    params.initialTotalSupply,     // parseEther("1000000")
    params.logoURI,                // "https://logo.url"
    params.contributionToken,      // exUSDTAddress
    params.fundingGoal,            // parseUnits("10000", 6) - 10k USDT
    params.softCap,                // parseUnits("5000", 6) - 5k USDT
    params.minContribution,        // parseUnits("10", 6)
    params.maxContribution,        // parseUnits("1000", 6)
    params.tokenPrice,             // parseEther("0.001") - 0.001 per USDT
    params.startTime,              // startTime
    params.endTime,                // endTime
    params.tokensForSale,          // parseEther("500000")
    params.liquidityPercentage,    // 8000 - 80% liquidity
    params.liquidityLockDuration,  // 86400 * 30 - 30-day lock
    params.vestingEnabled,         // true
    params.vestingCliff,           // 86400 * 7 - 7-day cliff
    params.vestingDuration,        // 86400 * 90 - 90-day total vesting
    params.vestingInterval,        // 86400 - daily unlock
    params.initialReleasePercentage // 1000 - 10% initial release
  );

  const receipt: ContractReceipt = await tx.wait();
  
  // Type-safe event parsing
  const projectCreatedEvent = receipt.events?.find(
    (event) => event.event === 'ProjectCreated'
  );

  if (!projectCreatedEvent?.args) {
    throw new Error('Project creation event not found');
  }

  return {
    transaction: tx,
    projectId: projectCreatedEvent.args.projectId as BigNumber,
    tokenAddress: projectCreatedEvent.args.projectTokenAddress as string
  };
}

// Usage example
const projectParams: ProjectCreationParams = {
  projectTokenName: "MyToken",
  projectTokenSymbol: "MTK",
  initialTotalSupply: parseEther("1000000"),
  logoURI: "https://logo.url",
  contributionToken: exUSDTAddress,
  fundingGoal: parseUnits("10000", 6),
  softCap: parseUnits("5000", 6),
  minContribution: parseUnits("10", 6),
  maxContribution: parseUnits("1000", 6),
  tokenPrice: parseEther("0.001"),
  startTime: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  endTime: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days from now
  tokensForSale: parseEther("500000"),
  liquidityPercentage: 8000,
  liquidityLockDuration: 86400 * 30,
  vestingEnabled: true,
  vestingCliff: 86400 * 7,
  vestingDuration: 86400 * 90,
  vestingInterval: 86400,
  initialReleasePercentage: 1000
};

const result: CreateProjectResult = await createProject(exhibition, projectParams);
console.log(`Project created with ID: ${result.projectId} and token address: ${result.tokenAddress}`);
```

#### 2. Deposit Tokens for Sale
```typescript
async function depositProjectTokens(
  exhibition: IExhibition,
  projectToken: IERC20,
  exhibitionAddress: string,
  projectId: BigNumber,
  tokensForSale: BigNumber
): Promise<ContractTransaction> {
  // First approve the Exhibition contract
  const approveTx: ContractTransaction = await projectToken.approve(
    exhibitionAddress, 
    tokensForSale
  );
  await approveTx.wait();

  // Then deposit
  const depositTx: ContractTransaction = await exhibition.depositProjectTokens(
    projectId, 
    tokensForSale
  );
  
  return depositTx;
}

// Usage
const depositTx = await depositProjectTokens(
  exhibition,
  projectToken,
  exhibitionAddress,
  BigNumber.from(1), // projectId
  parseEther("500000") // tokensForSale
);
await depositTx.wait();
```

#### 3. Add Initial Liquidity (After Success)
```typescript
async function finalizeLiquidityAndReleaseFunds(
  exhibition: IExhibition,
  projectToken: IERC20,
  exhibitionAddress: string,
  projectId: BigNumber,
  liquidityTokens: BigNumber
): Promise<ContractTransaction> {
  // Approve tokens for liquidity
  const approveTx: ContractTransaction = await projectToken.approve(
    exhibitionAddress, 
    liquidityTokens
  );
  await approveTx.wait();

  // Finalize liquidity and release funds
  const finalizeTx: ContractTransaction = await exhibition.finalizeLiquidityAndReleaseFunds(
    projectId
  );
  
  return finalizeTx;
}
```

### For Contributors

#### 1. Get Testnet Tokens
```typescript
async function requestFaucetTokens(
  exhibition: IExhibition
): Promise<ContractTransaction> {
  // Request faucet tokens (if on testnet)
  const faucetTx: ContractTransaction = await exhibition.requestFaucetTokens();
  return faucetTx;
}

// Usage
const faucetTx = await requestFaucetTokens(exhibition);
await faucetTx.wait();
console.log('Faucet tokens requested successfully');
```

#### 2. Contribute to Projects
```typescript
async function contributeToProject(
  exhibition: IExhibition,
  contributionToken: IERC20,
  exhibitionAddress: string,
  projectId: BigNumber,
  contributionAmount: BigNumber
): Promise<ContractTransaction> {
  // Approve contribution token
  const approveTx: ContractTransaction = await contributionToken.approve(
    exhibitionAddress, 
    contributionAmount
  );
  await approveTx.wait();

  // Make contribution
  const contributeTx: ContractTransaction = await exhibition.contribute(
    projectId, 
    contributionAmount
  );
  
  return contributeTx;
}

// Usage
const contributeTx = await contributeToProject(
  exhibition,
  exUSDT,
  exhibitionAddress,
  BigNumber.from(1), // projectId
  parseUnits("100", 6) // 100 USDT contribution
);
await contributeTx.wait();
```

#### 3. Claim Your Tokens
```typescript
async function claimProjectTokens(
  exhibition: IExhibition,
  projectId: BigNumber
): Promise<ContractTransaction> {
  // Claim vested tokens (can be called multiple times)
  const claimTx: ContractTransaction = await exhibition.claimTokens(projectId);
  return claimTx;
}

// Usage
const claimTx = await claimProjectTokens(exhibition, BigNumber.from(1));
await claimTx.wait();
console.log('Tokens claimed successfully');
```

### For Liquidity Providers

#### 1. Add Liquidity to AMM
```typescript
async function addLiquidity(
  amm: IExhibitionAMM,
  params: LiquidityParams
): Promise<ContractTransaction> {
  const addLiquidityTx: ContractTransaction = await amm.addLiquidity(
    params.tokenA,
    params.tokenB,
    params.amountADesired,
    params.amountBDesired,
    params.amountAMin,
    params.amountBMin,
    params.recipient,
    params.deadline
  );
  
  return addLiquidityTx;
}

// Usage
const liquidityParams: LiquidityParams = {
  tokenA: tokenAAddress,
  tokenB: tokenBAddress,
  amountADesired: parseEther("1000"),
  amountBDesired: parseEther("2000"),
  amountAMin: parseEther("950"),
  amountBMin: parseEther("1900"),
  recipient: userAddress,
  deadline: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
};

const liquidityTx = await addLiquidity(amm, liquidityParams);
await liquidityTx.wait();
```

#### 2. Remove Liquidity
```typescript
interface RemoveLiquidityParams {
  tokenA: string;
  tokenB: string;
  lpAmount: BigNumber;
  amountAMin: BigNumber;
  amountBMin: BigNumber;
  recipient: string;
  deadline: number;
}

async function removeLiquidity(
  amm: IExhibitionAMM,
  params: RemoveLiquidityParams
): Promise<ContractTransaction> {
  const removeLiquidityTx: ContractTransaction = await amm.removeLiquidity(
    params.tokenA,
    params.tokenB,
    params.lpAmount,
    params.amountAMin,
    params.amountBMin,
    params.recipient,
    params.deadline
  );
  
  return removeLiquidityTx;
}
```

### For Traders

#### 1. Swap Tokens
```typescript
async function swapTokens(
  amm: IExhibitionAMM,
  params: SwapParams
): Promise<ContractTransaction> {
  const swapTx: ContractTransaction = await amm.swapTokenForToken(
    params.tokenIn,
    params.tokenOut,
    params.amountIn,
    params.minAmountOut,
    params.recipient,
    params.deadline
  );
  
  return swapTx;
}

// Usage
const swapParams: SwapParams = {
  tokenIn: tokenAAddress,
  tokenOut: tokenBAddress,
  amountIn: parseEther("100"),
  minAmountOut: parseEther("190"), // 5% slippage
  recipient: userAddress,
  deadline: Math.floor(Date.now() / 1000) + 1800
};

const swapTx = await swapTokens(amm, swapParams);
await swapTx.wait();
```

#### 2. Check Prices
```typescript
interface PriceInfo {
  amountOut: BigNumber;
  currentPrice: BigNumber;
  twapPrice: BigNumber;
}

async function getPriceInfo(
  amm: IExhibitionAMM,
  amountIn: BigNumber,
  tokenIn: string,
  tokenOut: string,
  twapPeriod: number = 3600 // 1 hour
): Promise<PriceInfo> {
  const [amountOut, currentPrice, twapPrice] = await Promise.all([
    amm.getAmountOut(amountIn, tokenIn, tokenOut),
    amm.getPrice(tokenIn, tokenOut),
    amm.getTWAP(tokenIn, tokenOut, twapPeriod)
  ]);

  return {
    amountOut,
    currentPrice,
    twapPrice
  };
}

// Usage
const priceInfo: PriceInfo = await getPriceInfo(
  amm,
  parseEther("1"), // 1 token
  tokenAAddress,
  tokenBAddress,
  3600 // 1 hour TWAP
);

console.log(`Current price: ${ethers.utils.formatEther(priceInfo.currentPrice)}`);
console.log(`TWAP price: ${ethers.utils.formatEther(priceInfo.twapPrice)}`);
```

## 🔧 API Reference

### Exhibition Contract

#### Project Management
```solidity
// Create new launchpad project
function createLaunchpadProject(...) external returns (uint256, address)

// Deposit tokens for sale
function depositProjectTokens(uint256 _projectId, uint256 _amount) external

// Contribute to project
function contribute(uint256 _projectId, uint256 _amount) external

// Finalize project after time expires
function finalizeProject(uint256 _projectId) external

// Claim tokens with vesting
function claimTokens(uint256 _projectId) external

// Request refund for failed projects
function requestRefund(uint256 _projectId) external
```

#### Admin Functions
```solidity
// Set platform fee percentage
function setPlatformFeePercentage(uint256 _newPercentage) external onlyOwner

// Add approved contribution token
function addExhibitionContributionToken(address _tokenAddress) external onlyOwner

// Withdraw accumulated fees
function withdrawAccumulatedFees(address _tokenAddress, address _recipient) external onlyOwner
```

### ExhibitionAMM Contract

#### Liquidity Management
```solidity
// Add liquidity to pool
function addLiquidity(...) external returns (uint256, uint256, uint256)

// Remove liquidity from pool
function removeLiquidity(...) external returns (uint256, uint256)

// Add liquidity with lock (Exhibition only)
function addLiquidityWithLock(...) external returns (uint256, uint256, uint256)
```

#### Trading
```solidity
// Swap tokens
function swapTokenForToken(...) external returns (uint256)

// Get swap quote
function getAmountOut(uint256 _amountIn, address _tokenIn, address _tokenOut) 
    external view returns (uint256)

// Get current price
function getPrice(address _tokenA, address _tokenB) 
    external view returns (uint256)
```

#### Pool Information
```solidity
// Get pool details
function getPool(address _tokenA, address _tokenB) 
    external view returns (LiquidityPool memory)

// Get reserves
function getReserves(address _tokenA, address _tokenB) 
    external view returns (uint256, uint256, uint32)

// Check if pool exists
function doesPoolExist(address _tokenA, address _tokenB) 
    external view returns (bool)
```

## 🚀 Deployment

### Prerequisites
- Node.js >= 16.0.0
- TypeScript >= 4.5.0
- Hardhat or Foundry
- EVM-compatible network access

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Deployment Types
```typescript
interface DeploymentConfig {
  networkName: string;
  rpcUrl: string;
  privateKey: string;
  gasPrice?: BigNumber;
  gasLimit?: number;
}

interface ContractAddresses {
  exhibitionLPTokens: string;
  exhibitionAMM: string;
  exhibitionFactory: string;
  exhibition: string;
  exh: string;
  exUSDT: string;
  exNEX: string;
}

interface DeploymentResult {
  addresses: ContractAddresses;
  deploymentBlock: number;
  gasUsed: BigNumber;
  transactionHashes: string[];
}
```

### Deployment Order

1. **Deploy ExhibitionLPTokens**
2. **Deploy ExhibitionAMM** (with LPTokens address)
3. **Deploy ExhibitionFactory**
4. **Deploy Exhibition** (main contract)
5. **Configure contract addresses**
6. **Deploy platform tokens** (EXH, exUSDT, exNEX)
7. **Set up initial configuration**

### Environment Variables
```env
PRIVATE_KEY=your_private_key
RPC_URL=your_rpc_endpoint
ETHERSCAN_API_KEY=your_api_key
```

### Deployment Script Example
```typescript
import { ethers, BigNumber } from 'ethers';
import { ContractFactory, Contract } from 'ethers';

async function deployContracts(): Promise<DeploymentResult> {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying contracts with account: ${deployer.address}`);

  const transactionHashes: string[] = [];
  let totalGasUsed: BigNumber = BigNumber.from(0);

  // 1. Deploy LP Tokens
  const ExhibitionLPTokens: ContractFactory = await ethers.getContractFactory("ExhibitionLPTokens");
  const lpTokens: Contract = await ExhibitionLPTokens.deploy(ethers.constants.AddressZero); // Temporary
  await lpTokens.deployed();
  
  const lpTokensReceipt = await lpTokens.deployTransaction.wait();
  transactionHashes.push(lpTokens.deployTransaction.hash);
  totalGasUsed = totalGasUsed.add(lpTokensReceipt.gasUsed);
  
  // 2. Deploy AMM
  const ExhibitionAMM: ContractFactory = await ethers.getContractFactory("ExhibitionAMM");
  const amm: Contract = await ExhibitionAMM.deploy(
    lpTokens.address,
    exNEXAddress,
    exUSDTAddress
  );
  await amm.deployed();
  
  const ammReceipt = await amm.deployTransaction.wait();
  transactionHashes.push(amm.deployTransaction.hash);
  totalGasUsed = totalGasUsed.add(ammReceipt.gasUsed);
  
  // 3. Update LP Tokens with AMM address
  const updateTx = await lpTokens.setExhibitionAmmAddress(amm.address);
  const updateReceipt = await updateTx.wait();
  transactionHashes.push(updateTx.hash);
  totalGasUsed = totalGasUsed.add(updateReceipt.gasUsed);
  
  // 4. Deploy Factory
  const ExhibitionFactory: ContractFactory = await ethers.getContractFactory("ExhibitionFactory");
  const factory: Contract = await ExhibitionFactory.deploy();
  await factory.deployed();
  
  const factoryReceipt = await factory.deployTransaction.wait();
  transactionHashes.push(factory.deployTransaction.hash);
  totalGasUsed = totalGasUsed.add(factoryReceipt.gasUsed);
  
  // 5. Deploy Exhibition
  const Exhibition: ContractFactory = await ethers.getContractFactory("Exhibition");
  const exhibition: Contract = await Exhibition.deploy();
  await exhibition.deployed();
  
  const exhibitionReceipt = await exhibition.deployTransaction.wait();
  transactionHashes.push(exhibition.deployTransaction.hash);
  totalGasUsed = totalGasUsed.add(exhibitionReceipt.gasUsed);
  
  // 6. Configure addresses
  const configTxs = await Promise.all([
    exhibition.setExhibitionFactoryAddress(factory.address),
    exhibition.setExhibitionAMMAddress(amm.address),
    amm.setExhibitionContract(exhibition.address),
    factory.setExhibitionContractAddress(exhibition.address)
  ]);
  
  for (const tx of configTxs) {
    const receipt = await tx.wait();
    transactionHashes.push(tx.hash);
    totalGasUsed = totalGasUsed.add(receipt.gasUsed);
  }

  const addresses: ContractAddresses = {
    exhibitionLPTokens: lpTokens.address,
    exhibitionAMM: amm.address,
    exhibitionFactory: factory.address,
    exhibition: exhibition.address,
    exh: "", // To be deployed separately
    exUSDT: "", // To be deployed separately
    exNEX: "" // To be deployed separately
  };

  return {
    addresses,
    deploymentBlock: exhibitionReceipt.blockNumber,
    gasUsed: totalGasUsed,
    transactionHashes
  };
}

// Usage
async function main(): Promise<void> {
  try {
    const result: DeploymentResult = await deployContracts();
    console.log("Deployment completed successfully:");
    console.log("Addresses:", result.addresses);
    console.log("Total gas used:", result.gasUsed.toString());
    console.log("Deployment block:", result.deploymentBlock);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main();
=======
# exhibition
A comprehensive decentralized launchpad platform for token creation, fundraising, and automated market making on Nexus Layer 1 blockchains.
>>>>>>> 8f76fca49fa7a945f856f22cfc3184cdb2f0c467
