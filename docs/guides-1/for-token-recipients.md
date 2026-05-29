---
description: >-
  If you have been allocated tokens through a project using Onchain Tokenomist,
  your entitlement is encoded on-chain.
---

# For Token Recipients

{% hint style="info" %}
This guide explains what that means, how to find your pass, how to read your vesting schedule, and how to claim your tokens.

No technical knowledge is required. Everything is accessible through the app at [onchaintokenomist.vercel.app](https://onchaintokenomist.vercel.app).
{% endhint %}

#### Understanding Your Pass

When a project mints passes to recipients, you receive a soulbound ERC-721 token — your pass. This pass is the complete on-chain record of your economic entitlement. It carries everything:

* Your tier and category
* Your total allocation
* Your vesting schedule
* How much you have claimed
* How much remains

Your pass is non-transferable. It cannot be sold, moved to another wallet, or transferred under any condition. The entitlement belongs to the pass — and the pass belongs to the wallet it was minted to.

You do not need to trust the project team to honor your allocation. You do not need to ask anyone how much you are owed or when your next unlock is. Everything is on the pass, queryable at any time, enforced by the protocol.

***

#### Finding Your Pass

Connect your wallet to the Onchain Tokenomist app at [onchaintokenomist.vercel.app](https://onchaintokenomist.vercel.app). Every pass held by your wallet is visible from your dashboard — along with the current vesting status, claimable amount, and next unlock block for each pass.

You can also query your passes directly on-chain:

solidity

```solidity
function getOwnerTokenIds(address owner) external view returns (uint256[] memory);
function getUserPasses(uint256[] calldata tokenIds) external view returns (UserPassInfo[] memory);
```

***

#### Reading Your Vesting Schedule

Your vesting schedule is configured at vault creation and immutable. It is tied to the category your tier belongs to. Every pass in your tier vests on the same schedule.

**What to understand about your schedule:**

**Start Block** — the block at which vesting begins. This is the token generation event block configured by the project. Before this block, nothing is claimable.

**Initial Release** — the percentage of your total allocation claimable immediately at the start block, before the cliff begins. If your initial release is 20% and your total allocation is 10,000 tokens, 2,000 tokens are claimable at the start block.

**Cliff** — the number of blocks after the start block before interval vesting begins. During the cliff, no additional tokens beyond the initial release are claimable.

**Interval** — how frequently tokens unlock after the cliff. Every N blocks after the cliff, another tranche of your allocation becomes claimable.

**Duration** — the total vesting period. By the end of the duration, your full allocation is vested and claimable.

**Claiming is cumulative** — if you miss an interval, those tokens do not disappear. They accumulate and are claimable in your next claim transaction. You never lose vested tokens by claiming late.

**Example — 10,000 token allocation, 20% initial release, 3 intervals:**

| Event               | Claimable          |
| ------------------- | ------------------ |
| Start block         | 2,000 tokens (20%) |
| Cliff + 1 interval  | +2,667 tokens      |
| Cliff + 2 intervals | +2,667 tokens      |
| Cliff + 3 intervals | +2,666 tokens      |
| Total               | 10,000 tokens      |

***

#### How to Claim

**Through the app:**

Connect your wallet at [onchaintokenomist.vercel.app](https://onchaintokenomist.vercel.app). Your dashboard shows every pass you hold, the current claimable amount for each, and the next unlock block. Click claim and confirm the transaction.

**Directly on-chain:**

solidity

```solidity
function claim(uint256[] calldata tokenIds) external;
```

Pass an array of token IDs to claim from multiple passes in a single transaction. The contract calculates the vested amount at the current block, subtracts previously claimed amounts, and transfers the difference directly to your wallet.

**After your final claim**, the pass burns automatically. You will no longer see it in your wallet — this is expected. The full allocation has been claimed and the record is complete.

***

#### What If Vesting Is Disabled

If the project configured vesting as disabled for your category, your full allocation is claimable from the start block. There is no cliff, no interval, no duration. Connect your wallet, open the app, and claim.

***

#### What You Can Always Verify

At any point — before your pass is minted, after it is minted, during vesting, after your final claim — the following is queryable on-chain:

* Your total allocation
* Your vesting schedule — initial release, cliff, duration, interval
* How much you have claimed
* How much remains unclaimed
* When your next unlock occurs
* The complete vault summary — total supply, per-category allocations, total claimed across all recipients

Your entitlement is not dependent on the project team's continued involvement. The protocol enforces it. The pass carries the record. The chain is the source of truth.
