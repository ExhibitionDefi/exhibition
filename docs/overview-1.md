---
description: >-
  Onchain Tokenomist is a verifiable token economy protocol — on-chain
  infrastructure for encoding, enforcing, and distributing a project's entire
  token economic system.
---

# Overview

The post-launch problem in Web3 is not talked about enough. A project raises funds, launches a token, and then — what? Tokenomics that lived in a document before the raise now need to be executed. Team allocations need to vest. Advisor tranches need to unlock. Community distributions need to go out. Treasury reserves need to be locked. And all of it, in the vast majority of cases, is still governed off-chain. By the same team that raised the capital. Without any cryptographic enforcement. Without any verifiable record.

Onchain Tokenomist replaces that entirely.

A project composes its entire token economy — every category, every tier, every vesting schedule, every allocation — into a single on-chain vault. Not a template. Not a predefined structure imposed by the protocol. The project's exact tokenomics, as they exist in their documentation, encoded on-chain in one atomic creation. From that moment, the vault is the source of truth. Immutable, queryable, and verifiable by anyone at any time — without asking the team, without trusting a spreadsheet, without needing technical expertise to extract the data.

Three principles govern every vault:

**Composable** — Projects configure their vault from scratch. Categories, tiers, vesting schedules, allocation sizes, distribution authority — everything is defined by the project, not prescribed by the protocol. The protocol encodes whatever the project commits to.

**Immutable** — Once a vault is created, nothing can change. Allocations, tiers, vesting parameters, and admin roles are permanently fixed on-chain. The protocol enforces what was committed. No amendments. No discretionary execution.

**Verifiable** — Every vault exposes a live, queryable summary of the complete token economy — total supply, per-category and per-tier allocations, amount claimed, amount vesting, amount locked. No off-chain source of truth. The vault is the source of truth.

***

#### What Onchain Tokenomist Is Not

Onchain Tokenomist is not a token sending tool. It is not a multisig. It is not a vesting dashboard that relies on a team to execute distributions manually.

It is infrastructure — the on-chain system that encodes a project's economic commitments and enforces them without operator trust, without off-chain coordination, and without any ongoing dependency on the protocol or its administrators after creation.

***

#### Three Use Cases. One Primitive.

Every vault on Onchain Tokenomist is built on the same primitive — the same vault structure, the same pass system, the same vesting enforcement. What changes is how the vault is configured. Three distinct use cases emerge from that single flexible primitive:

**Token Locker** — Lock a defined amount on-chain and release it at a specific block. Cryptographically enforced. Verifiable by anyone.

**Token Vesting Schedule** — One or more categories, each with its own independent vesting schedule. Cliff, duration, interval, and initial release configured per category. Multiple timelines running simultaneously in a single vault.

**Full Tokenomics and Distribution** — The complete protocol. The project's entire token economy encoded in one vault — team allocations, advisor tranches, community distributions, treasury reserves — all configured at creation, all immutable, all queryable from day one.

***

#### Who It Is For

Onchain Tokenomist is built for any project that has made commitments about how its token economy works and wants those commitments to be verifiable rather than trusted.

That includes projects launching on Exhibition — where the launch is already deterministic and the post-launch economy should be held to the same standard. And it includes any project in Web3 that recognizes the gap between what tokenomics documents promise and what on-chain enforcement guarantees.

The protocol accepts both ERC-20 tokens and native tokens as the deposited asset. The same vault mechanics apply equally to both.
