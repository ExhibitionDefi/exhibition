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

Before creating a vault, the complete token economy must already be finalized — every category, every tier, every allocation, every vesting schedule. This is not the place to design the economy. That work happens in the documentation, with all involved parties, before the vault is ever created. The vault transforms what has already been decided into something immutable and verifiable on-chain.

The protocol encodes exactly what is submitted — nothing more, nothing less.

**Start with the total supply.** Everything flows from that number. Each category's allocation is a percentage of total supply. Each tier's per-pass allocation and maximum supply must fit within its category's total. The protocol validates that the sum of all tier allocations does not exceed the total amount deposited into the vault.

**Categories reflect the distinct groups in your finalized documentation.** Team, Investors, Advisors, Backers, Partners, Community, Treasury — whatever groups exist in your tokenomics document become categories in the vault. A category is defined by the group's identity, not its vesting schedule. Two groups with the same vesting timeline but different identities in your documentation belong in separate categories. Each category carries its own independent vesting schedule regardless.

**Tiers reflect the allocation sizes within each group.** Each tier has a per-pass allocation and a maximum supply. Tier naming should reflect your actual documentation — an Investors category might have tiers named Lead, Seed, and Angel rather than generic ranking labels. The total allocation for a tier is per-pass allocation × maximum supply. Verify that the sum of all tier totals within a category matches the intended category allocation in your documentation exactly.

***

#### Choosing Your Vault Structure

Three vault configurations are available. Choose the one that matches your project's needs:

**Token Locker** — if your goal is to lock a defined amount and release it at a specific future block with no vesting schedule. Set vesting to disabled and configure the start block as the intended unlock block.

**Token Vesting Schedule** — if your goal is structured, time-based distribution across one or more recipient groups. Configure one category per group with its own independent vesting schedule.

**Full Tokenomics and Distribution** — if your goal is to encode your entire token economy on-chain. Configure every category — team, investors, advisors, community, treasury — in a single vault. This is the complete protocol and the primary use case Onchain Tokenomist is built for.

***

#### Setting Up Categories and Tiers

**Category name** — reflects the group's identity in your tokenomics documentation. Team, Investors, Advisors, Community, Treasury, Backers, Partners — name it exactly as it appears in your documentation. The vault is the on-chain version of that document.

**Tier name** — reflects the allocation size within the category. Name tiers according to your documentation — Lead, Seed, Angel for an Investors category, or Core, Early Hire for a Team category. Generic ranking labels are not required.

**Per-pass allocation** — the exact number of tokens each pass in this tier represents. Set this to reflect the actual allocation size for each recipient group within the tier.

**Maximum supply** — the maximum number of passes that can be minted for this tier. Once this cap is reached, no further passes can be minted for the tier under any condition.

**Verify before creation:**

* Sum of all tier totals within each category equals the intended category allocation
* Sum of all category allocations equals the total vault deposit amount
* Every allocation size and supply cap reflects your actual tokenomics commitments

***

#### Configuring Vesting Schedules

Each category carries its own independent vesting schedule. Configure it to reflect your finalized documentation exactly — it is immutable after creation.

**Initial Release** — the percentage of each pass's allocation unlocked immediately at the start block, before the cliff begins. Expressed in basis points — 2000 = 20%.

**Cliff** — the number of blocks after the start block before interval vesting begins. During the cliff, no additional tokens beyond the initial release are claimable.

**Duration** — the total vesting period in blocks from the start block. All tokens in the category are fully vested by the end of this period.

**Interval** — how frequently tokens unlock after the cliff. Every N blocks after the cliff, another tranche becomes claimable. Shorter intervals distribute more continuously. Longer intervals create discrete unlock events.

**Vesting disabled** — if a category should be fully liquid at the start block, disable vesting. The full allocation is claimable from the start block with no cliff, no duration, and no interval.

***

#### Configuring Distribution Authority

At vault creation, choose how passes will be minted:

**Creator Mode** — no admins configured. You or your executor mint passes directly via `mintDirect`. No proposal required. No approval needed. Choose this if your project wants full operational control without a governance layer.

**Dual-Admin Mode** — configure up to two admin addresses. Minting requires a proposal approved by both admins before passes can be issued. Choose this if your project wants a checks-and-balances layer over distribution — where no single party can unilaterally mint passes.

**AI Agent Executor** — optionally configure an executor address to handle operational tasks. The executor can compose recipient sets, generate Merkle proofs, submit proposals, and trigger minting — but cannot approve proposals or alter any vault parameter. Approval authority stays with the configured admins.

Admin roles are immutable after creation. Choose your distribution authority model carefully before submitting the vault creation transaction.

***

#### Before You Create

Once the vault creation transaction is submitted, nothing can change. Run through this checklist before creating:

* Total deposit amount matches the sum of all tier allocations across all categories
* Every category name and tier name reflects your actual tokenomics documentation
* Every per-pass allocation and maximum supply is correct
* Every vesting schedule — initial release, cliff, duration, interval — reflects your finalized commitments
* Distribution authority model is correctly configured — creator mode or dual-admin mode
* Admin addresses are correct if dual-admin mode is configured
* Executor address is correct if an executor is being used
* Token address is correct — ERC-20 contract address or native token sentinel
* Start block is set to the correct block for your token generation event

**The vault you create is the vault that executes. There are no amendments.**
