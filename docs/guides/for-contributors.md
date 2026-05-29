---
description: >-
  Exhibition gives contributors something the primary market has never reliably
  offered: the ability to make a decision based on complete, verifiable
  information. Every parameter governing a launch is o
---

# For Contributors

#### How to Evaluate a Launch

Before committing capital to any Exhibition launch, every parameter is readable on-chain via `getProjectDetails`. No parameter requires trust — every condition that governs your contribution is verifiable before you commit.

**What to read before contributing:**

**Funding Goal and Soft Cap** The funding goal is the hard cap — the maximum the raise accepts. The soft cap is the minimum for success. If the raise closes below the soft cap, full refunds are available. Understand the range between these two numbers — it tells you the minimum viable outcome the project has committed to.

**Token Price** Fixed for the entire raise. Every contributor pays the same price. There is no insider pricing, no early discount, no discretionary allocation. The price you see is the price you pay.

**Tokens For Sale and Total Supply** Read both. Tokens for sale tells you your allocation at any contribution amount. Total supply tells you what percentage of the entire token economy your allocation represents. For factory-deployed tokens, total supply is the absolute maximum — no additional minting is possible. For existing tokens, verify the token contract independently.

**Liquidity Percentage and Lock Duration** The liquidity percentage tells you how much of the raised capital is going directly into the AMM pool at launch completion. The lock duration tells you how long that liquidity cannot be removed. These two numbers together tell you how protected the initial market is. Verify both before contributing.

**Vesting Schedule** If vesting is enabled, read the full schedule — initial release, cliff, duration, and interval. Calculate when you will have access to your full allocation. A vesting schedule is not a negative signal — it is a commitment the project has made on-chain. Read it as information, not as a restriction.

**Start and End Blocks** The exact blocks contributions open and close. Convert to approximate time using the average block time on Nexus. Know when the raise ends so you can make your contribution decision within the window.

***

#### Contributing to a Launch

Once you have evaluated the launch parameters and decided to participate:

1. Ensure you hold the contribution token selected by the project — either USDX or WNEX
2. If contributing with native NEX, wrap it to WNEX via the NEX Portal first
3. Approve the Exhibition contract to spend your contribution token
4. Call `contribute` with the project ID and your contribution amount

solidity

```solidity
function contribute(uint256 projectId, uint256 amount) external;
```

Your contribution is recorded on-chain immediately. You can verify your contribution amount and current status at any time via `getUserClaimInfo`.

**Contribution limits apply.** The minimum and maximum per-contributor limits are enforced by the protocol. A contribution below the minimum or above the maximum will revert.

***

#### Claiming Your Tokens

Once a project reaches Successful status, tokens become claimable according to the configured vesting schedule.

**If vesting is disabled** — your full allocation is claimable immediately at the success block.

**If vesting is enabled** — your initial release is claimable at the success block. Subsequent tranches unlock at each interval after the cliff. Missed intervals are always collectable in the next claim — you do not lose vested tokens by claiming late.

solidity

```solidity
function claimTokens(uint256 projectId) external;
```

Use `getUserClaimInfo` to check exactly how many tokens are available to claim at any block, when your next unlock occurs, and how much of your total allocation remains unclaimed.

solidity

```solidity
function getUserClaimInfo(uint256 projectId, address user) external view returns (
    uint256 contributionAmount,
    bool    userHasRefunded,
    bool    canClaim,
    uint256 tokensOwed,
    uint256 tokensClaimed,
    uint256 tokensAvailable,
    uint256 initialReleaseAmount,
    uint256 cliffEndBlock,
    uint256 vestingEndBlock,
    uint256 lastClaimBlock,
    uint256 nextClaimBlock
);
```

***

#### Understanding Your Refund Rights

Exhibition provides two refund paths. Both are permissionless — you claim your own refund directly from the contract without any admin action or team involvement.

**Standard Refund — Failed Project** If the project reaches its end block without meeting the soft cap, the project moves to Failed and full refunds are available to all contributors.

solidity

```solidity
function requestRefund(uint256 projectId) external;
```

**Emergency Refund — Missed Liquidity Deadline** If a project raises successfully but the project owner fails to finalize liquidity within 604,800 blocks, the emergency refund path opens unconditionally. You keep any tokens you have already claimed and receive a full refund of your contribution.

solidity

```solidity
function requestEmergencyRefund(uint256 projectId) external;
```

Check whether the emergency refund path is available at any time:

solidity

```solidity
function isEmergencyRefundAvailable(uint256 projectId) external view returns (bool, uint256, uint256);
```

**Your capital is never silently stranded.** Either the project completes — and liquidity is locked, funds are released, and tokens vest as configured — or a refund path is available. There is no outcome where your capital is held by the protocol indefinitely with no recourse.
