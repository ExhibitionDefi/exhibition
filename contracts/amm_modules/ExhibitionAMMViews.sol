// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./ExhibitionAMMStorage.sol";
import "./ExhibitionAMMLibrary.sol";

/**
 * @title ExhibitionAMMViews
 * @dev View functions for querying AMM data
 */
abstract contract ExhibitionAMMViews is ExhibitionAMMStorage {
    
    // ================================
    //       Pool Information
    // ================================
    
    /**
     * @dev Get pool information
     */
    function getPool(address _tokenA, address _tokenB) 
        public 
        view 
        returns (LiquidityPool memory) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        return liquidityPools[token0][token1];
    }

    /**
     * @dev Get reserves for a token pair
     */
    function getReserves(address _tokenA, address _tokenB) 
        external 
        view 
        returns (uint256 reserveA, uint256 reserveB, uint32 blockTimestampLast_) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        if (_tokenA == token0) {
            reserveA = pool.reserveA;
            reserveB = pool.reserveB;
        } else {
            reserveA = pool.reserveB;
            reserveB = pool.reserveA;
        }
        
        blockTimestampLast_ = twapData[token0][token1].blockTimestampLast;
    }

    /**
     * @dev Check if pool exists
     */
    function doesPoolExist(address _tokenA, address _tokenB) 
        external 
        view 
        returns (bool) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return poolExists[token0][token1];
    }

    /**
     * @dev Get all pool pairs
     */
    function getAllPoolPairs() external view returns (address[] memory) {
        return allPoolPairs;
    }

    /**
     * @dev Get pool count
     */
    function getPoolCount() external view returns (uint256) {
        return allPoolPairs.length / 2;
    }

    /**
     * @dev Get multiple pool information
     */
    function getMultiplePoolInfo(address[][] calldata _tokenPairs) 
        external 
        view 
        returns (LiquidityPool[] memory pools) 
    {
        require(_tokenPairs.length <= 20, "Too many pairs requested");
        
        pools = new LiquidityPool[](_tokenPairs.length);
        
        for (uint256 i = 0; i < _tokenPairs.length; i++) {
            require(_tokenPairs[i].length == 2, "Invalid token pair");
            
            (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(
                _tokenPairs[i][0], 
                _tokenPairs[i][1]
            );
            
            if (poolExists[token0][token1]) {
                pools[i] = liquidityPools[token0][token1];
            }
        }
    }

    /**
     * @dev Get pools with pagination
     */
    function getPoolsPaginated(
        uint256 _offset,
        uint256 _limit
    ) external view returns (
        address[] memory tokenAs,
        address[] memory tokenBs,
        uint256 totalPools,
        bool hasMore
    ) {
        require(_limit > 0 && _limit <= 25, "Invalid limit");
        
        totalPools = allPoolPairs.length / 2;
        
        uint256 remaining = totalPools > _offset ? totalPools - _offset : 0;
        uint256 pageSize = remaining > _limit ? _limit : remaining;
        hasMore = _offset + _limit < totalPools;
        
        tokenAs = new address[](pageSize);
        tokenBs = new address[](pageSize);
        
        for (uint256 i = 0; i < pageSize; i++) {
            uint256 pairIndex = (_offset + i) * 2;
            if (pairIndex + 1 < allPoolPairs.length) {
                tokenAs[i] = allPoolPairs[pairIndex];
                tokenBs[i] = allPoolPairs[pairIndex + 1];
            }
        }
    }

    // ================================
    //       Price & Quote Functions
    // ================================
    
    /**
     * @dev Get current price of tokenA in terms of tokenB
     */
    function getPrice(address _tokenA, address _tokenB) 
        external 
        view 
        returns (uint256 price) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        uint256 reserveA = (_tokenA == token0) ? pool.reserveA : pool.reserveB;
        uint256 reserveB = (_tokenA == token0) ? pool.reserveB : pool.reserveA;
        
        require(reserveA > 0, "Insufficient liquidity");
        
        price = (reserveB * 1e18) / reserveA;
    }

    /**
     * @dev Get amount out for a swap
     */
    function getAmountOut(
        uint256 _amountIn, 
        address _tokenIn, 
        address _tokenOut
    ) public view returns (uint256 amountOut) {
        require(_tokenIn != address(0) && _tokenOut != address(0), "Invalid token");
        require(_tokenIn != _tokenOut, "Same token");
        require(_amountIn > 0, "Zero amount");
        
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenIn, _tokenOut);
        require(poolExists[token0][token1], "Pool does not exist");
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        uint256 reserveIn = (_tokenIn == token0) ? pool.reserveA : pool.reserveB;
        uint256 reserveOut = (_tokenIn == token0) ? pool.reserveB : pool.reserveA;
        
        (amountOut,) = ExhibitionAMMLibrary.getAmountOut(
            _amountIn,
            reserveIn,
            reserveOut,
            feeConfig.tradingFee
        );
    }

    /**
     * @dev Get optimal liquidity amounts
     */
    function getOptimalLiquidityAmounts(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired
    ) external view returns (uint256 optimalAmountA, uint256 optimalAmountB) {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        
        if (!poolExists[token0][token1]) {
            return (_amountADesired, _amountBDesired);
        }
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        uint256 reserveA = (_tokenA == token0) ? pool.reserveA : pool.reserveB;
        uint256 reserveB = (_tokenA == token0) ? pool.reserveB : pool.reserveA;
        
        (optimalAmountA, optimalAmountB) = ExhibitionAMMLibrary.calculateOptimalAmounts(
            _amountADesired,
            _amountBDesired,
            reserveA,
            reserveB
        );
    }

    /**
     * @dev Get remove liquidity quote
     */
    function getRemoveLiquidityQuote(
        address _tokenA, 
        address _tokenB, 
        uint256 _lpAmount
    ) public view returns (uint256 amountA, uint256 amountB) {
        require(_lpAmount > 0, "Zero liquidity");
        
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        require(pool.totalLPSupply > 0, "No liquidity");
        
        (uint256 amount0, uint256 amount1) = ExhibitionAMMLibrary.calculateRemoveAmounts(
            _lpAmount,
            pool.reserveA,
            pool.reserveB,
            pool.totalLPSupply
        );
        
        amountA = (_tokenA == token0) ? amount0 : amount1;
        amountB = (_tokenA == token0) ? amount1 : amount0;
    }

    /**
     * @dev Get slippage impact for a swap
     */
    function getSlippageImpact(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256 slippagePercentage) {
        if (_amountIn == 0) return 0;
        
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenIn, _tokenOut);
        if (!poolExists[token0][token1]) return 0;
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        uint256 reserveIn = (_tokenIn == token0) ? pool.reserveA : pool.reserveB;
        uint256 reserveOut = (_tokenIn == token0) ? pool.reserveB : pool.reserveA;
        
        slippagePercentage = ExhibitionAMMLibrary.calculatePriceImpact(
            _amountIn,
            reserveIn,
            reserveOut,
            feeConfig.tradingFee
        );
    }

    // ================================
    //       User Portfolio Functions
    // ================================
    
    /**
     * @dev Get user's LP balance for a specific pool
     */
    function getLPBalance(address _tokenA, address _tokenB, address _user) 
        external 
        view 
        returns (uint256) 
    {
        return exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _user);
    }

    /**
     * @dev Get total LP supply for a pool
     */
    function getTotalLPSupply(address _tokenA, address _tokenB) 
        external 
        view 
        returns (uint256) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return exhibitionLPTokens.totalSupply(token0, token1);
    }

    /**
     * @dev Get user's position count
     */
    function getUserPositionCount(address _user) 
        external 
        view 
        returns (uint256 count) 
    {
        for (uint256 i = 0; i < allPoolPairs.length; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
                if (balance > 0) {
                    count++;
                }
            }
        }
    }

    /**
     * @dev Get user's portfolio with pagination
     */
    function getUserPortfolio(
        address _user,
        uint256 _offset,
        uint256 _limit
    ) external view returns (
        address[] memory tokenAs,
        address[] memory tokenBs, 
        uint256[] memory lpBalances,
        uint256[] memory sharePercentages,
        uint256 totalPositions,
        bool hasMore
    ) {
        require(_limit > 0 && _limit <= 50, "Invalid limit");
        
        // Count total positions
        totalPositions = 0;
        for (uint256 i = 0; i < allPoolPairs.length; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
                if (balance > 0) {
                    totalPositions++;
                }
            }
        }
        
        // Calculate pagination
        uint256 remaining = totalPositions > _offset ? totalPositions - _offset : 0;
        uint256 pageSize = remaining > _limit ? _limit : remaining;
        hasMore = _offset + _limit < totalPositions;
        
        // Initialize arrays
        tokenAs = new address[](pageSize);
        tokenBs = new address[](pageSize);
        lpBalances = new uint256[](pageSize);
        sharePercentages = new uint256[](pageSize);
        
        // Fill arrays
        uint256 positionIndex = 0;
        uint256 resultIndex = 0;
        
        for (uint256 i = 0; i < allPoolPairs.length && resultIndex < pageSize; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
                
                if (balance > 0) {
                    if (positionIndex >= _offset) {
                        tokenAs[resultIndex] = tokenA;
                        tokenBs[resultIndex] = tokenB;
                        lpBalances[resultIndex] = balance;
                        
                        uint256 totalSupply = exhibitionLPTokens.totalSupply(tokenA, tokenB);
                        sharePercentages[resultIndex] = ExhibitionAMMLibrary.calculateSharePercentage(
                            balance, 
                            totalSupply
                        );
                        
                        resultIndex++;
                    }
                    positionIndex++;
                }
            }
        }
    }

    /**
     * @dev Get user balances for specific pools
     */
    function getUserBalancesForPools(
        address _user,
        address[][] calldata _tokenPairs
    ) external view returns (uint256[] memory balances) {
        balances = new uint256[](_tokenPairs.length);
        
        for (uint256 i = 0; i < _tokenPairs.length; i++) {
            require(_tokenPairs[i].length == 2, "Invalid token pair");
            balances[i] = exhibitionLPTokens.balanceOf(
                _tokenPairs[i][0], 
                _tokenPairs[i][1], 
                _user
            );
        }
    }

    /**
     * @dev Get user's position summary
     */
    function getUserPositionSummary(address _user) 
        external 
        view 
        returns (
            uint256 positionCount,
            uint256 totalLPValue,
            uint256 activePoolCount
        ) 
    {
        for (uint256 i = 0; i < allPoolPairs.length; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
                
                if (balance > 0) {
                    positionCount++;
                    activePoolCount++;
                    
                    (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(tokenA, tokenB);
                    if (poolExists[token0][token1]) {
                        LiquidityPool memory pool = liquidityPools[token0][token1];
                        if (pool.totalLPSupply > 0) {
                            uint256 userShare = (balance * 10000) / pool.totalLPSupply;
                            totalLPValue += (pool.reserveA + pool.reserveB) * userShare / 10000;
                        }
                    }
                }
            }
        }
    }

    // ================================
    //       TWAP Functions
    // ================================
    
    /**
     * @dev Get TWAP cumulative prices
     */
    function getPoolCumulatives(address _tokenA, address _tokenB)
        public
        view
        returns (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp)
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        
        TWAPData storage twap = twapData[token0][token1];
        price0Cumulative = twap.price0CumulativeLast;
        price1Cumulative = twap.price1CumulativeLast;
        blockTimestamp = twap.blockTimestampLast;
    }

    /**
     * @dev Get TWAP price over a period
     */
    function getTWAP(address _tokenA, address _tokenB, uint32 _period) 
        external 
        view 
        returns (uint256 twapPrice) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");

        TWAPData storage twap = twapData[token0][token1];
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - twap.blockTimestampLast;
        
        require(timeElapsed >= _period, "Insufficient time elapsed");

        if (_tokenA == token0) {
            twapPrice = twap.price0CumulativeLast / _period;
        } else {
            twapPrice = twap.price1CumulativeLast / _period;
        }
    }

    // ================================
    //       Token Info Functions
    // ================================
    
    /**
     * @dev Get token decimals
     */
    function getTokenDecimals(address _token) 
        external 
        view 
        returns (uint8) 
    {
        try IERC20Metadata(_token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            return 18;
        }
    }

    /**
     * @dev Get token symbol
     */
    function getTokenSymbol(address _token) 
        external 
        view 
        returns (string memory) 
    {
        try IERC20Metadata(_token).symbol() returns (string memory symbol) {
            return symbol;
        } catch {
            return "UNKNOWN";
        }
    }

    /**
     * @dev Get multiple tokens info
     */
    function getTokensInfo(address[] calldata _tokens) 
        external 
        view 
        returns (
            string[] memory symbols,
            uint8[] memory decimals,
            uint256[] memory totalSupplies
        ) 
    {
        uint256 length = _tokens.length;
        symbols = new string[](length);
        decimals = new uint8[](length);
        totalSupplies = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            try IERC20Metadata(_tokens[i]).symbol() returns (string memory symbol) {
                symbols[i] = symbol;
            } catch {
                symbols[i] = "UNKNOWN";
            }
            
            try IERC20Metadata(_tokens[i]).decimals() returns (uint8 dec) {
                decimals[i] = dec;
            } catch {
                decimals[i] = 18;
            }
            
            totalSupplies[i] = IERC20(_tokens[i]).totalSupply();
        }
    }

    // ================================
    //       Statistics Functions
    // ================================
    
    /**
     * @dev Get pool statistics
     */
    function getPoolStatistics(address _tokenA, address _tokenB) 
        external 
        view 
        returns (
            uint256 volume24h,
            uint256 tvl,
            uint256 utilization
        ) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        require(poolExists[token0][token1], "Pool does not exist");
        
        LiquidityPool storage pool = liquidityPools[token0][token1];
        
        // TVL (simplified - ideally use price oracle)
        tvl = pool.reserveA + pool.reserveB;
        
        // Volume tracking would require event indexing
        volume24h = 0;
        
        // Utilization calculation
        utilization = pool.totalLPSupply > 0 ? 
            ((pool.reserveA * pool.reserveB) * 10000) / (pool.totalLPSupply * pool.totalLPSupply) : 0;
    }

    // ================================
    //       Lock View Functions
    // ================================

    /**
     * @dev Get liquidity lock info
     */
    function getLiquidityLock(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (LiquidityLock memory) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        return liquidityLocks[token0][token1][_owner];
    }

    /**
     * @dev Check if liquidity is locked
     */
    function isLiquidityLocked(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (bool) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
    
        return lock.isActive && block.timestamp < lock.unlockTime;
    }

    /**
     * @dev Get withdrawable LP amount
     */
    function getWithdrawableLPAmount(address _tokenA, address _tokenB, address _owner) 
        external 
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
     * @dev Get time until unlock
     */
    function getTimeUntilUnlock(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (uint256) 
    {
        (address token0, address token1) = ExhibitionAMMLibrary.sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
    
        if (!lock.isActive) return 0;
        if (block.timestamp >= lock.unlockTime) return 0;
    
        return lock.unlockTime - block.timestamp;
    }
}