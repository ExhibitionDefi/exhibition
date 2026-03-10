# Exhibition Token Launch Infrastructure

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.20-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Coverage](https://img.shields.io/badge/coverage-100%25-success.svg)

**A Verifiable Trust & Liquidity Layer for Token Launches on Nexus Layer 1 Blockchain**

[Documentation](#-documentation) • [Architecture](#-architecture) • [Security](#-security-features) • [API](#-api-reference) • [Deployment](#-deployment)

</div>

---

## 🌟 Overview

Exhibition is a deterministic next-generation token launch infrastructure built with security, transparency, verifiablity and user protection at its core. The platform enables projects to launch tokens, raise funds, and provide instant liquidity through an integrated AMM, all while protecting both project and contributors.

### Key Highlights

- ✅ **100% Test Coverage** - Comprehensive testing across all scenarios
- 🏗️ **Modular Architecture** - 11 specialized contracts for maintainability
- 🔒 **Advanced Security** - Multiple protection layers and emergency mechanisms
- 💧 **Integrated AMM** - Uniswap V2 compatible with enhanced features
- 🎯 **User Protection** - Refund mechanisms and emergency safeguards
- ⚡ **Gas Optimized** - Efficient design with minimal overhead

---

## 📋 Table of Contents

- [What's New in v2.0](#-whats-new-in-v20)
- [Architecture](#-architecture)
- [Core Features](#-core-features)
- [Smart Contracts](#-smart-contracts)
- [Project Lifecycle](#-project-lifecycle)
- [Security Features](#-security-features)
- [Usage Guide](#-usage-guide)
- [API Reference](#-api-reference)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)

---

## 🆕 What's New in v2.0

### **Major Improvements**

#### 1. **Modular Architecture**
- Refactored from monolithic to modular design
- 11 specialized contracts for better organization
- Easier auditing and maintenance
- Independent module testing

#### 2. **Enhanced Security Features**

**Emergency Refund System** 🚨
```solidity
// If project owner fails to finalize liquidity within 7 days
// Contributors can get full refunds
function requestEmergencyRefund(uint256 projectId) external;
```

**Pool Creation Protection** 🛡️
```solidity
// Prevents frontrunning attacks on initial liquidity pools
// Only Exhibition contract can create pools for project tokens
mapping(address => bool) public isProjectToken;
```

**Liquidity Lock Enforcement** 🔒
```solidity
// Mandatory 14-days minimum lock for project liquidity on testnet
uint256 public constant MIN_LOCK_DURATION = 14 days;
// Maximum project duration 21-days on testnet
uint256 public immutable MAX_PROJECT_DURATION = 21 days;
```

#### 3. **Improved Token Calculations**
- Robust decimal handling for any token combination
- Precise tokenomics validation
- Comprehensive calculation preview functions
- Batch calculation support

#### 4. **Enhanced View Functions**
```solidity
// New comprehensive query functions
function getProjectDetails(uint256 projectId) external view returns (...);
function getUserProjectSummary(uint256 projectId, address user) external view returns (...);
function isEmergencyRefundAvailable(uint256 projectId) external view returns (...);
function getLiquidityDeadline(uint256 projectId) external view returns (uint256);
```

#### 5. **Contributor Counter** (Optional Feature)
```solidity
// Track unique contributors per project
mapping(uint256 => uint256) public contributorCount;
mapping(uint256 => address[]) public projectContributors;
```

---

## 🏗 Architecture

### **Modular Contract Structure**

```
Exhibition Platform
│
├── 📦 Core Contracts (Orchestrators)
│   ├── Exhibition.sol ........... Main Protocol Orchestrator (Unified entry point for all modules)
│   ├── ExhibitionFactory.sol .... Registry & Deployment (Manages project token creation)
│   ├── ExhibitionAMM.sol ........ AMM Orchestrator (Central hub for swap & liquidity logic)
│   └── ExhibitionLPTokens.sol ... Pool State Manager (Handles LP minting & accounting)
│
├── 🧩 Exhibition Modules (Platform logic inherited by Main Hub)
│   ├── ExhibitionBase.sol ....... Inheritance Foundation (Shared state & constants)
│   ├── ExhibitionConfig.sol ..... Protocol Configuration & Parameters
│   ├── ExhibitionTokenCalc.sol .. Price Discovery & Tokenomic Calculations
│   ├── ExhibitionFaucet.sol ..... Testnet Asset Distribution
│   ├── ExhibitionTokenDeploy .... Standalone Token Implementation Logic
│   ├── ExhibitionProjectCore .... Project Lifecycle & Metadata Management
│   ├── ExhibitionContributions .. Fundraising & Capital Allocation
│   ├── ExhibitionClaims ......... Distribution, Vesting & Locking Schedules
│   ├── ExhibitionRefunds ........ Investor Protection & Withdrawal Logic
│   ├── ExhibitionLiquidity ...... Bridge to AMM (Initial Liquidity Seeding)
│   └── ExhibitionViews .......... External Query functions & Data Aggregation
│
├── 🔧 AMM Modules (Internal logic inherited by AMM Hub)
│   ├── ExhibitionAMMCore ........ Core Swap Logic & Curve Mathematics
│   ├── ExhibitionAMMEarnings .... Revenue Tracking & Fee Distribution
│   ├── ExhibitionAMMErrors ...... Unified Error Definitions & Reverts
│   ├── ExhibitionAMMStorage ..... AMM State & Pool Management
│   ├── ExhibitionAMMFees ........ Dynamic Fee Calculation System
│   ├── ExhibitionAMMLibrary ..... Optimized Pure Mathematical Utilities
│   ├── ExhibitionAMMLocks ....... Liquidity Provider Security & Time-Locks
│   ├── ExhibitionAMMTypes ....... Protocol-wide Structs & Enums
│   └── ExhibitionAMMViews ....... Real-time Pool Metrics & Pricing Queries
│
└── 📚 Libraries & Interfaces (Integration & Communication)
    ├── ExLibrary.sol ............ Shared Utility Helper Functions
    ├── IExhibitionAMM.sol ....... Full AMM Interface
    ├── IExhibitionLPTokens.sol .. LP Token Standard Interface
    ├── IExhibitionPlatform.sol .. Main Protocol Interface
    └── IExhibitionMinimal.sol ... Cross-Contract Bridge (AMM-to-Platform communication)

```

### **Contract Interactions**

```
┌─────────────────────────────────────────────────────┐
│                  Exhibition (Main)                   │
│  ┌──────────────────────────────────────────────┐  │
│  │ Config │ Faucet │ Projects │ Claims │ Views  │  │
│  └──────────────────────────────────────────────┘  │
└─────────────┬──────────────────┬────────────────────┘
              │                  │
              ▼                  ▼
    ┌─────────────────┐   ┌──────────────┐
    │ ExhibitionFactory│   │ExhibitionAMM │
    │  (Token Creator) │   │  (DEX/Swaps) │
    └─────────────────┘   └──────────────┘
              │                  │
              ▼                  ▼
    ┌─────────────────┐   ┌──────────────┐
    │  Project Tokens │   │  LP Tokens   │
    │   (ERC20)       │   │ (Multi-Pair) │
    └─────────────────┘   └──────────────┘
```

---

## ✨ Core Features

### 🚀 Token Launchpad

#### **Project Creation**
- Custom ERC20 token deployment
- Flexible fundraising parameters
- Soft cap & hard cap configuration
- Minimum & maximum contribution limits
- Custom timing (start/end dates)

#### **Tokenomics Validation**
```solidity
// Automatic validation ensures:
- tokensForSale = fundingGoal / tokenPrice
- softCap ≥ 51% of fundingGoal
- totalSupply sufficient for sale + liquidity
- liquidityPercentage between 70-100%
```

#### **Vesting Support**
- Optional vesting schedules
- Customizable cliff periods
- Linear vesting over time
- Interval-based releases
- Initial release percentage

### 💧 Automated Market Maker

#### **Pool Management**
- Uniswap V2 compatible
- Multi-pair support
- Automatic pool creation
- Real-time price discovery
- TWAP oracle integration

#### **Trading Features**
- Token swaps with slippage protection
- Deadline-based transaction expiry
- MEV protection mechanisms
- Fee structure:
  - Trading fee: 0.30%
  - Protocol fee: Configurable

#### **Liquidity Locks**
```solidity
struct LiquidityLock {
    uint256 projectId;
    address projectOwner;
    uint256 unlockTime;
    uint256 lockedLPAmount;
    bool isActive;
}
```

### 🔒 Security Features

#### **1. User Protection**

**Emergency Refund System**
```typescript
// After 7 days of project success without liquidity finalization
// Contributors can request emergency refunds

interface EmergencyRefund {
  deadline: number; // Timestamp when refunds become available
  available: boolean; // Whether emergency refunds are active
  timeRemaining: number; // Seconds until deadline
}

// Check refund availability
const refundInfo = await exhibition.isEmergencyRefundAvailable(projectId);

if (refundInfo.available) {
  await exhibition.requestEmergencyRefund(projectId);
}
```

**Refund for Failed Projects**
```solidity
// Projects that don't meet soft cap
// Automatic refund eligibility after endTime
function requestRefund(uint256 projectId) external;
```

#### **2. Project Protection**

**Pool Creation Authorization**
```solidity
// Only Exhibition contract can create initial pools
// Prevents malicious frontrunning attacks
// Ensures correct initial price ratios

// Tracked on token deployment
isProjectToken[tokenAddress] = true;
```

**Liquidity Lock Requirements**
```solidity
// Minimum 14-day lock enforced
uint256 public constant MIN_LOCK_DURATION = 14 days;

// Validated at project creation
if (_lockDuration < MIN_LOCK_DURATION) {
    revert InvalidLockDuration();
}
```

#### **3. Platform Security**

**Access Controls**
- Ownable pattern for admin functions
- ReentrancyGuard on all state-changing functions
- SafeERC20 for all token operations

**Input Validation**
```solidity
// Time constraints
uint256 public immutable MIN_START_DELAY = 15 minutes;
uint256 public immutable MAX_PROJECT_DURATION = 21 days;

// Price bounds
uint256 public constant MIN_TOKEN_PRICE = 1e12;  // 0.000001
uint256 public constant MAX_TOKEN_PRICE = 1e24;  // 1,000,000

// Withdrawal protection
uint256 public constant WITHDRAWAL_DELAY = 1 days;
```

---

## 🔄 Project Lifecycle

### **Complete Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Project Creation                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ createLaunchpadProject() → Status: Upcoming          │   │
│ │ - Deploy token via factory                           │   │
│ │ - Set parameters (caps, timing, vesting)             │   │
│ │ - Validate tokenomics                                │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Token Deposit                                       │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ depositProjectTokens() → Status: Active              │   │
│ │ - Owner deposits tokens for sale                     │   │
│ │ - Project opens for contributions                    │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Fundraising                                         │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ contribute() → [Active]                              │   │
│ │                                                       │   │
│ │ If Hard Cap Reached:                                 │   │
│ │   → Status: Successful (Instant)                     │   │
│ │                                                       │   │
│ │ If endTime Reached:                                  │   │
│ │   → Call finalizeProject()                           │   │
│ │   → Success if softCap met                          │   │
│ │   → Failed if softCap not met                       │   │
│ └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ Success Path             │  │ Failure Path             │
│ Status: Successful       │  │ Status: Failed           │
└──────────────────────────┘  └──────────────────────────┘
                │                           │
                ▼                           ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ Phase 4a: Liquidity      │  │ Phase 4b: Refunds        │
│                          │  │                          │
│ depositLiquidityTokens() │  │ requestRefund()          │
│         ↓                │  │         ↓                │
│ finalizeLiquidity...()   │  │ withdrawUnsoldTokens()   │
│         ↓                │  │         ↓                │
│ Status: Completed        │  │ Status: Refundable       │
│                          │  │                          │
│ 7-Day Deadline ⏰       │  │ Contributors get $ back  │
│ If missed → Emergency    │  │ Owner gets tokens back   │
└──────────────────────────┘  └──────────────────────────┘
                │
                ▼
┌──────────────────────────┐
│ Phase 5: Distribution    │
│                          │
│ claimTokens()            │
│ - Vesting enforced       │
│ - Multiple claims        │
│ - Linear release         │
└──────────────────────────┘
```

### **Status Transitions**

```solidity
enum ProjectStatus {
    Upcoming,    // 0: Created, waiting for start
    Active,      // 1: Accepting contributions
    Successful,  // 2: Funding goal met
    Failed,      // 3: Soft cap not met
    Claimable,   // 4: Can claim tokens (optional)
    Refundable,  // 5: Can request refunds
    Completed    // 6: Fully processed
}
```

---

## 💰 Tokenomics

### **Platform Tokens**

| Token | Purpose | Decimals | Use Cases |
|-------|---------|----------|-----------|
| **EXH** | Platform utility | 18 | Contributions, governance, fees |
| **exUSDT** | Stable contribution | 6 | Fundraising, trading |
| **exNEX** | Wrapped native | 18 | AMM trading pairs |

### **Fee Structure**

```solidity
// Platform fee (configurable)
uint256 public platformFeePercentage; // Basis points (e.g., 300 = 3%)

// Applied to successful projects only
// Collected before liquidity addition
// Transparent fee distribution
```

### **Token Price Format**

```solidity
// ALWAYS use 18-decimal format for prices
uint256 tokenPrice = 0.001 * 10**18; // 0.001 per token

// Examples:
0.1 = 100000000000000000   (0.1 * 10^18)
0.01 = 10000000000000000   (0.01 * 10^18)
0.001 = 1000000000000000   (0.001 * 10^18)
```

### **Decimal Handling**

The platform automatically handles tokens with different decimals:

```typescript
interface TokenInfo {
  decimals: uint8;
  symbol: string;
  name: string;
}

// Example: Contributing USDT (6 decimals) for Token (18 decimals)
// Price: 0.01 USDT per Token
// Contribution: 1000 USDT (1000000000 in 6 decimals)
// Tokens received: 100,000 Tokens (calculated automatically)
```

---

## 📖 Usage Guide

### **TypeScript Integration**

#### **Setup**

```typescript
import { ethers } from 'ethers';
import { Exhibition, ExhibitionAMM, IERC20 } from '../typechain-types';

// Connect to contracts
const exhibition = await ethers.getContractAt('Exhibition', EXHIBITION_ADDRESS);
const amm = await ethers.getContractAt('ExhibitionAMM', AMM_ADDRESS);
const token = await ethers.getContractAt('IERC20', TOKEN_ADDRESS);
```

#### **For Project Owners**

**1. Create Project**

```typescript
interface ProjectParams {
  name: string;
  symbol: string;
  supply: BigNumber;
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
  lockDuration: number;
  vesting: {
    enabled: boolean;
    cliff: number;
    duration: number;
    interval: number;
    initialRelease: number;
  };
}

async function createProject(params: ProjectParams) {
  const tx = await exhibition.createLaunchpadProject(
    params.name,
    params.symbol,
    params.supply,
    params.logoURI,
    params.contributionToken,
    params.fundingGoal,
    params.softCap,
    params.minContribution,
    params.maxContribution,
    params.tokenPrice,
    params.startTime,
    params.endTime,
    params.tokensForSale,
    params.liquidityPercentage,
    params.lockDuration,
    params.vesting.enabled,
    params.vesting.cliff,
    params.vesting.duration,
    params.vesting.interval,
    params.vesting.initialRelease
  );
  
  const receipt = await tx.wait();
  const event = receipt.events?.find(e => e.event === 'ProjectCreated');
  
  return {
    projectId: event?.args?.projectId,
    tokenAddress: event?.args?.projectToken
  };
}
```

**2. Deposit Tokens**

```typescript
async function depositTokens(projectId: number, amount: BigNumber) {
  // Approve
  const projectToken = await getProjectToken(projectId);
  await projectToken.approve(exhibition.address, amount);
  
  // Deposit
  const tx = await exhibition.depositProjectTokens(projectId, amount);
  await tx.wait();
  
  console.log('✅ Tokens deposited, project now Active');
}
```

**3. Finalize Liquidity**

```typescript
async function finalizeLiquidity(projectId: number) {
  // Check required liquidity
  const required = await exhibition.getRequiredLiquidityTokens(projectId);
  
  // Deposit liquidity tokens
  await projectToken.approve(exhibition.address, required);
  await exhibition.depositLiquidityTokens(projectId, required);
  
  // Finalize (adds liquidity to AMM, releases funds)
  const tx = await exhibition.finalizeLiquidityAndReleaseFunds(projectId);
  await tx.wait();
  
  console.log('✅ Liquidity added, funds released');
}
```

#### **For Contributors**

**1. Contribute to Project**

```typescript
async function contribute(projectId: number, amount: BigNumber) {
  // Get project details
  const details = await exhibition.getProjectDetails(projectId);
  
  // Check if can contribute
  if (!details.canContribute) {
    throw new Error('Project not accepting contributions');
  }
  
  // Approve contribution token
  const contributionToken = await ethers.getContractAt(
    'IERC20',
    details.project.contributionTokenAddress
  );
  await contributionToken.approve(exhibition.address, amount);
  
  // Contribute
  const tx = await exhibition.contribute(projectId, amount);
  await tx.wait();
  
  console.log('✅ Contribution successful');
}
```

**2. Claim Tokens**

```typescript
async function claimTokens(projectId: number) {
  // Get vesting info
  const vestingInfo = await exhibition.getUserVestingInfo(projectId, userAddress);
  
  if (vestingInfo.availableAmount.eq(0)) {
    console.log('No tokens currently vested');
    return;
  }
  
  // Claim
  const tx = await exhibition.claimTokens(projectId);
  await tx.wait();
  
  console.log(`✅ Claimed ${ethers.utils.formatEther(vestingInfo.availableAmount)} tokens`);
}
```

**3. Emergency Refund**

```typescript
async function checkEmergencyRefund(projectId: number) {
  const refundInfo = await exhibition.isEmergencyRefundAvailable(projectId);
  
  if (!refundInfo.available) {
    console.log(`⏰ Wait ${refundInfo.timeRemaining} seconds for emergency refund`);
    return;
  }
  
  // Request emergency refund
  const tx = await exhibition.requestEmergencyRefund(projectId);
  await tx.wait();
  
  console.log('✅ Emergency refund processed');
}
```

#### **For Traders**

**1. Swap Tokens**

```typescript
async function swap(
  tokenIn: string,
  tokenOut: string,
  amountIn: BigNumber,
  slippagePercent: number = 1
) {
  // Get expected output
  const amountOut = await amm.getAmountOut(amountIn, tokenIn, tokenOut);
  
  // Calculate minimum with slippage
  const minAmountOut = amountOut.mul(100 - slippagePercent).div(100);
  
  // Approve
  const tokenContract = await ethers.getContractAt('IERC20', tokenIn);
  await tokenContract.approve(amm.address, amountIn);
  
  // Swap
  const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min
  const tx = await amm.swapTokenForToken(
    tokenIn,
    tokenOut,
    amountIn,
    minAmountOut,
    userAddress,
    deadline
  );
  await tx.wait();
  
  console.log(`✅ Swapped ${ethers.utils.formatEther(amountIn)} for ${ethers.utils.formatEther(amountOut)}`);
}
```

**2. Add Liquidity**

```typescript
async function addLiquidity(
  tokenA: string,
  tokenB: string,
  amountA: BigNumber,
  amountB: BigNumber,
  slippagePercent: number = 1
) {
  // Calculate minimum amounts with slippage
  const amountAMin = amountA.mul(100 - slippagePercent).div(100);
  const amountBMin = amountB.mul(100 - slippagePercent).div(100);
  
  // Approve both tokens
  const tokenAContract = await ethers.getContractAt('IERC20', tokenA);
  const tokenBContract = await ethers.getContractAt('IERC20', tokenB);
  await tokenAContract.approve(amm.address, amountA);
  await tokenBContract.approve(amm.address, amountB);
  
  // Add liquidity
  const deadline = Math.floor(Date.now() / 1000) + 1800;
  const tx = await amm.addLiquidity(
    tokenA,
    tokenB,
    amountA,
    amountB,
    amountAMin,
    amountBMin,
    userAddress,
    deadline
  );
  const receipt = await tx.wait();
  
  const event = receipt.events?.find(e => e.event === 'LiquidityAdded');
  const lpTokens = event?.args?.liquidity;
  
  console.log(`✅ Added liquidity, received ${ethers.utils.formatEther(lpTokens)} LP tokens`);
}
```

---

## 🧪 Testing

### **Test Coverage: 100%**

We've achieved complete test coverage across all scenarios:

| Scenario | Coverage | Status |
|----------|----------|--------|
| Project Creation | ✅ 100% | 5 tests |
| Hard Cap Success | ✅ 100% | Full flow tested |
| Soft Cap Success | ✅ 100% | Partial sale tested |
| Failed Project | ✅ 100% | Refunds tested |
| Vesting System | ✅ 100% | Multi-claim tested |
| Emergency Refunds | ✅ 100% | Time-based tested |
| Pool Protection | ✅ 100% | Frontrun prevention |
| Liquidity Locks | ✅ 100% | Lock/unlock tested |
| Token Calculations | ✅ 100% | All decimals tested |
| AMM Functions | ✅ 100% | Swap/LP tested |

### **Running Tests**

```bash
# Start local Hardhat node (Terminal 1)
npx hardhat node

# Deploy contracts (Terminal 2)
npm run deploy

# Setup initial state
npm run request

# Run test scenarios
npm run create       # Hard cap test
npm run fullcircle   # Vesting test
npm run softcap      # Soft cap + unsold tokens
npm run failed       # Failed project refunds
npm run lock         # Lock duration validation
npm run emergency    # emergency refund test
npm run emergency_refund  # test edge cases where project is completed
```

### **Test Scripts**

```json
{
  "scripts": {
    "deploy": "hardhat run scripts/deploy.ts --network localhost",
    "request": "hardhat run scripts/request-faucet-add-contribution-token.ts --network localhost",
    "create": "hardhat run scripts/test-create-launchpad-liquidity-lock.ts --network localhost",
    "fullcircle": "hardhat run scripts/test-project-full-circle.ts --network localhost",
    "softcap": "hardhat run scripts/test-softcap-withdrawunsoldtokens.ts --network localhost",
    "failed": "hardhat run scripts/test-failed-project-refund.ts --network localhost",
    "lock": "hardhat run scripts/test-mini-lock-duration.ts --network localhost",
    "liquid-lock": "hardhat run scripts/test-user-liquidity-claim.ts --network localhost",
    "fees": "hardhat run scripts/test-amm-fees.ts --network localhost",
    "query": "hardhat run scripts/query_contributors.ts --network localhost",
    "emergency": "hardhat run scripts/emergency_refund.ts --network localhost",
    "emergency_refund": "hardhat run scripts/emergency_refund_on_completed.ts --network localhost"
  }
}
```

**Note:**  
Repeat steps 2–4 every time you restart the Hardhat node.

---

## 🚀 Deployment

### **Network Configuration**

```env
# .env file
PRIVATE_KEY=your_deployer_private_key
NEXUS_TESTNET_III_CHAIN_ID=3945
NEXUS_TESTNET_III_RPC_URL=https://testnet.rpc.nexus.xyz
NEXUS_TESTNET_III_EXPLORER_URL=https://nexus.testnet.blockscout.com
```

### **Deployment Order**

1. **Deploy Core Infrastructure**
   ```bash
   # Deploy in this exact order:
   1. ExhibitionLPTokens
   2. ExhibitionAMM
   3. ExhibitionFactory
   4. Exhibition (main contract)
   ```

2. **Deploy Platform Tokens**
   ```bash
   # Deploy EXH, exUSDT, exNEX
   ```

3. **Configure Addresses**
   ```bash
   # Set all contract address references
   exhibition.setExhibitionFactoryAddress(factoryAddress);
   exhibition.setExhibitionAMMAddress(ammAddress);
   # ... etc
   ```

4. **Initialize Platform**
   ```bash
   # Set fees, add contribution tokens, etc.
   exhibition.setPlatformFeePercentage(300); // 3%
   exhibition.addExhibitionContributionToken(usdtAddress);
   ```

### **Verification**

```bash
# Verify contracts on block explorer
npx hardhat verify --network nexustestnet DEPLOYED_ADDRESS "Constructor Args"
```

---

## 🔐 Security Audits

### **Audit Readiness**

✅ **Modular Architecture** - Easy to audit independently  
✅ **Comprehensive Tests** - 100% coverage  
✅ **Security Features** - Multiple protection layers  
✅ **Documentation** - Complete inline comments  
✅ **Best Practices** - OpenZeppelin standards  

### **Platform Characteristics**

#### **Price Oracle**
The platform includes a TWAP oracle for enhanced security. Price data accuracy improves with trading volume, typically reaching optimal reliability within 24-48 hours of pool creation.

#### **Performance**
Gas costs are optimized for typical operations. For applications requiring batch processing or handling large datasets, we provide pagination utilities and recommended patterns in our developer documentation.

#### **Integration**
Our smart contracts provide complete on-chain functionality. We recommend building a frontend interface for enhanced user experience, and provide comprehensive TypeScript examples and React components in our documentation.

### **Recommendations**

- Complete professional audit before mainnet
- Bug bounty program recommended
- Gradual rollout with caps
- Multi-sig for admin functions

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### **Development Setup**

```bash
# Clone repositoryorg
git clone https://github.com/exhibitiondefi/exhibition.git
cd exhibition

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Run coverage
npx hardhat coverage
```

### **Code Style**

- Solidity: Follow official style guide
- TypeScript: Prettier + ESLint
- Comments: NatSpec format for contracts
- Testing: Comprehensive coverage required

### **Pull Request Process**

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Community

- **Documentation**: [coming soon]
- **Twitter**: [@ExhibitionDefi](https://twitter.com/ExhibitionDefi).

---

## 🙏 Acknowledgments

- OpenZeppelin for secure contract libraries
- Uniswap V2 for AMM architecture inspiration
- Nexus blockchain for Layer 1 infrastructure
- Community contributors and testers

---

<div align="center">

**Built with ❤️ by the Exhibition Team**

[Website](https://app.exhibition.xyz) • [Docs](coming soon) • [GitHub](https://github.com/exhibitiondefi)

</div>