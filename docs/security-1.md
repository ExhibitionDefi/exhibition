---
description: >-
  Every guarantee Onchain Tokenomist makes — immutability, verifiability,
  trustless distribution — is backed by a specific on-chain mechanism. No
  property relies on off-chain enforcement, operator trust
---

# Security

#### Vault Immutability

Once a vault is created, nothing can change. Allocations, tiers, vesting parameters, and admin roles are permanently fixed on-chain. There is no admin function, no owner override, and no upgrade path that can alter a vault's configuration after creation. The vault encodes what was committed. The protocol enforces it. No human action is required or permitted to change it.

***

#### Pass-Keyed Entitlement

All distribution state is tracked by token ID — never by address. Allocation, vesting schedule, amount claimed, and amount remaining are all tied to the pass, not to the holder's address. The holder's address is only verified at claim time to confirm pass ownership.

This means entitlement cannot be manipulated by address changes, wallet migrations, or any form of address-level intervention. The pass is the right. The token ID is the record. The address is only the key to access what the pass already owns.

***

#### Soulbound Passes

Passes are non-transferable. `transferFrom` and `safeTransferFrom` revert unconditionally. A pass cannot be sold, transferred, or moved to another address under any condition. The entitlement belongs to the pass — not to whoever might acquire it on a secondary market.

Once the full allocation has been claimed, the pass burns automatically. No double-claim is possible.

***

#### Dual-Admin Approval

In dual-admin mode, both admins must independently approve a minting proposal before any pass can be issued. Either admin can permanently reject a proposal. A rejected proposal cannot be executed under any condition. Proposals expire automatically if not fully approved within the deadline window — no stale approvals can accumulate.

***

#### Merkle-Gated Minting

In dual-admin mode, each recipient is verified against an admin-approved Merkle root at mint time. No address can receive a pass unless it is included in the Merkle tree that was approved by both admins. The verification happens on-chain — no off-chain oracle, no trusted intermediary.

***

#### Supply Enforcement

Tier supply caps are strictly enforced. The protocol verifies at mint time that the number of passes being minted does not exceed the maximum supply configured for that tier. A batch that would exceed the cap reverts entirely — no partial minting, no overflow into another tier.

***

#### Executor Bounds

The AI agent executor can perform operational tasks — composing recipient sets, generating Merkle proofs, submitting proposals, triggering minting. It cannot alter allocations, vesting parameters, or admin roles. It cannot approve proposals. It operates strictly within the bounds defined at vault creation. Approval authority stays exclusively with the configured human admins.

***

#### Vault Finalization

Once all passes across all categories are fully distributed, the vault status transitions to finalized. No further minting is possible under any condition — not by the creator, not by an executor, not by an admin. The vault is complete and the distribution record is sealed.

***

#### Category Isolation

Vesting schedules and supply caps are enforced per category. Exhaustion or misconfiguration in one category cannot affect another. Each category is a fully self-contained unit — its vesting timeline, its supply cap, and its claim state are independent from every other category in the vault.

***

#### Fee Protections

The registration fee is paid once at vault creation. Once a vault is deployed, it has no ongoing financial dependency on the protocol or any central admin. Fee updates are subject to a 604,800 block timelock — any pending fee change is visible on-chain before it takes effect. Overpayment reverts — `msg.value` must equal the required amount exactly, preventing funds from being permanently locked in the contract.

***

#### Minimal Admin Surface

The only admin functions available on Onchain Tokenomist are fee percentage updates, fee recipient updates, and governance transfer — subject to a maximum of three transfers over the protocol's lifetime. There is no admin function that can alter a live vault, override a recipient's entitlement, modify vesting schedules, or intervene in any vault's lifecycle. The protocol's admin surface is intentionally minimal and its boundaries are enforced by the contract itself.

***

#### Standard Security Practices

All stateful functions use OpenZeppelin `ReentrancyGuard`. All ERC-20 transfers use OpenZeppelin `SafeERC20`. Native token payouts use `.call{value: amount}("")` — reverts on failure, safe for smart contract wallet recipients. `.transfer` is never used.

For native token vaults, the registration fee and token deposit arrive in the same transaction but are validated and forwarded independently. The fee is routed to the fee receiver. The deposit is retained. No cross-contamination is possible.
