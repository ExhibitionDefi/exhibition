---
description: >-
  Onchain Tokenomist is built around the vault — a single on-chain object that
  holds the complete token economy. Everything else flows from it.
---

# How It Works

{% hint style="info" %}
#### Inside every vault: categories group the allocations, tiers define the sizes, and passes carry the entitlement. One vault. Complete economy. Immutable from creation.
{% endhint %}

#### Vaults

A vault is the root object — the complete on-chain record of any token economy or structured commitment.

Before deployment, the project defines every parameter — token address, total amount, category structure, tier configurations, vesting schedules, distribution authority, and admin roles. Everything is submitted in a single atomic transaction. A registration fee in the chain's native token is required at deployment.

At deployment, the contract locks the full token amount and configuration atomically. From this point, everything is immutable — allocations, tiers, vesting parameters, and admin roles are permanently fixed on-chain and cannot be changed under any condition.

After deployment, the only action available is pass distribution — minting passes to recipients within the defined tier supply caps. Once all passes across all categories are fully distributed, the vault status transitions to finalized and no further minting is possible.

***

#### Categories

Categories are logical groupings of tiers within a vault — defined entirely by whoever creates it. A project might have categories named Team, Investors, Advisors, Community, or Treasury. A foundation might have categories named Ecosystem, Grants, and Validators. The naming and structure reflect the creator's documentation, not a protocol-prescribed format.

Each category carries its own independent vesting schedule — cliff, duration, interval, and initial release configured at vault creation. A change in one category's vesting never affects another. Each category is fully self-contained.

***

#### Tiers

Tiers are defined allocation buckets within a category. Each tier has two parameters: a per-pass allocation and a maximum supply.

A Team category might contain a Founder tier at 40,000 tokens per pass with a maximum supply of 1, and a Core Team tier at 5,000 tokens per pass with a maximum supply of 4 — but the naming is entirely the creator's choice. Tier names reflect whatever the project's documentation defines. Both tiers vest on the same Team schedule but carry different allocation sizes. The total allocation for any tier is per-pass allocation × maximum supply.

Once a tier's maximum supply is reached, no further passes can be minted for that tier under any condition.

***

#### Passes

Each pass is the complete on-chain record of a holder's economic entitlement within their tier. It carries its full state from the moment of minting until the final claim — allocation per pass, vesting schedule, amount claimed, and amount remaining.

The pass is soulbound — non-transferable by design. All entitlement state is tracked by token ID, never by address. The holder's address is only relevant at claim time to confirm ownership. The pass is the right. Holding it is the proof.

Once the full allocation has been claimed, the pass burns automatically. The record is complete and nothing remains to track.

There is no address tracking. No operator intervention. No ongoing dependency on the protocol after the vault is deployed and passes are minted.

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

Pass holders call `claim` to collect vested tokens. The contract calculates the vested amount at the current block, subtracts previously claimed amounts, and transfers the difference. Claiming is cumulative — any elapsed intervals are available the moment you claim, whether you claim during that interval or long after. Once fully claimed, the pass burns automatically.

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
