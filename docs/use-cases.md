---
description: >-
  Onchain Tokenomist is built around a single flexible primitive — the vault.
  Three distinct use cases emerge from how that vault is configured at creation.
---

# Use Cases

{% hint style="info" %}
#### The protocol does not prescribe which use case a project chooses — it encodes whatever the project commits to.
{% endhint %}

#### Token Locker

The simplest use case. Vesting is disabled. The start block is set to the intended unlock block. The deposited amount is locked on-chain and released in full at that block — cryptographically enforced, with a verifiable on-chain record.

This is not a promise to unlock at a future date. It is an on-chain guarantee. The block number is set at creation and immutable.&#x20;

> _No team action is required — the protocol releases the tokens when the block arrives._

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

The vault closes that gap permanently. From the moment it is created, anyone in the world can query the complete token economy of a project and verify — not trust — that what was committed is what is being enforced. No technical expertise required. No on-chain data extraction. No asking the team. The vault is readable, queryable, and verifiable by anyone through the app at [onchaintokenomist.vercel.app](https://onchaintokenomist.vercel.app)
