---
description: >-
  Onchain Tokenomist gives project teams something that has never existed in
  Web3: a way to make tokenomics commitments that are verifiable before they are
  trusted.
---

# For Project Teams

{% hint style="info" %}
This guide walks through every decision a project team makes when creating a vault — how to think about it, how to configure it, and what the world will be able to verify once it is on-chain.

There are no do-overs after creation. Approach every parameter as a final commitment.
{% endhint %}

#### Designing Your Full Token Economy

Before creating a vault, the complete token economy must be defined. Every category, every tier, every allocation, every vesting schedule. The protocol encodes exactly what is submitted — nothing more, nothing less.

Start with the total supply. Everything flows from that number. Each category's allocation is a percentage of total supply. Each tier's per-pass allocation and maximum supply must fit within its category's total. The protocol validates that the sum of all tier allocations does not exceed the total amount deposited into the vault.

**Think in categories first.** A category is a logical group — Team, Investors, Advisors, Community, Treasury. Each category gets its own vesting schedule. If two groups vest on different timelines, they belong in different categories. If two groups vest on the same timeline but at different allocation sizes, they belong in the same category as different tiers.

**Then think in tiers.** A tier is an allocation bucket within a category. Define the per-pass allocation and the maximum number of passes for each tier. The total allocation for a tier is per-pass allocation × maximum supply. Verify that the sum of all tier totals within a category matches your intended category allocation.

***

#### Choosing Your Vault Structure

Three vault configurations are available. Choose the one that matches your project's needs:

**Token Locker** — if your goal is to lock a defined amount and release it at a specific future block with no vesting schedule. Set vesting to disabled and configure the start block as the intended unlock block.

**Token Vesting Schedule** — if your goal is structured, time-based distribution across one or more recipient groups. Configure one category per group with its own independent vesting schedule.

**Full Tokenomics and Distribution** — if your goal is to encode your entire token economy on-chain. Configure every category — team, investors, advisors, community, treasury — in a single vault. This is the complete protocol and the primary use case Onchain Tokenomist is built for.

***

#### Setting Up Categories and Tiers

**Category name** — a human-readable label for the group. Team, Investors, Advisors, Community, Treasury. Choose names that reflect your actual tokenomics documentation — the vault is the on-chain version of that document.

**Tier name** — a label for the allocation bucket within the category. Diamond, Gold, Silver, Bronze, or whatever naming convention fits your project.

**Per-pass allocation** — the exact number of tokens each pass in this tier represents. Set this to reflect the actual allocation size for each recipient group within the tier.

**Maximum supply** — the maximum number of passes that can be minted for this tier. Once this cap is reached, no further passes can be minted for the tier under any condition.

**Verify before creation:**

* Sum of all tier totals within each category equals the intended category allocation
* Sum of all category allocations equals the total vault deposit amount
* Every allocation size and supply cap reflects your actual tokenomics commitments

***

#### Configuring Vesting Schedules

Each category carries its own independent vesting schedule. Configure it to reflect your actual distribution intent — it is immutable after creation.

**Initial Release** — the percentage of each pass's allocation unlocked immediately at the start block, before the cliff begins. Set this at whatever your project genuinely intends to release at the token generation event. Expressed in basis points — 2000 = 20%.

**Cliff** — the number of blocks after the start block before interval vesting begins. During the cliff, no additional tokens beyond the initial release are claimable. Set a cliff that reflects your actual development and lock-up commitments.

**Duration** — the total vesting period in blocks from the start block. All tokens in the category are fully vested by the end of this period. Set a duration that matches the long-term nature of your project's commitments to each group.

**Interval** — how frequently tokens unlock after the cliff. Every N blocks after the cliff, another tranche becomes claimable. Shorter intervals distribute more continuously. Longer intervals create discrete unlock events.

**Vesting disabled** — if a category should be fully liquid at the start block, disable vesting. The full allocation is claimable from the start block with no cliff, no duration, and no interval.

***

#### Configuring Distribution Authority

At vault creation, choose how passes will be minted:

**Creator Mode** — no admins configured. You or your executor mint passes directly via `mintDirect`. No proposal required. No approval needed. Choose this if your project wants full operational control without a governance layer.

**Dual-Admin Mode** — configure up to two admin addresses. Minting requires a proposal approved by both admins before passes can be issued. Choose this if your project wants a checks-and-balances layer over distribution — where no single party can unilaterally mint passes.

**AI Agent Executor** — optionally configure an executor address to handle operational tasks. The executor can compose recipient sets, generate Merkle proofs, submit proposals, and trigger minting — but cannot approve proposals or alter any vault parameter. Approval authority stays with the configured admins.

**Admin roles are immutable after creation.** Choose your distribution authority model carefully before submitting the vault creation transaction.

***

#### Before You Create

Once the vault creation transaction is submitted, nothing can change. Run through this checklist before creating:

* Total deposit amount matches the sum of all tier allocations across all categories
* Every category name and tier name reflects your actual tokenomics documentation
* Every per-pass allocation and maximum supply is correct
* Every vesting schedule — initial release, cliff, duration, interval — reflects your actual commitments
* Distribution authority model is correctly configured — creator mode or dual-admin mode
* Admin addresses are correct if dual-admin mode is configured
* Executor address is correct if an executor is being used
* Token address is correct — ERC-20 contract address or native token sentinel
* Start block is set to the correct block for your token generation event

The vault you create is the vault that executes. There are no amendments.
