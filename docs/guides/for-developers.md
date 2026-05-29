---
description: >-
  Exhibition is deployed on Nexus Layer 1. This guide covers everything needed
  to integrate Exhibition into your application — from reading project data to
  creating launches, contributing, and interacti
---

# For Developers

#### Setup

typescript

```typescript
import { ethers } from 'ethers';
import { Exhibition, ExhibitionAMM } from '../typechain-types';

const exhibition = await ethers.getContractAt('Exhibition', EXHIBITION_ADDRESS);
const amm        = await ethers.getContractAt('ExhibitionAMM', AMM_ADDRESS);
```

***

#### Network Configuration

env

```env
NEXUS_TESTNET_RPC_URL=https://testnet.rpc.nexus.xyz
NEXUS_TESTNET_CHAIN_ID=3945
NEXUS_TESTNET_EXPLORER_URL=https://testnet.explorer.nexus.xyz
```

***

#### Reading Project Data

All project data is publicly queryable. No authentication. No API key. Direct from the chain.

solidity

```solidity
// Full project details plus computed fields
function getProjectDetails(uint256 projectId) external view returns (
    Project memory project,
    uint256 progressPercentage,
    uint256 blocksRemaining,
    bool canContribute,
    uint256 requiredLiquidityTokens,
    uint256 depositedLiquidityTokens,
    uint256 totalContributors
);

// Filter projects by status
function getProjectsByStatus(ProjectStatus status) external view returns (uint256[] memory);

// Projects created by a specific address
function getProjectsByOwner(address owner) external view returns (uint256[] memory);

// Projects a user has contributed to
function getProjectsContributedByUser(address user) external view returns (uint256[] memory);

// Platform settings — fees, timelocks, constants
function getPlatformSettings() external view returns (
    uint256 feePercentage,
    address feeRecipient,
    uint256 minStartDelay,
    uint256 maxProjectDuration,
    uint256 withdrawalDelay,
    uint256 liquidityDeadline,
    uint256 minLockDuration,
    uint256 creationFee
);
```

***

#### Creating a Launch

**New Token**

typescript

```typescript
const creationFee = (await exhibition.getPlatformSettings()).creationFee;

const tx = await exhibition.createLaunchpadProject(
    name,                  // token name
    symbol,                // token symbol
    supply,                // initial total supply
    logoURI,               // logo URI
    contributionToken,     // USDX or WNEX address
    fundingGoal,           // hard cap
    softCap,               // minimum for success (≥ 51% of funding goal)
    minContribution,       // per-contributor minimum
    maxContribution,       // per-contributor maximum
    tokenPrice,            // fixed price in 18-decimal format
    startBlock,            // contributions open
    endBlock,              // contributions close
    tokensForSale,         // exact supply available to contributors
    liquidityPercentage,   // % of raised capital going to AMM pool
    lockBlocks,            // LP lock duration in blocks
    vestingEnabled,        // true or false
    vestingCliffBlocks,    // cliff period in blocks
    vestingDurationBlocks, // total vesting duration in blocks
    vestingIntervalBlocks, // unlock frequency in blocks
    vestingInitialRelease, // immediate unlock at success (basis points)
    { value: creationFee } // native NEX creation fee
);

const receipt = await tx.wait();
// ProjectCreated event contains projectId and projectToken
```

**Existing Token**

typescript

```typescript
const creationFee = (await exhibition.getPlatformSettings()).creationFee;

const tx = await exhibition.launchExistingToken(
    existingTokenAddress,  // must be token owner(), 18 decimals required
    logoURI,
    contributionToken,
    fundingGoal,
    softCap,
    minContribution,
    maxContribution,
    tokenPrice,
    startBlock,
    endBlock,
    tokensForSale,
    liquidityPercentage,
    lockBlocks,
    vestingEnabled,
    vestingCliffBlocks,
    vestingDurationBlocks,
    vestingIntervalBlocks,
    vestingInitialRelease,
    { value: creationFee }
);
```

***

#### Depositing Project Tokens

After creating a launch, the project owner must deposit the exact token supply before contributions open:

typescript

```typescript
await projectToken.approve(exhibition.address, tokensForSale);
await exhibition.depositProjectTokens(projectId, tokensForSale);
```

***

#### Contributing

typescript

```typescript
await contributionToken.approve(exhibition.address, amount);
await exhibition.contribute(projectId, amount);
```

***

#### Claiming Tokens

typescript

```typescript
const claimInfo = await exhibition.getUserClaimInfo(projectId, userAddress);

if (claimInfo.canClaim) {
    await exhibition.claimTokens(projectId);
}
```

***

#### Finalizing Liquidity

typescript

```typescript
const required = await exhibition.getRequiredLiquidityTokens(projectId);

await projectToken.approve(exhibition.address, required);
await exhibition.depositLiquidityTokens(projectId, required);
await exhibition.finalizeLiquidityAndReleaseFunds(projectId);
```

***

#### Refunds

typescript

```typescript
// Standard refund — failed project
await exhibition.requestRefund(projectId);

// Emergency refund — missed liquidity deadline
await exhibition.requestEmergencyRefund(projectId);

// Check emergency refund availability
const [available, deadline, blocksRemaining] = await exhibition.isEmergencyRefundAvailable(projectId);
```

***

#### AMM Integration

**Swap**

typescript

```typescript
const amountOut    = await amm.getAmountOut(amountIn, tokenIn, tokenOut);
const minAmountOut = amountOut * 95n / 100n; // 5% slippage tolerance
const deadlineBlock = BigInt(await ethers.provider.getBlockNumber()) + 50n;

await tokenIn.approve(amm.address, amountIn);
await amm.swapTokenForToken(tokenIn, tokenOut, amountIn, minAmountOut, recipient, deadlineBlock);
```

**Add Liquidity**

typescript

```typescript
await tokenA.approve(amm.address, amountA);
await tokenB.approve(amm.address, amountB);

await amm.addLiquidity(
    tokenA, tokenB,
    amountA, amountB,
    amountAMin, amountBMin,
    recipient,
    deadlineBlock
);
```

**Remove Liquidity**

typescript

```typescript
await lpToken.approve(amm.address, liquidity);

await amm.removeLiquidity(
    tokenA, tokenB,
    liquidity,
    amountAMin, amountBMin,
    recipient,
    deadlineBlock
);
```

***

#### Wrapping and Unwrapping NEX

typescript

```typescript
// Wrap native NEX → WNEX
await wnex.deposit({ value: ethers.parseEther('1000') });

// Unwrap WNEX → native NEX
await wnex.withdraw(ethers.parseEther('1000'));
```

***

#### Block Parameter Reference

| Constant                                 | Blocks  | Purpose                              |
| ---------------------------------------- | ------- | ------------------------------------ |
| `MIN_START_DELAY_BLOCKS`                 | 3,600   | Minimum delay before launch starts   |
| `MAX_END_DURATION_BLOCKS`                | 691,200 | Maximum fundraise window             |
| `WITHDRAWAL_UNSOLD_DELAY_BLOCKS`         | 86,400  | Delay before unsold token withdrawal |
| `LIQUIDITY_FINALIZATION_DEADLINE_BLOCKS` | 604,800 | Window for owner to add liquidity    |

***

#### Token Price Format

solidity

```solidity
// Always use 18-decimal format
uint256 tokenPrice = 0.001 * 10**18; // 0.001 per token

// Examples:
// 0.1   → 100000000000000000
// 0.01  →  10000000000000000
// 0.001 →   1000000000000000
```
