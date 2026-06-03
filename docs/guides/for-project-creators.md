---
description: Launching on Exhibition means making commitments that cannot be changed.
---

# For Project Creators

{% hint style="info" %}
#### &#x20;This guide walks through every decision a project creator makes before and during a launch — what each parameter means in practice, how to think about it, and what contributors will be evaluating when they read it.
{% endhint %}

#### Designing Your Launch Parameters

Before creating a launch on Exhibition, every parameter must be decided. There is no ability to adjust after creation. Approach this as a final commitment — not a starting point for negotiation.

**Funding Goal** Set this as the exact amount required to bootstrap your initial on-chain liquidity. not the maximum you could extract. The funding goal is your hard cap — the launch closes the moment it is reached. Contributors read this as a signal of intent. A realistic funding goal communicates that the project has a clear use of capital. An inflated one signals the opposite.

**Soft Cap** Must be at least 51% of your funding goal. Set it at the minimum that makes your launch viable. If you cannot execute on less than 80% of your funding goal, set the soft cap at 80%. The soft cap is the floor below which contributors receive full refunds — it is your public commitment to what constitutes a meaningful launch.

**Token Price** All contributors pay the same fixed price. There is no tiered pricing, no early contributor discount, no discretionary allocation. Set the price that reflects your project's valuation honestly — it will be visible and immutable for the entire duration of the launch.

**Contribution Limits** Minimum and maximum per-contributor limits shape who participates and how concentrated the launch becomes. A low maximum distributes capital more broadly. A high maximum allows larger participants to take significant positions. Neither is inherently correct — the right configuration depends on the community you are building.

**Start and End Blocks** The minimum delay between project creation and start block is 3,600 blocks — enough time for contributors to discover and evaluate the launch before it opens. The maximum launch window is 691,200 blocks. Set a window that gives your community sufficient time to participate without leaving the launch open indefinitely.

***

#### Choosing Your Contribution Token

Exhibition currently supports two contribution tokens:

**USDX** — Nexus USD. A stable contribution currency. Contributors know exactly how much they are committing in dollar terms. Appropriate for launch where price stability matters to both sides.

**WNEX** — Wrapped NEX, the native chain token. Contributors participate with native chain exposure. Appropriate for launch targeting the core Nexus ecosystem.

Choose the token that matches your target contributor base. Contributors must hold the selected token to participate — this choice shapes who can enter your launch.

***

#### Setting Up Vesting

Vesting is optional but its presence or absence sends a signal. A project that vests contributor tokens is making a public commitment that distribution is structured and deliberate. A project with no vesting is committing to immediate full liquidity at the success block.

Neither is wrong. Both are visible on-chain before any contributor commits capital.

**If you enable vesting, configure it to reflect your actual distribution intent:**

**Initial Release** — The percentage unlocked immediately at the success block. Set this at whatever your project genuinely intends to release at launch. Contributors will plan around this number.

**Cliff** — The waiting period before interval vesting begins. A cliff signals a deliberate, structured distribution timeline. Set it in blocks that reflect your actual vesting commitments.

**Duration** — The total vesting period from the success block. All tokens are fully vested by the end of this period. Set a duration that matches the long-term nature of your project.

**Interval** — How frequently tokens unlock after the cliff. Shorter intervals distribute more continuously. Longer intervals create discrete unlock events. Choose what fits your project's rhythm.

***

#### Finalizing Liquidity

After a successful launch, you have 604,800 blocks to deposit liquidity tokens and call finalization. This is the most time-sensitive action in the launch lifecycle.

**Do not delay finalization without reason.** The 604,800 block window exists as a contributor protection — if you miss it, the emergency refund path opens unconditionally and your launch unwinds regardless of its success. Plan your finalization well within the deadline.

**What finalization does:**

* Pairs the configured liquidity percentage of launch capital with your project tokens
* Seeds the Exhibition AMM pool atomically
* Locks LP tokens for the configured lock duration
* Releases remaining launch capital to you

After finalization, your token has a live, verifiable market on the Exhibition AMM. Every subsequent listing — CEX, external DEX, additional pairs — is pursued from a position of strength. The initial liquidity is already there, already locked, already verifiable by anyone.
