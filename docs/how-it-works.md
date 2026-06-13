---
description: >-
  Exhibition operates on a model it calls Single-State Execution — the state at
  the moment capital enters is the state that executes at the end.
---

# How It Works

{% hint style="info" %}
#### The concept is simple but the implications are significant. Nothing in between can alter it. This is not a policy. It is not a promise from the team. It is a protocol-level enforcement — the contract itself is the guarantor.
{% endhint %}

#### Single-State Execution

Traditional token launches have multiple execution states. The team can change allocations after a successful launch. Vesting terms can be amended. Liquidity can be delayed, reduced, or never added. Token supply can be expanded. Each of these is a hidden variable contributors cannot price in — a risk they cannot see, cannot measure, and cannot protect against.

Exhibition removes all of them.

From the moment a launch is created, every parameter is permanently locked. The token deposit activates the project — it does not set the parameters. Those were fixed at creation. From that point forward, the contract governs execution. The creator cannot change the funding target. The contributor limits cannot be adjusted. The vesting schedule cannot be amended. The liquidity percentage cannot be reduced. The lock duration cannot be shortened.

What was configured is what executes. Every time. Without exception.

***

#### Project Lifecycle

A launch on Exhibition moves through a defined sequence of states. Each transition is triggered by on-chain conditions — not by admin action, not by team decision.

**Upcoming** — The project has been created and parameters are set. The project owner must deposit the exact token supply before contributions open. The launch is visible and verifiable but not yet active.

**Active** — Tokens have been deposited. Contributions are open from the configured start block. Contributors can participate up to the hard cap or until the end block is reached.

**Successful** — The funding goal has been met. If the hard cap is reached before the end block, the project moves to Successful instantly. If the end block is reached with the soft cap met, finalization triggers the same outcome.

**Failed** — The end block was reached and the soft cap was not met. Full refunds are available to all contributors. The project owner can withdraw unsold tokens after the withdrawal delay.

**Claimable** — Token claiming has been initiated. The liquidity finalization deadline is still active.

**Refundable** — Refunds are active. Triggered either by a failed project or by the project owner missing the liquidity finalization deadline on a successful raise.

**Completed** — Liquidity has been added and finalized. Remaining launch capital has been released to the project owner. The launch is complete.

***

#### Block-Based Timing

All time-sensitive parameters in Exhibition are expressed in blocks, not timestamps. This is deliberate.

At ARC's sub-second block speeds, wall-clock timestamp resolution is inherently too coarse for high-precision financial logic. Relying on timestamp tracking introduces ordering risks and timing unpredictability between close blocks. A block number, however, is sequential and absolute. Every deadline, every window, every schedule in Exhibition is anchored to an explicit block height, ensuring that every time-sensitive parameter remains completely deterministic.

For reference, block-to-time conversion is straightforward:

> blocks = target duration in seconds ÷ average block time in seconds

| Parameter                       | Blocks    | Purpose                                                     |
| ------------------------------- | --------- | ----------------------------------------------------------- |
| Minimum start delay             | 2,500     | Minimum gap between project creation and start              |
| Maximum launch window           | 1,440,000 | Maximum duration of a launch                                |
| Unsold token withdrawal delay   | 180,000   | Blocks after end before owner may withdraw unsold tokens    |
| Liquidity finalization deadline | 1,260,000 | Window for owner to add liquidity after a successful launch |
