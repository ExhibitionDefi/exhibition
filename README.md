# Exhibition Token Launch Infrastructure

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Solidity](https://img.shields.io/badge/solidity-0.8.20-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Coverage](https://img.shields.io/badge/coverage-100%25-success.svg)

***Deterministic primary market infrastructure for verifiable enshrined financial system.***

</div>

---

## Overview

Exhibition is a primary market infrastructure protocol built on Nexus Layer 1 — a blockchain purpose-built for intelligent markets and high-performance financial applications.

It enables projects to launch tokens, raise funds, and bootstrap on-chain liquidity through an integrated AMM — with every parameter declared upfront, enforced by the protocol, and immutable once capital enters.

The core thesis is simple: **if it matters, it must be configured before capital enters.** Token supply, pricing, funding targets, vesting schedules, liquidity allocation, and lock durations are all declared at creation and cannot be altered afterward. No oversubscription. No post-hoc changes to distribution. Contributors can inspect and verify every condition before committing a single unit of capital.

Three core principles guide the system:

- **Deterministic** — Launch parameters — token supply, fund goal, soft cap, token price, liquidity allocation, lock duration, and vesting schedule — are configured before capital enters and enforced on-chain. No discretionary execution. No post-launch amendments.
- **Verifiable** — All launch parameters, contributions, allocations, and liquidity events are transparent and auditable on Nexus Layer 1. Any participant can independently verify the state of a project at any point in its lifecycle.
- **Protected** — Contributors are safeguarded by enforced soft caps, a permissionless pull-refund mechanism, vesting schedules for distributed tokens, locked liquidity, and an emergency refund path if the project owner fails to finalize within the protocol deadline.

---

## Architecture

### Contract Structure

```
Exhibition Platform
│
├── Core Contracts (Orchestrators)
│   ├── Exhibition.sol ........... Main Protocol Orchestrator
│   ├── ExhibitionFactory.sol .... Registry & Token Deployment
│   ├── ExhibitionAMM.sol ........ AMM Orchestrator
│   └── ExhibitionLPTokens.sol ... Pool State Manager
│
├── Exhibition Modules
│   ├── ExhibitionBase.sol ....... Inheritance Foundation
│   ├── ExhibitionVesting.sol ..... Vesting Logic
│   ├── ExhibitionConfig.sol ..... Protocol Configuration
│   ├── ExhibitionTokenCalc.sol .. Price Discovery & Tokenomics
│   ├── ExhibitionFaucet.sol ..... Testnet Asset Distribution
│   ├── ExhibitionTokenDeploy .... Token Deployment Logic
│   ├── ExhibitionProjectCore .... Project Lifecycle & Metadata
│   ├── ExhibitionContributions .. Fundraising & Capital Allocation
│   ├── ExhibitionClaims ......... Distribution, Vesting & Locks
│   ├── ExhibitionRefunds ........ Investor Protection & Withdrawals
│   ├── ExhibitionLiquidity ...... AMM Bridge & Liquidity Seeding
│   └── ExhibitionViews .......... External Query & Data Aggregation
│
├── AMM Modules
│   ├── ExhibitionAMMCore ........ Swap Logic & Curve Mathematics
│   ├── ExhibitionAMMEarnings .... Revenue Tracking & Fee Distribution
│   ├── ExhibitionAMMErrors ...... Unified Error Definitions
│   ├── ExhibitionAMMStorage ..... AMM State & Pool Management
│   ├── ExhibitionAMMFees ........ Dynamic Fee Calculation
│   ├── ExhibitionAMMLibrary ..... Pure Mathematical Utilities
│   ├── ExhibitionAMMLocks ....... LP Security & Block-Based Locks
│   ├── ExhibitionAMMTypes ....... Protocol Structs & Enums
│   └── ExhibitionAMMViews ....... Real-time Pool Metrics & Pricing
│
└── Libraries & Interfaces
    ├── ExLibrary.sol ............ Shared Utility Helpers
    ├── IExhibitionAMM.sol ....... Full AMM Interface
    ├── IExhibitionLPTokens.sol .. LP Token Interface
    ├── IExhibitionPlatform.sol .. Main Protocol Interface
    └── IExhibitionMinimal.sol ... AMM-to-Platform Bridge
```

### Contract Interactions

```
┌─────────────────────────────────────────────────────┐
│                  Exhibition (Main)                  │
│  ┌──────────────────────────────────────────────┐   │
│  │ Config │ Faucet │ Projects │ Claims │ Views  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────┬──────────────────┬────────────────────┘
              │                  │
              ▼                  ▼
    ┌─────────────────┐   ┌──────────────┐
    │ExhibitionFactory│   │ExhibitionAMM │
    │ (Token Creator) │   │    (AMM)     │
    └─────────────────┘   └──────────────┘
              │                  │
              ▼                  ▼
    ┌─────────────────┐   ┌──────────────┐
    │  Project Tokens │   │  LP Tokens   │
    │   (ERC20)       │   │ (Multi-Pair) │
    └─────────────────┘   └──────────────┘
```

---

## Features

### Token Launch

- Parameter Configuration: Each launch supports immutable parameters, including fixed funding targets, soft caps, individual contribution caps, and durations defined by block height for precision.Automated Liquidity Provision: Upon successful completion, the protocol executes an atomic transaction that pairs a predefined percentage of raised capital with the launch token to bootstrap an AMM liquidity pool.
- Immutable Liquidity Locks: LP (Liquidity Provider) tokens are cryptographically locked at inception and remain inaccessible until the expiration of the configured block-duration.
- Flexible Vesting Architecture: Supports custom vesting logic including a Cliff (wait period), Duration (total release time), Interval (frequency of release), and Initial Unlock (TGE percentage).
- Soft Cap Guarantee: If the Soft Cap is not met by the expiration block, the project status transitions to Failed. The protocol enables a Permissionless Pull-Refund mechanism, allowing contributors to reclaim 100% of their capital immediately.
- Finalization & Fallback Protection: To prevent funds from being trapped, the protocol enforces a Finalization Deadline. If the creator fails to trigger the liquidity launch within the grace period, a Fallback Refund Path is automatically activated for all participants.

#### Tokenomics Validation

```solidity
// Automatic validation enforced at project creation:
// - tokensForSale  = fundingGoal / tokenPrice
// - softCap        ≥ 51% of fundingGoal
// - totalSupply      sufficient for sale + liquidity allocation
// - liquidityPercentage between 70–100%
```

#### Token Price Format

```solidity
// Always use 18-decimal format for prices
uint256 tokenPrice = 0.001 * 10**18; // 0.001 per token

// Examples:
// 0.1   → 100000000000000000  (0.1  × 10^18)
// 0.01  →  10000000000000000  (0.01 × 10^18)
// 0.001 →   1000000000000000  (0.001× 10^18)
```

---

### AMM

- Constant product automated market maker
- Native liquidity creation from launch capital
- Time-weighted average price (TWAP) oracle
- Liquidity position tracking — unrealized and realized earnings per position
- Liquidity lock enforcement for launch-created pools

#### Fee Structure

```solidity
// Trading fee: 0.30%
// Protocol fee: Configurable (basis points, e.g. 300 = 3%)
// Applied to successful projects only, collected before liquidity addition
```

#### Liquidity Lock

```solidity
struct LiquidityLock {
    uint256 projectId;
    address projectOwner;
    uint256 unlockBlock;   // Block number when lock expires
    uint256 lockedLPAmount;
    bool    isActive;
}
```

---

### Platform

- exNEX portal — wrap/unwrap native NEX to exNEX
- Testnet faucet — request EXH and USDX
- Real-time pricing derived directly from on-chain pool reserves
- Unified portfolio view — LP positions, earnings, and lock status

---

## Block-Based Timing

All time-sensitive parameters in Exhibition are expressed in **blocks**. Conversion is left for the consumer to decide based on their chain's block time.

```

```solidity
uint256 public immutable MIN_START_DELAY_BLOCKS                 = 3_600;
// Minimum delay between project creation and its start block

uint256 public immutable MAX_END_DURATION_BLOCKS                = = 691_200;
// Maximum fundraise window from start block to end block

uint256 public constant  MIN_LOCK_DURATION_BLOCKS               = 1_209_600;
// Minimum block duration a project's liquidity must remain locked

uint256 public constant  WITHDRAWAL_UNSOLD_DELAY_BLOCKS         = 86_400;
// Blocks after project end before owner may withdraw unsold tokens

uint256 public constant  LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS = 604_800;
// Blocks after a successful raise before emergency refunds unlock
```

---

## Project Lifecycle

### Status Transitions

```solidity
enum ProjectStatus {
    Upcoming,    // Created, waiting for start block
    Active,      // Accepting contributions
    Successful,  // Funding goal met
    Failed,      // Soft cap not met
    Claimable,   // Tokens available to claim
    Refundable,  // Refunds available
    Completed    // Fully processed
}
```

### **Complete Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│ Phase 1: Project Creation                                   │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ createLaunchpadProject() → Status: Upcoming          │    │
│ │ - Deploy token via factory                           │    │
│ │ - Set parameters (caps, timing, vesting)             │    │
│ │ - Validate tokenomics                                │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 2: Token Deposit                                      │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ depositProjectTokens() → Status: Active              │    │
│ │ - Owner deposits tokens for sale                     │    │
│ │ - Project opens for contributions                    │    │
│ └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Phase 3: Fundraising                                        │
│ ┌──────────────────────────────────────────────────────┐    │
│ │ contribute() → [Active]                              │    │
│ │                                                      │    │
│ │ If Hard Cap Reached:                                 │    │
│ │   → Status: Successful (Instant)                     │    │
│ │                                                      │    │
│ │ If endTime Reached:                                  │    │
│ │   → Call finalizeProject()                           │    │
│ │   → Success if softCap met                           │    │
│ │   → Failed if softCap not met                        │    │
│ └──────────────────────────────────────────────────────┘    │
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
│      Deadline ⏰        │  |  Contributors get $ back  |
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

---

## Security

### User Protection

**Emergency Refund System**

If the project owner does not finalize liquidity before `LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS` elapses after a successful raise, the refund path opens unconditionally.

The first contributor to call `requestEmergencyRefund` transitions the project status from `Successful` (or `Claimable`) to `Refundable`. All subsequent contributors claim via the standard `requestRefund`. Once the deadline passes, liquidity finalization is permanently closed — the owner cannot re-enter.

```solidity
function requestEmergencyRefund(uint256 projectId) external; // First call — transitions status to Refundable
function requestRefund(uint256 projectId) external;          // Subsequent contributors
function isEmergencyRefundAvailable(uint256 projectId) external view returns (bool available, uint256 blocksRemaining);
```

**Refund for Failed Projects**

```solidity
// Projects that do not meet the soft cap
// Refund eligibility opens after the project end block
function requestRefund(uint256 projectId) external;
```

### Project Protection

**Pool Creation Authorization**

```solidity
// Only the Exhibition contract may create initial pools for project tokens
// Prevents frontrunning attacks on initial price ratios
mapping(address => bool) public isProjectToken;
```

**Minimum Lock Enforcement**

```solidity
// Validated at project creation against MIN_LOCK_DURATION_BLOCKS
if (_lockBlocks < MIN_LOCK_DURATION_BLOCKS) {
    revert InvalidLockDuration();
}
```

### Platform Security

- Ownable pattern for admin functions
- ReentrancyGuard on all state-changing functions
- SafeERC20 for all token transfers

**Price Bounds**

```solidity
uint256 public constant MIN_TOKEN_PRICE  = 1e12; // 0.000001
uint256 public constant MAX_TOKEN_PRICE  = 1e24; // 1,000,000
uint256 public constant PRICE_DECIMALS   = 18;
```

---

## Tokens

| Token | Purpose | Decimals |
|-------|---------|----------|
| **EXH** | Test | 18 |
| **USDX** | Stable contribution | 6 |
| **exNEX** | Wrapped native | 18 |

---

## API Reference

### View Functions

```solidity
function getProjectDetails(uint256 projectId) external view returns (...);
function getUserProjectSummary(uint256 projectId, address user) external view returns (...);
function isEmergencyRefundAvailable(uint256 projectId) external view returns (bool, uint256);
function getLiquidityDeadlineBlock(uint256 projectId) external view returns (uint256);
function getUserVestingInfo(uint256 projectId, address user) external view returns (...);
function getRequiredLiquidityTokens(uint256 projectId) external view returns (uint256);
```

### Project Owner

```solidity
function createLaunchpadProject(...) external returns (uint256 projectId, address token);
function depositProjectTokens(uint256 projectId, uint256 amount) external;
function depositLiquidityTokens(uint256 projectId, uint256 amount) external;
function finalizeLiquidityAndReleaseFunds(uint256 projectId) external;
function withdrawUnsoldTokens(uint256 projectId) external;
```

### Contributor

```solidity
function contribute(uint256 projectId, uint256 amount) external;
function claimTokens(uint256 projectId) external;
function requestRefund(uint256 projectId) external;
function requestEmergencyRefund(uint256 projectId) external;
```

### AMM

```solidity
function swapTokenForToken(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to, uint256 deadlineBlock) external;
function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadlineBlock) external;
function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadlineBlock) external;
function lockLiquidity( address _tokenA, address _tokenB, uint256 _lpAmount, uint256 _lockDurationBlocks) external;
function getAmountOut(uint256 amountIn, address tokenIn, address tokenOut) external view returns (uint256);
```
---

## TypeScript Integration

### Setup

```typescript
import { ethers } from 'ethers';
import { Exhibition, ExhibitionAMM, IERC20 } from '../typechain-types';

