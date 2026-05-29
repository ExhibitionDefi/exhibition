---
description: >-
  Onchain Tokenomist is built around three core primitives: the vault, the pass,
  and vesting. Everything the protocol does — locking, vesting, distributing,
  enforcing — flows through these three concept
---

# How It Works

#### Vaults

A vault is the root object. It is the complete on-chain record of a project's entire token economy.

Before creation, the project defines every parameter — token address, total amount, category structure, tier configurations, vesting schedules, distribution authority, and admin roles. Everything is submitted in a single atomic transaction. A registration fee in the chain's native token is required at creation.

At creation, the contract locks the full token amount and configuration atomically. From this point, everything is immutable — allocations, tiers, vesting parameters, and admin roles are permanently fixed on-chain and cannot be changed under any condition.

After creation, the only action available is pass distribution — minting passes to recipients within the defined tier supply caps. Once all passes across all categories are fully distributed, the vault status transitions to finalized and no further minting is possible.

**A vault is structured in three layers:**

**Categories** — logical groupings of tiers. A project might have categories named Team, Investors, Advisors, Community, or Treasury. Each category carries its own independent vesting schedule — cliff, duration, interval, and initial release. A change in one category's vesting never affects another.

**Tiers** — defined allocation buckets within a category. Each tier has a per-pass allocation and a maximum supply. A Team category might contain a Diamond tier at 40,000 tokens per pass and a Gold tier at 5,000 tokens per pass. Both tiers vest on the same Team schedule but carry different allocation sizes.

**Passes** — the on-chain record of each recipient's entitlement. Minted to recipients within the defined tier supply caps. Non-transferable. The pass is the proof.

***

#### Passes

Each pass is the complete on-chain record of a holder's economic entitlement within their tier. It carries its full state from the moment of minting until the final claim — allocation per pass, vesting schedule, amount claimed, and amount remaining.

The pass is soulbound — non-transferable by design. All entitlement state is tracked by token ID, never by address. The holder's address is only relevant at claim time to confirm ownership. The pass is the right. Holding it is the proof.

Once the full allocation has been claimed, the pass burns automatically. The record is complete and nothing remains to track.

**There is no address tracking. No operator intervention. No ongoing dependency on the protocol after the vault is created and passes are minted.**

***

#### Vesting

Each category carries its own independent vesting schedule — configured at vault creation and enforced entirely on-chain.

| Parameter        | Description                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| `initialRelease` | Percentage unlocked immediately at the start block — before the cliff begins. Expressed in basis points — 2000 = 20% |
| `cliff`          | Blocks after the start block before interval vesting begins                                                          |
| `duration`       | Total vesting period in blocks from the start block                                                                  |
| `interval`       | Unlock frequency — tokens vest in discrete steps every N blocks after the cliff                                      |
| `enabled`        | Toggle — if disabled, 100% is liquid at the start block                                                              |

Pass holders call `claim` to collect vested tokens. The contract calculates the vested amount at the current block, subtracts previously claimed amounts, and transfers the difference. Claiming is cumulative — missed intervals are always collectable in the next claim. Once fully claimed, the pass burns automatically.

**Example vesting schedule — 20% initial release, 3 intervals:**

| Event               | Claimable |
| ------------------- | --------- |
| Start block         | 20%       |
| Cliff + 1 interval  | +26.67%   |
| Cliff + 2 intervals | +26.67%   |
| Cliff + 3 intervals | +26.67%   |
| Total               | 100%      |

***

#### Distribution Authority

Who can mint passes is determined at vault creation. Onchain Tokenomist supports two models:

**Creator Mode** — No admins configured. The creator or executor mints passes directly via `mintDirect`. No proposal. No approval. No Merkle verification required. Suitable for projects that want full operational control without a governance layer.

**Dual-Admin Mode** — Up to two admins configured at creation. Minting requires an approved proposal. The creator or executor submits a proposal — each tier within the proposal carries its own Merkle root, with recipient verification handled on-chain at mint time. Both admins must independently approve before minting can execute. Either admin can permanently reject a proposal. Proposals expire if not fully approved within the deadline window.

```
Creator / Executor
       │
       ▼
proposeMintCategory()
       │
       ▼
  Pending Proposal ──────────────────── Auto-expires at deadline
       │
  ┌────┴────┐
  │         │
Admin1   Admin2
approve  approve
  │         │
  └────┬────┘
       │
  Fully Approved
       │
       ▼
mintPasses() → ERC-721 issued to recipients via Merkle proof
```

**AI Agent Executor** — An optional executor address can be configured at creation. The executor handles operational tasks — composing recipient sets, generating Merkle proofs, submitting proposals, triggering minting — without holding approval authority. In dual-admin mode, the executor can propose but cannot approve. Approval authority stays exclusively with the configured admins. The executor cannot alter allocations, vesting parameters, or admin roles — it operates strictly within the bounds defined at creation.

***

#### Native Token Support

Vaults accept either an ERC-20 token or the chain's native token as the deposited asset. The sentinel address identifies native token vaults:

solidity

```solidity
address constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
```

Pass this as `tokenAddress` when creating a native token vault. No ERC-20 approval is needed. The registration fee and deposit arrive in the same transaction — the protocol separates them on receipt.

All vault mechanics — tier structure, vesting schedules, pass issuance, and claim settlement — are identical for both ERC-20 and native token vaults.

***

Changes, cuts, or push further?



### You said: next

next

4:07 AM

### Claude responded: Here's the first draft of Use Cases:

Here's the first draft of **Use Cases**:

***

### Use Cases

Onchain Tokenomist is built around a single flexible primitive — the vault. Three distinct use cases emerge from how that vault is configured at creation. The protocol does not prescribe which use case a project chooses — it encodes whatever the project commits to.

