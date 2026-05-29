---
description: >-
  Every parameter governing an Exhibition launch is configured at creation and
  immutable once the project created.
---

# Parameters

{% hint style="info" %}
#### This page documents every parameter a creator configures, what it controls, and what contributors should verify before committing capital.
{% endhint %}

#### Funding & Pricing

**Funding Goal** The hard cap — the maximum capital the raise will accept. Once the funding goal is reached, contributions close instantly and the project moves to Successful. No oversubscription is possible.

**Soft Cap** The minimum threshold for a successful raise. Must be at least 51% of the funding goal. If the end block is reached and the soft cap has not been met, the project moves to Failed and full refunds are available to all contributors.

**Token Price** The fixed price per token for the duration of the raise. Cannot be changed after creation. All contributors pay the same price — no tiered pricing, no discretionary allocation.

solidity

```solidity
// Always expressed in 18-decimal format
uint256 tokenPrice = 0.001 * 10**18; // 0.001 per token

// Examples:
// 0.1   → 100000000000000000
// 0.01  →  10000000000000000
// 0.001 →   1000000000000000
```

**Minimum and Maximum Contribution** Per-contributor limits. The minimum sets the floor for a single contribution. The maximum sets the ceiling any one contributor can commit across the entire raise. Both are enforced by the protocol — no contributor can circumvent either limit.

**Tokens For Sale** The exact token supply available to contributors. Derived from the funding goal and token price:

solidity

```solidity
tokensForSale = fundingGoal / tokenPrice
```

***

#### Timing

**Start Block** The exact block at which contributions open. Must be at least 3,600 blocks after project creation. Before this block, the project is visible and verifiable but contributions are not accepted.

**End Block** The exact block at which contributions close if the funding goal has not been reached. Maximum duration from start block is 691,200 blocks.

***

#### Liquidity

**Liquidity Percentage** The percentage of raised capital allocated to seed the AMM pool at launch completion. Configured at creation and immutable. When a launch succeeds, the project owner deposits the required liquidity tokens and triggers finalization — at which point the protocol pairs the configured percentage of raised capital with project tokens and seeds the AMM pool atomically. The percentage, the pairing, and the lock duration are all enforced by the protocol. No discretion over how it executes.

**Lock Duration** The number of blocks LP tokens remain locked after the pool is seeded. During this period, the project owner cannot remove liquidity. Contributors can verify this parameter before contributing to confirm how long the initial liquidity is protected.

**Liquidity Finalization Deadline** After a successful raise, the project owner has 604,800 blocks to deposit liquidity tokens and finalize. If this deadline is missed, the emergency refund path opens unconditionally — contributors can claim full refunds regardless of whether they have already claimed tokens.

***

#### Vesting

**Vesting Enabled** A toggle that determines whether tokens are subject to a vesting schedule. If disabled, the full allocation is claimable immediately at the success block.

**Initial Release** The percentage of a contributor's allocation unlocked immediately at the success block, before the cliff period begins. Expressed in basis points — 2000 = 20%.

**Cliff** The number of blocks after the success block before linear vesting begins. During the cliff period, no additional tokens beyond the initial release are claimable.

**Duration** The total vesting period in blocks, measured from the success block. All tokens are fully vested by the end of this period.

**Interval** The frequency at which vested tokens unlock after the cliff. Tokens vest in discrete steps — every N blocks after the cliff, another tranche becomes claimable. Missed intervals are always collectable in the next claim.

**Example vesting schedule — 20% initial release, 3 intervals:**

| Event               | Claimable |
| ------------------- | --------- |
| Success block       | 20%       |
| Cliff + 1 interval  | +26.67%   |
| Cliff + 2 intervals | +26.67%   |
| Cliff + 3 intervals | +26.67%   |
| Total               | 100%      |

***

#### Tokenomics Validation

The protocol enforces the following invariants at project creation. A launch that does not satisfy these conditions cannot be created:

solidity

```solidity
tokensForSale  = fundingGoal / tokenPrice
softCap        ≥ 51% of fundingGoal
totalSupply    sufficient for sale + liquidity allocation
liquidityPercentage > 0 and ≤ 100%
```

***

#### What Contributors Should Verify

Before committing capital to any Exhibition launch, contributors can inspect every parameter on-chain via `getProjectDetails`. The complete parameter set is publicly readable at any point in the lifecycle:

solidity

```solidity
project.fundingGoal              // Hard cap
project.softCap                  // Minimum for success
project.tokenPrice               // Fixed price per token
project.totalProjectTokenSupply  // Total token supply
project.amountTokensForSale      // Tokens available to contributors
project.liquidityPercentage      // Capital going to AMM pool
project.lockDurationBlocks       // LP lock duration
project.vestingEnabled           // Whether vesting applies
project.vestingCliffBlocks       // Cliff period
project.vestingDurationBlocks    // Total vesting duration
project.vestingInitialRelease    // Immediate unlock at success
project.startBlock               // Contributions open
project.endBlock                 // Contributions close
```

No parameter can be amended after the project created. What is readable here is what executes.