const exhibition = await ethers.getContractAt('Exhibition', EXHIBITION_ADDRESS);
const amm        = await ethers.getContractAt('ExhibitionAMM', AMM_ADDRESS);
```

### Create Project

```typescript
const tx = await exhibition.createLaunchpadProject(
  name, symbol, supply, logoURI,
  contributionToken,
  fundingGoal, softCap,
  minContribution, maxContribution,
  tokenPrice,
  startBlock, endBlock,       // Block numbers, not timestamps
  tokensForSale,
  liquidityPercentage,
  lockBlocks,                 // Duration in blocks
  vesting.enabled,
  vesting.cliffBlocks,        // Cliff in blocks
  vesting.durationBlocks,     // Total vesting duration in blocks
  vesting.intervalBlocks,     // Release interval in blocks
  vesting.initialRelease      // Initial release at success block
);

const receipt = await tx.wait();
const event   = receipt.events?.find(e => e.event === 'ProjectCreated');
const { projectId, projectToken } = event?.args;
```

### Contribute

```typescript
const details = await exhibition.getProjectDetails(projectId);
await contributionToken.approve(exhibition.address, amount);
await exhibition.contribute(projectId, amount);
```

### Finalize Liquidity

```typescript
const required = await exhibition.getRequiredLiquidityTokens(projectId);
await projectToken.approve(exhibition.address, required);
await exhibition.depositLiquidityTokens(projectId, required);
await exhibition.finalizeLiquidityAndReleaseFunds(projectId);
```

### Swap

```typescript
const amountOut    = await amm.getAmountOut(amountIn, tokenIn, tokenOut);
const minAmountOut = amountOut.mul(100 - slippagePct).div(100);
const deadlineBlock = (await ethers.provider.getBlockNumber()) + 50; // ~50 blocks