***

#### Token Locker

The simplest use case. Vesting is disabled. The start block is set to the intended unlock block. The deposited amount is locked on-chain and released in full at that block — cryptographically enforced, with a verifiable on-chain record.

This is not a promise to unlock at a future date. It is an on-chain guarantee. The block number is set at creation and immutable. No team action is required to release the funds — the protocol releases them when the block arrives.

**The tier structure within the vault determines how the locked amount is distributed across recipients.**

A single tier with one pass locks the full amount for one holder. Multiple tiers with different per-pass allocations and supply caps distribute the locked amount across many holders at different sizes — all unlocking at the same start block.

**Example configurations:**

A seed investor round with three tiers — Large, Medium, and Small — each with different per-pass allocations, all unlocking at the same block. Every investor's entitlement is on-chain, verifiable, and enforced without any team involvement at unlock time.

A treasury reserve — single tier, single pass, full amount released at a specific future block. The team cannot access it early. The block is the lock.

A team allocation with multiple passes across tiers, all unlocking at the same future block. The commitment is public and immutable from the moment the vault is created.

**What this replaces:** off-chain lock agreements, trusted multisigs holding team tokens, vesting contracts that require manual execution, and any arrangement where a future token release depends on a team member taking an action or honoring a commitment.

***

#### Token Vesting Schedule

One or more categories, each with its own independent vesting schedule. This use case is for projects that need structured, time-based token distribution across one or more recipient groups — with each group vesting on its own timeline.

**Within a category**, all tiers share the same vesting schedule. Tiers differentiate by allocation size — different per-pass allocations for different recipient groups — but vest according to the same cliff, duration, and interval defined for that category.

**Across categories**, each schedule is fully independent. A vault can carry multiple categories with entirely different timelines running simultaneously. A change in one category's schedule never affects another.

**Single-category example:**

```
Team Category
Vesting: 60-day cliff | 360-day duration | 30-day interval | 0% initial release
├── Diamond tier: 40,000 tokens per pass | 1 pass
└── Gold tier:     5,000 tokens per pass | 2 passes

All passes vest on the same Team schedule. Different allocation sizes, same timeline.
```

**Multi-category example:**

```
Team Category
Vesting: 60-day cliff | 360-day duration | 30-day interval | 0% initial release
├── Diamond tier: 40,000 per pass
└── Gold tier:     5,000 per pass

Advisors Category
Vesting: 30-day cliff | 180-day duration | 30-day interval | 20% initial release
└── Silver tier: 5,000 per pass

Community Category
Vesting: disabled — 100% liquid at start block
├── Builder tier:   5,000 per pass
├── Supporter tier: 3,000 per pass
└── Bronze tier:    2,600 per pass

Three independent timelines. One vault. One source of truth.
```

**What this replaces:** vesting contracts that require manual execution, off-chain vesting trackers, spreadsheets that track who has received what, and any arrangement where a recipient must trust the team to honor a vesting commitment.

***

#### Full Tokenomics and Distribution

This is the flagship use case — the one Onchain Tokenomist is architected for.

A project's entire token economy encoded in a single on-chain vault. Not a subset. Not the team allocation only. Everything — team allocations vesting over years, advisor tranches with initial releases, community distributions unlocking at the start block, treasury reserves time-locked for future use — all configured at creation, all immutable, all queryable from day one.

**This is what on-chain tokenomics actually means.**

Not a document. Not a pie chart in a whitepaper. Not a promise from a team. A vault that carries the complete economic record of a project — every category, every tier, every allocation, every vesting schedule — encoded on-chain in one atomic creation and enforced by the protocol without any ongoing operator trust.

The vault becomes the authoritative on-chain record of everything the project has committed. Total supply. Per-category and per-tier allocations. How much has vested. How much has been claimed. How much remains locked. All of it queryable by anyone, at any time, without permission.

**What a full tokenomics vault looks like:**

```
Total Supply: 100,000,000 tokens

Team Category — 20% | 20,000,000 tokens
Vesting: 12-month cliff | 36-month duration | monthly interval | 0% TGE
├── Founder tier:    8,000,000 per pass | 1 pass
├── Core team tier:  2,000,000 per pass | 4 passes
└── Early hire tier:   500,000 per pass | 8 passes

Investors Category — 15% | 15,000,000 tokens
Vesting: 6-month cliff | 18-month duration | monthly interval | 10% TGE
├── Lead tier:   3,000,000 per pass | 1 pass
├── Seed tier:   1,000,000 per pass | 5 passes
└── Angel tier:    250,000 per pass | 20 passes

Advisors Category — 5% | 5,000,000 tokens
Vesting: 3-month cliff | 12-month duration | monthly interval | 20% TGE
└── Advisor tier: 500,000 per pass | 10 passes

Community Category — 40% | 40,000,000 tokens
Vesting: disabled — 100% liquid at start block
├── Builder tier:   10,000 per pass | 500 passes
├── Supporter tier:  5,000 per pass | 1,000 passes
└── Participant tier: 2,000 per pass | 5,000 passes

Treasury Category — 20% | 20,000,000 tokens
Vesting: disabled — locked until start block
└── Reserve tier: 20,000,000 per pass | 1 pass

One vault. Five categories. Every commitment immutable from creation.
```

**What this replaces:** the entire off-chain tokenomics execution layer. Spreadsheets. Manual distributions. Trusted multisigs. Vesting contracts that require team action. Tokenomics documents that cannot be verified. The gap between what was promised and what was delivered.

The vault closes that gap permanently. From the moment it is created, anyone in the world can query the complete token economy of a project and verify — not trust — that what was committed is what is being enforced.
