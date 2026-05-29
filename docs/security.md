---
description: >-
  Exhibition is built around a single security principle: the protocol enforces
  what the team commits to, and the team cannot override what the protocol
  enforces. Every protection described on this page
---

# Security

#### Contributor Protections

**Immutable Parameters** Every launch parameter is locked at project creation. No parameter can be amended after the project is created. The creator's commitments are verifiable by anyone at any point in the lifecycle — before contributing, during the raise, and after completion.

**Soft Cap Guarantee** If the soft cap is not met by the end block, the project moves to Failed and 100% refunds are available to all contributors. The protocol enforces this unconditionally — the project owner cannot prevent refunds or extend the raise to avoid the outcome.

**Permissionless Refunds** Refunds are pull-based — contributors claim their own refunds directly from the contract. No intermediary. No admin approval. No waiting for the team to process anything. If refunds are available, they are available to every contributor permissionlessly.

**Emergency Refund Path** If a project raises successfully but the project owner fails to finalize liquidity within 604,800 blocks of the successful raise, the emergency refund path opens unconditionally. Contributors who have already claimed tokens keep them and still receive full contribution refunds. The project owner's failure to act cannot strand contributor capital.

solidity

```solidity
function requestEmergencyRefund(uint256 projectId) external;
function isEmergencyRefundAvailable(uint256 projectId) external view returns (bool, uint256, uint256);
```

**LP Token Locks** Initial liquidity LP tokens are locked at pool creation for the duration configured at project creation. The lock cannot be shortened. Contributors can verify the exact lock duration before contributing and trust that the initial liquidity cannot be pulled during that period.

**Factory Token Verification** For launches using Exhibition's factory-deployed tokens, contributors can verify on-chain that the token supply is fixed and no additional minting is possible:

solidity

```solidity
isFactoryDeployedToken(project.projectToken)
// true  → fixed supply, no additional minting possible
// false → existing token, verify independently
```

***

#### Platform Protections

**Fee Timelocks** All platform fee changes are subject to a 691,200 block timelock. AMM fee changes are subject to a 259,200 block timelock. No fee change can take effect until the timelock expires. Both fee percentage and fee recipient are managed independently and subject to the same timelock enforcement.

**Reentrancy Guards** All state-changing functions are protected by OpenZeppelin's ReentrancyGuard. No function can be re-entered mid-execution.

**Safe Token Transfers** All ERC-20 transfers use OpenZeppelin's SafeERC20. Non-standard token behavior cannot cause silent failures or unexpected state.

**Pool Creation Restriction** For tokens launched through Exhibition, only the Exhibition contract can create the initial liquidity pool on the Exhibition AMM. This prevents price frontrunning — no external actor can create a pool for a project token before the protocol seeds it at launch completion. After the initial pool is seeded, the AMM operates permissionlessly.

**Minimal Admin Surface** The only admin functions available on Exhibition are fee percentage updates, fee recipient updates, and contribution token additions. There is no admin function that can alter a live launch, override contributor refunds, modify vesting schedules, or intervene in any project's lifecycle. Fee and recipient changes are governed by a 691,200 block timelock and are fully queryable on-chain at any time — any pending change is visible before it takes effect. The protocol's admin surface is intentionally minimal and its boundaries are enforced by the contract itself.

**Token Price Bounds**

solidity

```solidity
MIN_TOKEN_PRICE = 1e12  // 0.000001 in 18 decimals
MAX_TOKEN_PRICE = 1e24  // 1,000,000 in 18 decimals
```

**Admin Pattern** All admin functions follow the Ownable pattern and are designed for governance upgrade. Multi-sig is recommended for all admin functions prior to governance deployment.

***

#### What Exhibition Cannot Guarantee

Exhibition enforces every parameter it controls. There are two areas where contributors must perform their own verification:

**Existing token supply** — For launches using pre-deployed tokens, Exhibition enforces all launch parameters but cannot enforce properties of a token contract it did not deploy. Contributors should verify the token contract independently to confirm supply characteristics, minting authority, and any other relevant properties.

**Project quality** — Exhibition is neutral infrastructure. It enforces what a project commits to — it does not evaluate whether those commitments represent a good investment. The responsibility of evaluation stays with the contributor. What Exhibition provides is the guarantee that what they evaluate is the truth.
