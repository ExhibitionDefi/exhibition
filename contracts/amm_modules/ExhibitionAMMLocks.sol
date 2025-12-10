// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";
import "./ExhibitionAMMErrors.sol";

/**
 * @title ExhibitionAMMLocks
 * @dev Liquidity lock management with HYBRID approach
 * 
 * KEY FEATURES (Option B):
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
     * @param _projectId Project ID from Exhibition
     * @param _tokenA First token in pair
     * @param _tokenB Second token in pair
     * @param _projectOwner Project owner address (receives locked LP tokens)
     * @param _lpAmount Amount of LP tokens to lock
     * @param _lockDuration Lock duration in seconds
     */
    function _createLiquidityLock(
        uint256 _projectId,
        address _tokenA,
        address _tokenB,
        address _projectOwner,
        uint256 _lpAmount,
        uint256 _lockDuration
    ) internal {
        if (_lpAmount == 0) revert ZeroAmount();
        if (_projectOwner == address(0)) revert ZeroAddress();
        if (_lockDuration == 0) revert InvalidLockData();

        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        // Store project token pair for lookup
        projectTokenPairs[_projectId] = [token0, token1];

        // Create the lock
        liquidityLocks[token0][token1][_projectOwner] = LiquidityLock({
            projectId: _projectId,
            projectOwner: _projectOwner,
            unlockTime: block.timestamp + _lockDuration,
            lockedLPAmount: _lpAmount,
            isActive: true  // Lock is now active
        });

        emit LiquidityLocked(
            _projectId, 
            token0, 
            token1, 
            _projectOwner, 
            _lpAmount, 
            block.timestamp + _lockDuration
        );
    }

    // ================================
    //       Lock Validation (HYBRID)
    // ================================
    
    /**
     * @dev Check liquidity lock with AUTOMATIC CLEANUP
     * 
     * This is the HYBRID approach (Option B):
     * - If lock is inactive: allow withdrawal (already cleaned up)
     * - If lock expired: AUTO-CLEANUP state and emit event, then allow withdrawal
     * - If lock active: enforce withdrawal limits
     * 
     * Called during removeLiquidity() before allowing withdrawal
     * 
     * @param _tokenA First token in pair
     * @param _tokenB Second token in pair
     * @param _from Address trying to remove liquidity
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
        
        // Skip check if lock doesn't exist or already cleaned up
        if (!lock.isActive) return;
        
        // ═══════════════════════════════════════════════════════
        //  HYBRID FEATURE: Automatic cleanup on expired locks
        // ═══════════════════════════════════════════════════════
        if (block.timestamp >= lock.unlockTime) {
            // Lock has expired - automatically clean up state
            uint256 projectId = lock.projectId;
            uint256 unlockedAmount = lock.lockedLPAmount;
            
            // Deactivate the lock (saves gas on future calls)
            lock.isActive = false;
            lock.lockedLPAmount = 0;
            
            // Emit unlock event for indexers/frontends
            emit LiquidityUnlocked(projectId, token0, token1, _from, unlockedAmount);
            
            // Allow withdrawal to proceed (no revert)
            return;
        }
        
        // ═══════════════════════════════════════════════════════
        //  Lock is still active - enforce withdrawal limits
        // ═══════════════════════════════════════════════════════
        uint256 currentBalance = exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _from);
        
        // Calculate how much can be withdrawn (balance - locked amount)
        uint256 withdrawableAmount = currentBalance > lock.lockedLPAmount 
            ? currentBalance - lock.lockedLPAmount 
            : 0;
        
        // Revert if trying to withdraw more than allowed
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
     * WHY PROVIDE THIS?
     * - Gas optimization: clean up before withdrawal to save gas
     * - State hygiene: allows users to tidy up their locks
     * - Event emission: get unlock event without making a withdrawal
     * 
     * @param _tokenA First token in pair
     * @param _tokenB Second token in pair
     * @param _owner Lock owner address
     */
    function _unlockLiquidity(address _tokenA, address _tokenB, address _owner) internal {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
        
        // Validate lock exists and is active
        if (!lock.isActive) revert InvalidLockData();
        
        // Validate lock has expired
        if (block.timestamp < lock.unlockTime) revert LiquidityIsLocked();
        
        uint256 projectId = lock.projectId;
        uint256 unlockedAmount = lock.lockedLPAmount;
        
        // Deactivate the lock
        lock.isActive = false;
        lock.lockedLPAmount = 0;
        
        emit LiquidityUnlocked(projectId, token0, token1, _owner, unlockedAmount);
    }

    // ================================
    //       View Functions
    // ================================
    
    /**
     * @dev Get liquidity lock information
     */
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
        
        return lock.isActive && block.timestamp < lock.unlockTime;
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
        
        // If no active lock or expired, entire balance is withdrawable
        if (!lock.isActive || block.timestamp >= lock.unlockTime) {
            return totalBalance;
        }
        
        // Return withdrawable amount (total - locked)
        return totalBalance > lock.lockedLPAmount ? totalBalance - lock.lockedLPAmount : 0;
    }

    /**
     * @dev Get time remaining until unlock
     */
    function _getTimeUntilUnlock(address _tokenA, address _tokenB, address _owner) 
        internal 
        view 
        returns (uint256) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
        
        if (!lock.isActive) return 0;
        if (block.timestamp >= lock.unlockTime) return 0;
        
        return lock.unlockTime - block.timestamp;
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
        
        return lock.isActive && block.timestamp >= lock.unlockTime;
    }
}