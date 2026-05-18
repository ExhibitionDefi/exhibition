// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";
import "./ExhibitionAMMErrors.sol";

/**
 * @title ExhibitionAMMLocks
 * @dev Liquidity lock management with HYBRID approach
 *
 * KEY FEATURES:
 * ✅ Automatic unlock after expiry (no manual unlock call required)
 * ✅ Automatic state cleanup on first withdrawal after expiry
 * ✅ Only Exhibition contract can create locks
 * ✅ Active/Inactive state for gas optimization
 *
 * HOW IT WORKS:
 * 1. Exhibition contract creates lock when adding initial liquidity
 * 2. During lock period: users can only withdraw non-locked LP tokens
 * 3. After expiry: first withdrawal automatically cleans up lock state
 * 4. Optional: users can manually unlock for gas optimization
 */
abstract contract ExhibitionAMMLocks is ExhibitionAMMStorage, ExhibitionAMMErrors {

    // ================================
    //       Lock Creation
    // ================================

    /**
     * @dev Creates a liquidity lock
     * NOTE: Only called internally from addLiquidityWithLock
     *       which validates msg.sender == exhibitionContract
     *
     * @param _projectId        Project ID from Exhibition
     * @param _tokenA           First token in pair
     * @param _tokenB           Second token in pair
     * @param _projectOwner     Project owner address (receives locked LP tokens)
     * @param _lpAmount         Amount of LP tokens to lock
     * @param _lockDurationBlocks Lock duration in blocks
     */
    function _createLiquidityLock(
        uint256 _projectId,
        address _tokenA,
        address _tokenB,
        address _projectOwner,
        uint256 _lpAmount,
        uint256 _lockDurationBlocks
    ) internal {
        if (_lpAmount == 0) revert ZeroAmount();
        if (_projectOwner == address(0)) revert ZeroAddress();
        if (_lockDurationBlocks == 0) revert InvalidLockData();

        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        projectTokenPairs[_projectId] = [token0, token1];

        liquidityLocks[token0][token1][_projectOwner] = LiquidityLock({
            projectId:       _projectId,
            projectOwner:    _projectOwner,
            unlockBlock:     block.number + _lockDurationBlocks,
            lockedLPAmount:  _lpAmount,
            isActive:        true
        });

        emit LiquidityLocked(
            _projectId,
            token0,
            token1,
            _projectOwner,
            _lpAmount,
            block.number + _lockDurationBlocks
        );
    }

    function _createPublicLock(
        address _tokenA,
        address _tokenB,
        address _owner,
        uint256 _lpAmount,
        uint256 _lockDurationBlocks
    ) internal {
        if (_lpAmount == 0) revert ZeroAmount();
        if (_owner == address(0)) revert ZeroAddress();
        if (_lockDurationBlocks == 0) revert InvalidLockData();

         (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        LiquidityLock storage existing = liquidityLocks[token0][token1][_owner];
        if (existing.isActive) revert InvalidLockData(); // one lock per address per pool

        liquidityLocks[token0][token1][_owner] = LiquidityLock({
            projectId:      0,
            projectOwner:   _owner,
            unlockBlock:    block.number + _lockDurationBlocks,
            lockedLPAmount: _lpAmount,
            isActive:       true
        });

        emit LiquidityLocked(
            0,
            token0,
            token1,
            _owner,
            _lpAmount,
            block.number + _lockDurationBlocks
        );
    }

    // ================================
    //       Lock Validation (HYBRID)
    // ================================

    /**
     * @dev Check liquidity lock with AUTOMATIC CLEANUP
     *
     * HYBRID approach:
     * - If lock is inactive: allow withdrawal (already cleaned up)
     * - If lock expired: AUTO-CLEANUP state and emit event, then allow withdrawal
     * - If lock active: enforce withdrawal limits
     *
     * @param _tokenA   First token in pair
     * @param _tokenB   Second token in pair
     * @param _from     Address trying to remove liquidity
     * @param _lpAmount Amount of LP tokens to remove
     */
    function _checkLiquidityLock(
        address _tokenA,
        address _tokenB,
        address _from,
        uint256 _lpAmount
    ) internal {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        LiquidityLock storage lock = liquidityLocks[token0][token1][_from];

        if (!lock.isActive) return;

        // ═══════════════════════════════════════════════════════
        //  HYBRID FEATURE: Automatic cleanup on expired locks
        // ═══════════════════════════════════════════════════════
        if (block.number >= lock.unlockBlock) {
            uint256 projectId      = lock.projectId;
            uint256 unlockedAmount = lock.lockedLPAmount;

            lock.isActive      = false;
            lock.lockedLPAmount = 0;

            emit LiquidityUnlocked(projectId, token0, token1, _from, unlockedAmount);
            return;
        }

        // ═══════════════════════════════════════════════════════
        //  Lock is still active - enforce withdrawal limits
        // ═══════════════════════════════════════════════════════
        uint256 currentBalance = exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _from);

        uint256 withdrawableAmount = currentBalance > lock.lockedLPAmount
            ? currentBalance - lock.lockedLPAmount
            : 0;

        if (_lpAmount > withdrawableAmount) {
            revert LiquidityIsLocked();
        }
    }

    // ================================
    //       Manual Lock Management
    // ================================

    /**
     * @dev Optional manual unlock function
     *
     * Users can call this to explicitly clean up expired locks.
     * This is NOT required - cleanup happens automatically on withdrawal.
     *
     * @param _tokenA First token in pair
     * @param _tokenB Second token in pair
     * @param _owner  Lock owner address
     */
    function _unlockLiquidity(address _tokenA, address _tokenB, address _owner) internal {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];

        if (!lock.isActive) revert InvalidLockData();
        if (block.number < lock.unlockBlock) revert LiquidityIsLocked();

        uint256 projectId      = lock.projectId;
        uint256 unlockedAmount = lock.lockedLPAmount;

        lock.isActive       = false;
        lock.lockedLPAmount = 0;

        emit LiquidityUnlocked(projectId, token0, token1, _owner, unlockedAmount);
    }

    // ================================
    //       View Functions
    // ================================

    function _getLiquidityLock(address _tokenA, address _tokenB, address _owner)
        internal
        view
        returns (LiquidityLock memory)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return liquidityLocks[token0][token1][_owner];
    }

    /**
     * @dev Check if liquidity is currently locked (active and not expired)
     */
    function _isLiquidityLocked(address _tokenA, address _tokenB, address _owner)
        internal
        view
        returns (bool)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];

        return lock.isActive && block.number < lock.unlockBlock;
    }

    /**
     * @dev Get withdrawable LP amount (considering active locks)
     */
    function _getWithdrawableLPAmount(address _tokenA, address _tokenB, address _owner)
        internal
        view
        returns (uint256)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);

        uint256 totalBalance = exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _owner);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];

        if (!lock.isActive || block.number >= lock.unlockBlock) {
            return totalBalance;
        }

        return totalBalance > lock.lockedLPAmount ? totalBalance - lock.lockedLPAmount : 0;
    }

    /**
     * @dev Get blocks remaining until unlock
     */
    function _getBlocksUntilUnlock(address _tokenA, address _tokenB, address _owner)
        internal
        view
        returns (uint256)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];

        if (!lock.isActive) return 0;
        if (block.number >= lock.unlockBlock) return 0;

        return lock.unlockBlock - block.number;
    }

    /**
     * @dev Check if a lock can be manually unlocked
     * Returns true if lock is active and expired (eligible for cleanup)
     */
    function _canUnlockManually(address _tokenA, address _tokenB, address _owner)
        internal
        view
        returns (bool)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];

        return lock.isActive && block.number >= lock.unlockBlock;
    }
}