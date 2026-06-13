---
description: >-
  Exhibition includes a native automated market maker — the Exhibition AMM. When
  a launch completes successfully, the protocol seeds a liquidity pool directly
  from the launch capital.
---

# AMM

{% hint style="info" %}
No waiting. No external dependency for initial liquidity. The project launches with a live, verifiable market from the moment finalization executes — and every subsequent listing, partnership, or liquidity expansion is pursued from a position of strength.
{% endhint %}

#### How It Works

The Exhibition AMM is a constant product market maker operating on the standard x × y = k curve. Every pool is created from launch capital — the liquidity percentage configured at project creation determines how much of the launch capital is paired with project tokens to seed the initial pool.

Once seeded, the pool operates permissionlessly. Anyone can swap, add liquidity, or remove liquidity. The project owner has no special authority over the pool after finalization.

***

#### LP Token Locks

When a launch seeds a pool, the LP tokens representing that initial liquidity position are locked for the duration configured at project creation. During the lock period, the project owner cannot remove the initial liquidity. The lock duration is immutable — it cannot be shortened after the project is created.

After the lock expires, LP tokens are released and the owner may remove liquidity at their discretion. Contributors can verify the exact lock duration via `project.lockDurationBlocks` before committing capital.

***

#### Swapping

solidity

```solidity
function swapTokenForToken(
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    address to,
    uint256 deadlineBlock
) external;
```

All swaps are block-deadline gated — the transaction reverts if the current block exceeds the deadline block specified by the caller. Use `getAmountOut` to calculate expected output before submitting a swap.

solidity

```solidity
function getAmountOut(
    uint256 amountIn,
    address tokenIn,
    address tokenOut
) external view returns (uint256);
```

***

#### Adding and Removing Liquidity

Any address can provide liquidity to any pool on the Exhibition AMM after launch.

solidity

```solidity
function addLiquidity(
    address tokenA,
    address tokenB,
    uint256 amountA,
    uint256 amountB,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadlineBlock
) external;

function removeLiquidity(
    address tokenA,
    address tokenB,
    uint256 liquidity,
    uint256 amountAMin,
    uint256 amountBMin,
    address to,
    uint256 deadlineBlock
) external;
```

***

#### Fee Structure

The AMM operates with two configurable fee layers:

**Trading fee** — charged on every swap, configurable up to a maximum of 100 basis points (1%). Paid by the swapper.

**Protocol fee** — a percentage of the trading fee routed to the protocol fee recipient, configurable up to a maximum of 3,000 basis points (30% of the trading fee).

All fee configuration changes are subject to a 540,000 block timelock. A proposed fee change cannot take effect until the timelock expires — protecting traders and liquidity providers from sudden fee adjustments.

***

#### TWAP Oracle

The Exhibition AMM maintains a time-weighted average price oracle for every pool. TWAP accuracy improves with trading volume — pools should be allowed a warm-up period after creation before TWAP data is used for any price-sensitive application.
