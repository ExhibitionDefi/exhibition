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

Traditional token launches have multiple execution states. The team can change allocations after the raise. Vesting terms can be amended. Liquidity can be delayed, reduced, or never added. Token supply can be expanded. Each of these is a hidden variable contributors cannot price in — a risk they cannot see, cannot measure, and cannot protect against.

Exhibition removes all of them.

At the moment a project creator deposits tokens into the protocol, every parameter locks permanently. From that point forward, the contract governs execution. The creator cannot change the funding target. The contributor limits cannot be adjusted. The vesting schedule cannot be amended. The liquidity percentage cannot be reduced. The lock duration cannot be shortened.

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

**Completed** — Liquidity has been added and locked. Raised funds have been released to the project owner. The launch is complete.

***

#### Block-Based Timing

All time-sensitive parameters in Exhibition are expressed in blocks, not timestamps. This is deliberate.

Timestamps can be manipulated by validators within a narrow window. Blocks cannot. A block is a block — it either exists or it does not. Every deadline, every window, every schedule in Exhibition is anchored to a block number, making every time-sensitive parameter as deterministic as every other parameter in the protocol.

For reference, block-to-time conversion is straightforward:

> blocks = target duration in seconds ÷ average block time in seconds



| Parameter                       | Blocks  | Purpose                                                    |
| ------------------------------- | ------- | ---------------------------------------------------------- |
| Minimum start delay             | 3,600   | Minimum gap between project creation and start             |
| Maximum fundraise window        | 691,200 | Maximum duration of a fundraise                            |
| Unsold token withdrawal delay   | 86,400  | Blocks after end before owner may withdraw unsold tokens   |
| Liquidity finalization deadline | 604,800 | Window for owner to add liquidity after a successful raise |
