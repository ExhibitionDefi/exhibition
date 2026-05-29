---
description: >-
  Exhibition supports two paths for bringing a token to market. Both paths share
  the same parameter set, the same lifecycle, and the same Single-State
  Execution guarantee. The difference is whether the
---

# Launch Paths

#### New Token

The new token path deploys a fresh ERC-20 token and registers the launch in a single transaction. The factory deploys the token, transfers ownership to the creator, and the launch is configured atomically.

This path is the simpler of the two. Because the token is deployed by Exhibition's own factory, contributors can verify its origin on-chain with a single call:

solidity

```solidity
isFactoryDeployedToken(project.projectToken)
// true → deployed by Exhibition Factory, fixed supply, no additional minting possible
```

A factory-deployed token carries an absolute supply guarantee. The total supply configured at creation is the maximum that will ever exist. No additional minting is possible under any condition.

**What the creator configures:**

* Token name and symbol
* Initial total supply
* Logo URI
* All launch parameters — funding target, soft cap, contribution limits, token price, start block, end block, tokens for sale, liquidity percentage, lock duration, and vesting schedule

Everything is submitted in a single transaction. The protocol validates and processes atomically.

***

#### Existing Token

The existing token path allows a project with a pre-deployed token to launch on Exhibition. The caller must be the token owner and the token must have 18 decimals.

This path requires an additional verification step from contributors. Because the token was not deployed by Exhibition's factory, its supply characteristics must be verified independently:

solidity

```solidity
isFactoryDeployedToken(project.projectToken)
// false → existing token, verify contract independently before contributing
```

An existing token may have a mintable supply. Contributors should inspect the token contract directly to confirm whether additional minting is possible, who controls it, and under what conditions it can occur. Exhibition enforces every launch parameter — but it cannot enforce properties of a token contract it did not deploy.

**What the creator configures:**

* Existing token contract address
* Logo URI
* All launch parameters — identical to the new token path

The creator must be the token owner at the time of launch registration.

***

#### Contribution Tokens

Both launch paths accept whitelisted ERC-20 tokens as the contribution currency. Each project selects one contribution token at creation — contributors must hold that token to participate.

| Token    | Purpose                                  | Decimals |
| -------- | ---------------------------------------- | -------- |
| **USDX** | Nexus USD — stable contribution currency | 6        |
| **WNEX** | Wrapped NEX — native chain token         | 18       |

Native NEX can be wrapped to WNEX directly through the NEX Portal before contributing.
