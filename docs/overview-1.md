---
description: >-
  Onchain Tokenomist is a verifiable token economy protocol — transforming token
  economy documentation into programmable, immutable, and executable on-chain
  systems.
---

# Overview

{% hint style="info" %}
The documentation exists first. The team designs the economy. Onchain Tokenomist transforms that decision into something the world can verify.
{% endhint %}

The token economy problem in Web3 is not talked about enough. A project's token exists — and then what? Tokenomics that lived in a document now need to be executed. Team allocations need to vest. Advisor tranches need to unlock. Community distributions need to go out. Treasury reserves need to be locked. And all of it, in the vast majority of cases, is still governed off-chain. By the same team. Without any cryptographic enforcement. Without any verifiable record.

Onchain Tokenomist replaces that entirely.

A project brings their existing token economy documentation — every category, every tier, every vesting schedule, every allocation — and composes it into a single on-chain vault, exactly as it was designed. Not a template. Not a predefined structure imposed by the protocol. The project's exact tokenomics transformed into on-chain reality in one atomic creation. From that moment, the vault is the source of truth. Immutable, queryable, and verifiable by anyone at any time — without asking the team, without trusting a spreadsheet, without needing technical expertise to extract the data.

Onchain Tokenomist does not dictate how a project designs its token economy. That decision belongs entirely to the team. The protocol exists to transform whatever the team has committed to in their documentation into something the world can verify — when the team chooses to use it.

Three principles govern every vault:

**Composable** — Projects configure their vault from scratch based on their existing documentation. Categories, tiers, vesting schedules, allocation sizes, distribution authority — everything is defined by the project, not prescribed by the protocol. The protocol encodes whatever the project commits to.

**Immutable** — Once a vault is created, nothing can change. Allocations, tiers, vesting parameters, and admin roles are permanently fixed on-chain. The protocol enforces what was committed. No amendments. No discretionary execution.

**Verifiable** — Every vault exposes a live, queryable summary of the complete token economy — total supply, per-category and per-tier allocations, amount claimed, amount vesting, amount locked. No off-chain source of truth. The vault is the source of truth.

***

#### What Onchain Tokenomist Is Not

Onchain Tokenomist is not a token sending tool. It is not a vesting dashboard that relies on a team to execute distributions manually. It does not tell projects how to design their token economy. The optional dual-admin governance layer it provides is not for token distribution — it is a checks-and-balances mechanism over pass minting, ensuring no single party can unilaterally issue entitlements.

It is infrastructure — the on-chain system that transforms a project's economic commitments into programmable, immutable, and executable reality. Without operator trust. Without off-chain coordination. Without any ongoing dependency on the protocol or its administrators after creation.

***

#### Three Use Cases. One Primitive.

Every vault on Onchain Tokenomist is built on the same primitive — the same vault structure, the same pass system, the same vesting enforcement. What changes is how the vault is configured. Three distinct use cases emerge from that single flexible primitive:

**Token Locker** — Lock a defined amount on-chain and release it at a specific block. Cryptographically enforced. Verifiable by anyone.

**Token Vesting Schedule** — One or more categories, each with its own independent vesting schedule. Cliff, duration, interval, and initial release configured per category. Multiple timelines running simultaneously in a single vault.

**Full Tokenomics and Distribution** — The complete protocol. The project's entire token economy encoded in one vault — team allocations, advisor tranches, community distributions, treasury reserves — all configured at creation, all immutable, all queryable from day one.

***

#### Who It Is For

Onchain Tokenomist is built for any project that has made commitments about how its token economy works and wants those commitments to be verifiable rather than trusted. The choice to use it belongs to the project. The timing belongs to the project.

It is a separate protocol from Exhibition — a different tool, the same vision. Projects launching on Exhibition are not required to use Onchain Tokenomist, and projects using Onchain Tokenomist are not required to launch on Exhibition. Both protocols are independent. Both enforce the same standard of verifiability. Both are built under the same belief — that Web3 works better when nothing has to be trusted because everything can be verified.

The protocol accepts both ERC-20 tokens and native tokens as the deposited asset. The same vault mechanics apply equally to both.