await tokenIn.approve(amm.address, amountIn);
await amm.swapTokenForToken(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadlineBlock);
```

---

## Testing

### Coverage: 100%

| Scenario | Status |
|----------|--------|
| Project Creation | ✅ |
| Hard Cap Success | ✅ |
| Soft Cap Success | ✅ |
| Failed Project & Refunds | ✅ |
| Vesting & Multi-Claim | ✅ |
| Emergency Refunds | ✅ |
| Pool Frontrun Prevention | ✅ |
| Liquidity Lock / Unlock | ✅ |
| Token Decimal Handling | ✅ |
| AMM Swap & LP | ✅ |

### Running Tests

```bash
# Terminal 1 — start local node
npx hardhat node

# Terminal 2 — deploy and seed
npm run deploy
npm run request

# Run scenarios
npm run create           # Hard cap flow
npm run fullcircle       # Full vesting cycle
npm run softcap          # Soft cap + unsold token withdrawal
npm run failed           # Failed project refunds
npm run emergency        # Emergency refund trigger
npm run emergency_refund # Edge cases on completed projects
```

> Repeat the deploy and request steps every time you restart the Hardhat node.

---

## Deployment

### Environment

```env
PRIVATE_KEY=your_deployer_private_key
NEXUS_TESTNET_III_CHAIN_ID=3945
NEXUS_TESTNET_III_RPC_URL=https://testnet.rpc.nexus.xyz
NEXUS_TESTNET_III_EXPLORER_URL=https://nexus.testnet.blockscout.com
```

### Order

```
1. ExhibitionLPTokens
2. ExhibitionAMM
3. ExhibitionFactory
4. Exhibition (main)
5. tokens — EXH, USDX, exNEX
```

### Configuration

```bash
exhibition.setExhibitionFactoryAddress(factoryAddress);
exhibition.setExhibitionAMMAddress(ammAddress);
exhibition.setPlatformFeePercentage(300);   // 3%
exhibition.addExhibitionContributionToken(usdxAddress);
```

### Block Parameter Reference

The block constants are baked into the contract. Block conversion are left for the consumer to handle base on block time on targeted blockhain:

| Constant | Value |
|---|---|---|
| `MIN_START_DELAY_BLOCKS` | 7,200 |
| `MAX_END_DURATION_BLOCKS` | 1,296,000 |
| `MIN_LOCK_DURATION_BLOCKS` | 1,209,600 |
| `WITHDRAWAL_UNSOLD_DELAY_BLOCKS` | 172,800 |
| `LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS` | 604,800 |

```
blocks = target_duration_in_seconds ÷ avg_block_time_in_seconds
```

### Verification

```bash
npx hardhat verify --network nexustestnet DEPLOYED_ADDRESS "Constructor Args"
```

---

## Security Considerations

- Professional audit recommended before mainnet deployment
- Bug bounty program advised
- Gradual rollout with contribution caps
- Multi-sig for all admin functions
- TWAP oracle accuracy improves with trading volume — allow warm-up period after pool creation

---

## License

MIT — see [LICENSE](LICENSE).

---

## Acknowledgments

OpenZeppelin for secure contract libraries. Uniswap V2 for AMM architecture. Nexus blockchain for Layer 1 infrastructure.

---

<div align="center">

**Built by the Exhibition Developer**

[App](https://app.exhibition.xyz) • [GitHub](https://github.com/exhibitiondefi) • [Twitter](https://twitter.com/ExhibitionDefi)

</div>