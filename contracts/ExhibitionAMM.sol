// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// --- OpenZeppelin Imports ---
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "contracts/interfaces/IExhibitionLPTokens.sol";
import "contracts/interfaces/IExhibitionAMM.sol";


// --- Library for fixed-point arithmetic (Uniswap V2 style) ---
library UQ112x112 {
    uint224 constant Q112 = 2**112;

    function encode(uint112 y) internal pure returns (uint224 z) {
        z = uint224(y) * Q112;
    }

    function decode(uint224 z) internal pure returns (uint112 y) {
        y = uint112(z / Q112);
    }

    function mul(uint224 x, uint256 y) internal pure returns (uint256 z) {
        z = uint256(x) * y;
    }

    function div(uint224 x, uint256 y) internal pure returns (uint256 z) {
        z = uint256(x) / y;
    }

    function mulDiv(uint256 x, uint256 y, uint256 z) internal pure returns (uint256) {
        require(z != 0, "mulDiv: division by zero");
        uint256 mm = x * y;
        if (mm == 0) return 0;
        uint256 result = mm / z;
        return result;
    }
}

/**
 * @title ExhibitionAMM
 * @dev Enhanced AMM with liquidity lock enforcement for launchpad projects
 *
 * @dev This contract implements the Automated Market Maker (AMM) functionalities
 * for token swapping and liquidity provision, based on a Uniswap V2-like model.
 * It manages liquidity pools for various token pairs.
 */
contract ExhibitionAMM is Ownable, ReentrancyGuard {
    using UQ112x112 for uint256;
    // ================================
    //       Error Definitions
    // ================================
    error InvalidAmount();
    error InsufficientLiquidity();
    error SlippageTooHigh();
    error DeadlineExpired();
    error ZeroAddress();
    error Unauthorized();
    error TokenTransferFailed();
    error PoolDoesNotExist();
    error PoolAlreadyExists();
    error NotEnoughLiquidityToBurn();
    error ZeroAmount();
    error ZeroLiquidity();
    error InvalidTokenAddress();
    error InvalidRecipient();
    error InsufficientContribution();
    error LiquidityIsLocked();
    error InvalidLockData();
    error ExhibitionContractNotSet();

    // --- State Variables & Constants ---
    IExhibitionLPTokens public exhibitionLPTokens;
    address public exNEXADDRESS;
    address public exUSDTADDRESS;
    address public ExhTokenAddress;
    
    // --- NEW: Exhibition Contract Reference ---
    address public exhibitionContract;

    // --- NEW: Liquidity Lock Mappings ---
    // Maps (tokenA, tokenB, owner) to their liquidity lock info
    mapping(address => mapping(address => mapping(address => LiquidityLock))) public liquidityLocks;
    // Maps project ID to the tokens involved for easy lookup   
    mapping(uint256 => address[2]) public projectTokenPairs;

    // Mapping to store the details of each liquidity pool, keyed by the canonical (ordered) addresses of the two tokens.
    mapping(address => mapping(address => LiquidityPool)) public liquidityPools;
    mapping(address => mapping(address => bool)) public poolExists;
    address[] public allPoolPairs;
    mapping(address => mapping(address => uint256)) private _kLast;

    // --- TWAP Specific State Variables ---
    mapping(address => mapping(address => uint256)) public price0CumulativeLast;
    mapping(address => mapping(address => uint256)) public price1CumulativeLast;
    mapping(address => mapping(address => uint32)) public blockTimestampLast;
    // NEW: For portfolio tracking and batch operations
    mapping(address => address[]) public userPoolTokensA;
    mapping(address => address[]) public userPoolTokensB;
    mapping(address => mapping(address => mapping(address => bool))) public userHasPosition;
    // NEW: For fee tracking (optional - for APR calculations)
    mapping(address => mapping(address => uint256)) public totalFeesCollected;
    mapping(address => mapping(address => uint256)) public lastFeeUpdateTime;

    // --- Events ---
    event LiquidityAdded(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidityMinted
    );
    event LiquidityRemoved(
        address indexed provider,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountA,
        uint256 amountB
    );
    event Swap(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    event PoolCreated(address indexed tokenA, address indexed tokenB);
    event EmergencyWithdrawal(address indexed token, uint256 amount, address indexed recipient);
    event ReservesUpdated(address indexed token0, address indexed token1, uint256 reserve0, uint256 reserve1);
    
    // --- NEW: Lock-related Events ---
    event LiquidityLocked(
        uint256 indexed projectId,
        address indexed tokenA,
        address indexed tokenB,
        address projectOwner,
        uint256 lpAmount,
        uint256 unlockTime
    );
    event LiquidityUnlocked(
        uint256 indexed projectId,
        address indexed tokenA,
        address indexed tokenB,
        address projectOwner,
        uint256 lpAmount
    );
    event ExhibitionContractSet(address indexed oldAddress, address indexed newAddress);

    // constructor
    constructor() Ownable(msg.sender) {}

    // ============================================================
    //      Owner-Only Configuration for Exhibition Contract 
    // ===========================================================
    /**
     * @dev Sets the Exhibition contract address for liquidity lock enforcement
     * @param _exhibitionContract Address of the Exhibition contract
     */
    function setExhibitionContract(address _exhibitionContract) external onlyOwner {
        if (_exhibitionContract == address(0)) revert ZeroAddress();
        
        address oldAddress = exhibitionContract;
        exhibitionContract = _exhibitionContract;
        emit ExhibitionContractSet(oldAddress, _exhibitionContract);
    }

    function setExhTokenAddress(address _exhTokenAddress) external onlyOwner {
        if (_exhTokenAddress == address(0)) revert ZeroAddress();
        ExhTokenAddress = _exhTokenAddress;
    }

    function setExNEXAddress(address _exNEXAddress) public onlyOwner {
        if (_exNEXAddress == address(0)) revert ZeroAddress();
        exNEXADDRESS = _exNEXAddress;
    }

    function setExUSDTAddress(address _exUSDTAddress) public onlyOwner {
        if (_exUSDTAddress == address(0)) revert ZeroAddress();
        exUSDTADDRESS = _exUSDTAddress;
    }

    // ==============================================
    //       Owner-Only Configuration Functions 
    // ==============================================
    function setLPTokensAddress(address _lpTokensAddress) public onlyOwner {
        require(_lpTokensAddress != address(0), "Zero address");
        exhibitionLPTokens = IExhibitionLPTokens(_lpTokensAddress);
    }
    /**
     * @dev Allows the contract owner to recover any ERC20 tokens mistakenly sent to this contract.
     * This is a safety mechanism to prevent funds from being permanently locked.
     * It should NOT be used to withdraw funds that are part of active liquidity pools.
     * @param _token The address of the ERC20 token to withdraw.
     * @param _amount The amount of the token to withdraw.
     * @param _recipient The address to send the recovered tokens to.
     */
    function emergencyWithdraw(address _token, uint256 _amount, address _recipient) public onlyOwner {
        if (_recipient == address(0)) {
            revert InvalidRecipient();
        }
        if (_amount == 0) {
            revert ZeroAmount();
        }

        if (IERC20(_token).balanceOf(address(this)) < _amount) {
            revert InsufficientLiquidity();
        }
        bool success = IERC20(_token).transfer(_recipient, _amount);
        if (!success) {
            revert TokenTransferFailed();
        }
        emit EmergencyWithdrawal(_token, _amount, _recipient);
    }

    // --- Internal Helper Functions ---
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = x;
        uint256 y = x / 2 + 1;
        while (y < z) {
            z = y;
            y = (x / y + y) / 2;
        }
        return z;
    }
    
    /**
     * @dev Ensures consistent ordering of token addresses for liquidity pools.
     * This is crucial for unique pool identification regardless of input order (e.g., A/B is same as B/A).
     * The lower address is always returned as token0, and the higher as token1.
     * @param _tokenA The address of the first token.
     * @param _tokenB The address of the second token.
     * @return token0 The canonically ordered first token address.
     * @return token1 The canonically ordered second token address.
     */
    function _sortTokens(address _tokenA, address _tokenB) internal pure returns (address token0, address token1) {
        if (_tokenA == address(0) || _tokenB == address(0)) {
            revert ZeroAddress();
        }
        if (_tokenA == _tokenB) {
            revert InvalidTokenAddress();
        }

        if (_tokenA < _tokenB) {
            token0 = _tokenA;
            token1 = _tokenB;
        } else {
            token0 = _tokenB;
            token1 = _tokenA;
        }
    }
    
    /**
     * @dev Retrieves the current reserves for a given token pair from the liquidityPools mapping.
     * It uses the canonical ordering of token addresses to ensure correct lookup.
     * @param _tokenA The address of the first token in the pair.
     * @param _tokenB The address of the second token in the pair.
     * @return reserveA The reserve amount of tokenA in the pool.
     * @return reserveB The reserve amount of tokenB in the pool.
     */
    function _getReserves(address _tokenA, address _tokenB) internal view returns (uint256 reserveA, uint256 reserveB) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }

        LiquidityPool storage pool = liquidityPools[token0][token1];

        if (_tokenA == token0) {
            reserveA = pool.reserveA;
            reserveB = pool.reserveB;
        } else {
            reserveA = pool.reserveB;
            reserveB = pool.reserveA;
        }
    }
    
    /**
     * @dev Calculates the amount of output tokens received for a given amount of input tokens.
     * This directly mirrors Uniswap V2's `getAmountOut` logic.
     * This function expects all amounts and reserves to be in their native decimals.
     * Precision issues may arise if tokens have different decimal places.
     * @param amountIn The amount of input tokens being swapped (in its token's smallest unit).
     * @param reserveIn The reserve of the input token in the pool (in its token's smallest unit).
     * @param reserveOut The reserve of the output token in the pool (in its token's smallest unit).
     * @return amountOut The calculated amount of output tokens (in its token's smallest unit).
     */
    function _getAmountOutInternal(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountOut) {
        if (amountIn == 0) revert ZeroAmount();
        if (reserveIn == 0 || reserveOut == 0) revert InsufficientLiquidity();

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;

        amountOut = numerator / denominator;
    }
    
    /**
     * @dev Handles the minting of new LP tokens for a specific pool.
     * This function interacts with the ExhibitionLPTokens contract.
     * It also updates the cached totalLPSupply in the LiquidityPool struct.
     * @param _tokenA The address of the first token in the pair (canonical order).
     * @param _tokenB The address of the second token in the pair (canonical order).
     * @param _to The address to which the LP tokens will be minted.
     * @param _amount The amount of LP tokens to mint.
     */
    function _mintLiquidity(address _tokenA, address _tokenB, address _to, uint256 _amount) internal {
        if (address(exhibitionLPTokens) == address(0)) {
            revert Unauthorized();
        }
        if (_amount == 0) {
            revert ZeroAmount();
        }

        // Track user position for portfolio queries
        if (!userHasPosition[_tokenA][_tokenB][_to]) {
            userPoolTokensA[_to].push(_tokenA);
            userPoolTokensB[_to].push(_tokenB);
            userHasPosition[_tokenA][_tokenB][_to] = true;
        }

        exhibitionLPTokens.mint(_tokenA, _tokenB, _to, _amount);
        liquidityPools[_tokenA][_tokenB].totalLPSupply += _amount;
    }
    
    /**
     * @dev Handles the burning of LP tokens for a specific pool.
     * This function interacts with the ExhibitionLPTokens contract.
     * It also updates the cached totalLPSupply in the LiquidityPool struct.
     * @param _tokenA The address of the first token in the pair (canonical order).
     * @param _tokenB The address of the second token in the pair (canonical order).
     * @param _from The address from which the LP tokens will be burned.
     * @param _amount The amount of LP tokens to burn.
     */
    function _burnLiquidity(address _tokenA, address _tokenB, address _from, uint256 _amount) internal {
        if (address(exhibitionLPTokens) == address(0)) {
            revert Unauthorized();
        }
        if (_amount == 0) {
            revert ZeroAmount();
        }

        exhibitionLPTokens.burn(_tokenA, _tokenB, _from, _amount);
        liquidityPools[_tokenA][_tokenB].totalLPSupply -= _amount;
    }
    
    /**
     * @dev Updates the reserves of a specific liquidity pool.
     * This function is called after successful liquidity additions or swaps.
     * It also updates the _kLast value for potential future fee models.
     *
     * IMPORTANT: This function now also updates the TWAP cumulative prices.
     * @param _tokenA The address of the first token in the pair (canonical order).
     * @param _tokenB The address of the second token in the pair (canonical order).
     * @param _newReserveA The new reserve amount for tokenA.
     * @param _newReserveB The new reserve amount for tokenB.
     */
    function _updateReserves(address _tokenA, address _tokenB, uint256 _newReserveA, uint256 _newReserveB) internal {
        LiquidityPool storage pool = liquidityPools[_tokenA][_tokenB];

        // --- TWAP Update Logic ---
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast[_tokenA][_tokenB];

        if (timeElapsed > 0 && pool.reserveA != 0 && pool.reserveB != 0) {
            if (pool.reserveA != 0 && pool.reserveB != 0) {
                price0CumulativeLast[_tokenA][_tokenB] += UQ112x112.mulDiv(pool.reserveB, timeElapsed, pool.reserveA);
                price1CumulativeLast[_tokenA][_tokenB] += UQ112x112.mulDiv(pool.reserveA, timeElapsed, pool.reserveB);
            }
        }
        blockTimestampLast[_tokenA][_tokenB] = blockTimestamp;

        pool.reserveA = _newReserveA;
        pool.reserveB = _newReserveB;
        _kLast[_tokenA][_tokenB] = _newReserveA * _newReserveB;

        emit ReservesUpdated(_tokenA, _tokenB, _newReserveA, _newReserveB);
    }
    
    /**
     * @dev Handles the transfer of tokens, supporting only ERC20 tokens.
     * It uses `transferFrom` if `_from` is not `address(this)`,
     * implying the contract needs allowance from `_from`. If `_from` is `address(this)`,
     * it uses `transfer`.
     * @param _token The address of the token to transfer.
     * @param _from The sender address.
     * @param _to The recipient address.
     * @param _amount The amount of tokens to transfer.
     */
    function _transferTokens(address _token, address _from, address _to, uint256 _amount) internal {
        if (_amount == 0) {
            revert ZeroAmount();
        }
        if (_to == address(0)) {
            revert InvalidRecipient();
        }

        if (_from == address(this)) {
            bool success = IERC20(_token).transfer(_to, _amount);
            if (!success) {
                revert TokenTransferFailed();
            }
        } else {
            bool success = IERC20(_token).transferFrom(_from, _to, _amount);
            if (!success) {
                revert TokenTransferFailed();
            }
        }
    }

    // --- NEW: Liquidity Lock Enforcement Functions ---

    /**
     * @dev Creates a liquidity lock when Exhibition contract adds initial liquidity
     * @param _projectId The project ID from Exhibition contract
     * @param _tokenA First token in the pair
     * @param _tokenB Second token in the pair  
     * @param _projectOwner Address of the project owner
     * @param _lpAmount Amount of LP tokens to lock
     * @param _lockDuration Duration of the lock in seconds
     */
    function createLiquidityLock(
        uint256 _projectId,
        address _tokenA,
        address _tokenB,
        address _projectOwner,
        uint256 _lpAmount,
        uint256 _lockDuration
    ) external {
        // Only Exhibition contract can create locks
        if (msg.sender != exhibitionContract) revert Unauthorized();
        if (_lpAmount == 0) revert ZeroAmount();
        if (_projectOwner == address(0)) revert ZeroAddress();

        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        // Store project token pair for easy lookup
        projectTokenPairs[_projectId] = [token0, token1];

        // Create the lock
        liquidityLocks[token0][token1][_projectOwner] = LiquidityLock({
            projectId: _projectId,
            projectOwner: _projectOwner,
            unlockTime: block.timestamp + _lockDuration,
            lockedLPAmount: _lpAmount,
            isActive: true
        });

        emit LiquidityLocked(_projectId, token0, token1, _projectOwner, _lpAmount, block.timestamp + _lockDuration);
    }

    /**
     * @dev Checks if liquidity removal is allowed for a specific user and amount
     * @param _tokenA First token in the pair
     * @param _tokenB Second token in the pair
     * @param _from Address trying to remove liquidity
     * @param _lpAmount Amount of LP tokens to remove
     */
    function _checkLiquidityLock(
        address _tokenA,
        address _tokenB,
        address _from,
        uint256 _lpAmount
    ) internal view {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        LiquidityLock storage lock = liquidityLocks[token0][token1][_from];
        
        // If no active lock exists, allow removal
        if (!lock.isActive) return;
        
        // If lock has expired, allow removal
        if (block.timestamp >= lock.unlockTime) return;
        
        // Get current LP balance
        uint256 currentBalance = exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _from);
        
        // Calculate how much they can withdraw (current balance - locked amount)
        uint256 withdrawableAmount = currentBalance > lock.lockedLPAmount ? 
            currentBalance - lock.lockedLPAmount : 0;
        
        // Check if they're trying to withdraw more than allowed
        if (_lpAmount > withdrawableAmount) {
            revert LiquidityIsLocked();
        }
    }

    /**
     * @dev Unlocks liquidity after the lock period expires
     * @param _tokenA First token in the pair
     * @param _tokenB Second token in the pair
     */
    function unlockLiquidity(address _tokenA, address _tokenB) external {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        LiquidityLock storage lock = liquidityLocks[token0][token1][msg.sender];
        
        if (!lock.isActive) revert InvalidLockData();
        if (block.timestamp < lock.unlockTime) revert LiquidityIsLocked();
        
        uint256 projectId = lock.projectId;
        uint256 unlockedAmount = lock.lockedLPAmount;
        
        // Deactivate the lock
        lock.isActive = false;
        lock.lockedLPAmount = 0;
        
        emit LiquidityUnlocked(projectId, token0, token1, msg.sender, unlockedAmount);
    }

    // --- NEW: Lock Query Functions ---

    /**
     * @dev Returns liquidity lock information for a specific user and pair
     */
    function getLiquidityLock(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (LiquidityLock memory) 
    {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return liquidityLocks[token0][token1][_owner];
    }

    /**
     * @dev Returns whether liquidity is currently locked for a user
     */
    function isLiquidityLocked(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (bool) 
    {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
        
        return lock.isActive && block.timestamp < lock.unlockTime;
    }

    /**
     * @dev Returns the withdrawable LP amount (considering locks)
     */
    function getWithdrawableLPAmount(address _tokenA, address _tokenB, address _owner) 
        external 
        view 
        returns (uint256) 
    {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        uint256 totalBalance = exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _owner);
        LiquidityLock storage lock = liquidityLocks[token0][token1][_owner];
        
        // If no active lock or lock expired, entire balance is withdrawable
        if (!lock.isActive || block.timestamp >= lock.unlockTime) {
            return totalBalance;
        }
        
        // Return withdrawable amount (total - locked)
        return totalBalance > lock.lockedLPAmount ? totalBalance - lock.lockedLPAmount : 0;
    }

    // --- AMM Functions (Enhanced with Lock Checks) ---

    /**
     * @dev Enhanced addLiquidityWithLock - Special function for Exhibition contract to add locked liquidity
     * FIXED: Removed recursive external call that caused reentrancy issue
     */
    function addLiquidityWithLock(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline,
        uint256 _projectId,
        uint256 _lockDuration
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Only Exhibition contract can call this function
        if (msg.sender != exhibitionContract) revert Unauthorized();
        if (block.timestamp >= _deadline) revert DeadlineExpired();
        if (_to == address(0)) revert InvalidRecipient();

        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        // FIXED: Inline the addLiquidity logic instead of making external call
        if (!poolExists[token0][token1]) {
            // Create new pool
            poolExists[token0][token1] = true;
            liquidityPools[token0][token1].tokenA = token0;
            liquidityPools[token0][token1].tokenB = token1;
            allPoolPairs.push(token0);
            allPoolPairs.push(token1);
            emit PoolCreated(token0, token1);

            if (_amountADesired == 0 || _amountBDesired == 0) {
                revert InvalidAmount();
            }

            amountA = _amountADesired;
            amountB = _amountBDesired;
            liquidity = _sqrt(amountA * amountB);
            if (liquidity == 0) {
                revert ZeroLiquidity();
            }

            // Transfer tokens from Exhibition contract (msg.sender) to AMM
            _transferTokens(_tokenA, msg.sender, address(this), amountA);
            _transferTokens(_tokenB, msg.sender, address(this), amountB);

            uint256 amount0ForUpdate = (_tokenA == token0) ? amountA : amountB;
            uint256 amount1ForUpdate = (_tokenA == token0) ? amountB : amountA;

            _updateReserves(token0, token1, amount0ForUpdate, amount1ForUpdate);
            _mintLiquidity(token0, token1, _to, liquidity);

            emit LiquidityAdded(msg.sender, _tokenA, _tokenB, amountA, amountB, liquidity);
        } else {
            // Add to existing pool
            (uint256 reserveA, uint256 reserveB) = _getReserves(_tokenA, _tokenB);

            uint256 amountBOptimal = (reserveB * _amountADesired) / reserveA;
            uint256 amountAOptimal = (reserveA * _amountBDesired) / reserveB;

            if (amountBOptimal <= _amountBDesired) {
                amountA = _amountADesired;
                amountB = amountBOptimal;
            } else {
                amountA = amountAOptimal;
                amountB = _amountBDesired;
            }

            if (amountA < _amountAMin || amountB < _amountBMin) {
                revert SlippageTooHigh();
            }

            uint256 currentTotalLPSupply = exhibitionLPTokens.totalSupply(token0, token1);
            uint256 liquidityA = (amountA * currentTotalLPSupply) / reserveA;
            uint256 liquidityB = (amountB * currentTotalLPSupply) / reserveB;
            liquidity = (liquidityA < liquidityB) ? liquidityA : liquidityB;

            if (liquidity == 0) {
                revert ZeroLiquidity();
            }

            // Transfer tokens from Exhibition contract (msg.sender) to AMM
            _transferTokens(_tokenA, msg.sender, address(this), amountA);
            _transferTokens(_tokenB, msg.sender, address(this), amountB);

            uint256 newReserve0 = (_tokenA == token0) ? (reserveA + amountA) : (reserveB + amountB);
            uint256 newReserve1 = (_tokenA == token0) ? (reserveB + amountB) : (reserveA + amountA);

            _updateReserves(token0, token1, newReserve0, newReserve1);
            _mintLiquidity(token0, token1, _to, liquidity);

            emit LiquidityAdded(msg.sender, _tokenA, _tokenB, amountA, amountB, liquidity);
        }

        // Create the liquidity lock AFTER successful liquidity addition
        if (_lockDuration > 0) {
            projectTokenPairs[_projectId] = [token0, token1];

            liquidityLocks[token0][token1][_to] = LiquidityLock({
                projectId: _projectId,
                projectOwner: _to,
                unlockTime: block.timestamp + _lockDuration,
                lockedLPAmount: liquidity,
                isActive: true
            });

            emit LiquidityLocked(_projectId, token0, token1, _to, liquidity, block.timestamp + _lockDuration);
        }

        return (amountA, amountB, liquidity);
    }

    /**
     * @dev Allows any user to add liquidity to an existing pool or create a new one.
     * Users provide both tokenA and tokenB. The contract ensures the ratio is maintained.
     * @param _tokenA The address of the first token to add liquidity for.
     * @param _tokenB The address of the second token to add liquidity for.
     * @param _amountADesired The desired amount of tokenA to add.
     * @param _amountBDesired The desired amount of tokenB to add.
     * @param _amountAMin The minimum amount of tokenA to accept for slippage control.
     * @param _amountBMin The minimum amount of tokenB to accept for slippage control.
     * @param _to The address to receive the minted LP tokens.
     * @param _deadline The timestamp by which the transaction must be included.
     * @return amountA The actual amount of tokenA added.
     * @return amountB The actual amount of tokenB added.
     * @return liquidity The amount of LP tokens minted.
     */
    function addLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidity) {
        // Ensure deadline has not passed.
        if (block.timestamp >= _deadline) {
            revert DeadlineExpired();
        }
        // Ensure recipient is not zero.
        if (_to == address(0)) {
            revert InvalidRecipient();
        }

        // Get canonical order for the token pair.
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        // Check if pool already exists.
        if (!poolExists[token0][token1]) {
            // If pool does not exist, create it (first liquidity provision).
            poolExists[token0][token1] = true;
            liquidityPools[token0][token1].tokenA = token0;
            liquidityPools[token0][token1].tokenB = token1;
            // Only add to allPoolPairs if not already present (to avoid duplicates)
            // This logic might need refinement if allPoolPairs is strictly for unique token addresses
            // For now, it adds both token0 and token1, which might lead to duplicates if tokens are part of multiple pairs.
            allPoolPairs.push(token0);
            allPoolPairs.push(token1);
            emit PoolCreated(token0, token1); // Emit event for new pool creation

            // For initial liquidity, amounts must be positive.
            if (_amountADesired == 0 || _amountBDesired == 0) {
                revert InvalidAmount();
            }

            // Initial liquidity sets the ratio.
            amountA = _amountADesired;
            amountB = _amountBDesired;

            // Calculate initial liquidity tokens. For the first deposit, LP tokens = sqrt(amountA * amountB).
            liquidity = _sqrt(amountA * amountB);
            if (liquidity == 0) {
                revert ZeroLiquidity();
            }

            // Transfer initial tokens from sender to the AMM contract.
            _transferTokens(_tokenA, msg.sender, address(this), amountA);
            _transferTokens(_tokenB, msg.sender, address(this), amountB);

            // Determine amounts for token0 and token1 based on canonical order
            uint256 amount0ForUpdate = (_tokenA == token0) ? amountA : amountB;
            uint256 amount1ForUpdate = (_tokenA == token0) ? amountB : amountA;

            // Update reserves and mint LP tokens.
            _updateReserves(token0, token1, amount0ForUpdate, amount1ForUpdate); // Update with initial amounts in canonical order
            _mintLiquidity(token0, token1, _to, liquidity);

            // Emit event for transparency.
            emit LiquidityAdded(msg.sender, _tokenA, _tokenB, amountA, amountB, liquidity);
            return (amountA, amountB, liquidity);

        } else {
            // If pool exists, add liquidity to an existing pool.
            // Get current reserves.
            (uint256 reserveA, uint256 reserveB) = _getReserves(_tokenA, _tokenB);

            // Calculate optimal amounts based on current ratio.
            uint256 amountBOptimal = (reserveB * _amountADesired) / reserveA;
            uint256 amountAOptimal = (reserveA * _amountBDesired) / reserveB;

            if (amountBOptimal <= _amountBDesired) {
                amountA = _amountADesired;
                amountB = amountBOptimal;
            } else {
                amountA = amountAOptimal;
                amountB = _amountBDesired;
            }

            // Check for slippage.
            if (amountA < _amountAMin || amountB < _amountBMin) {
                revert SlippageTooHigh();
            }

            // Calculate liquidity tokens to mint based on proportional share.
            // liquidity = min(amountA * totalLPSupply / reserveA, amountB * totalLPSupply / reserveB)
            uint256 currentTotalLPSupply = exhibitionLPTokens.totalSupply(token0, token1);
            uint256 liquidityA = (amountA * currentTotalLPSupply) / reserveA;
            uint256 liquidityB = (amountB * currentTotalLPSupply) / reserveB;
            liquidity = (liquidityA < liquidityB) ? liquidityA : liquidityB;

            if (liquidity == 0) {
                revert ZeroLiquidity();
            }

            // Transfer tokens from sender to the AMM contract.
            _transferTokens(_tokenA, msg.sender, address(this), amountA);
            _transferTokens(_tokenB, msg.sender, address(this), amountB);

            // Determine the actual new reserves for token0 and token1 based on canonical order
            uint256 newReserve0 = (_tokenA == token0) ? (reserveA + amountA) : (reserveB + amountB);
            uint256 newReserve1 = (_tokenA == token0) ? (reserveB + amountB) : (reserveA + amountA);

            // Update reserves and mint LP tokens.
            _updateReserves(token0, token1, newReserve0, newReserve1);
            _mintLiquidity(token0, token1, _to, liquidity);

            // Emit event for transparency.
            emit LiquidityAdded(msg.sender, _tokenA, _tokenB, amountA, amountB, liquidity);
            return (amountA, amountB, liquidity);
        }
    }

    /**
     * @dev Enhanced removeLiquidity with lock enforcement
     */
    function removeLiquidity(
        address _tokenA,
        address _tokenB,
        uint256 _lpAmount,
        uint256 _amountAMin,
        uint256 _amountBMin,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountA, uint256 amountB) {
        if (block.timestamp >= _deadline) {
            revert DeadlineExpired();
        }
        if (_to == address(0)) {
            revert InvalidRecipient();
        }
        if (_lpAmount == 0) {
            revert ZeroLiquidity();
        }

        // --- NEW: Check liquidity lock before allowing removal ---
        _checkLiquidityLock(_tokenA, _tokenB, msg.sender, _lpAmount);

        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }

        LiquidityPool storage pool = liquidityPools[token0][token1];
        uint256 reserve0 = pool.reserveA;
        uint256 reserve1 = pool.reserveB;
        uint256 currentTotalLPSupply = pool.totalLPSupply;

        if (currentTotalLPSupply == 0 || reserve0 == 0 || reserve1 == 0) {
            revert InsufficientLiquidity();
        }

        _burnLiquidity(token0, token1, msg.sender, _lpAmount);

        amountA = (_lpAmount * ((_tokenA == token0) ? reserve0 : reserve1)) / currentTotalLPSupply;
        amountB = (_lpAmount * ((_tokenB == token0) ? reserve0 : reserve1)) / currentTotalLPSupply;

        if (amountA < _amountAMin || amountB < _amountBMin) {
            revert SlippageTooHigh();
        }

        _transferTokens(_tokenA, address(this), _to, amountA);
        _transferTokens(_tokenB, address(this), _to, amountB);

        uint256 newReserve0;
        uint256 newReserve1;

        if (_tokenA == token0) {
            newReserve0 = reserve0 - amountA;
            newReserve1 = reserve1 - amountB;
        } else {
            newReserve0 = reserve0 - amountB;
            newReserve1 = reserve1 - amountA;
        }

        _updateReserves(token0, token1, newReserve0, newReserve1);

        emit LiquidityRemoved(msg.sender, _tokenA, _tokenB, amountA, amountB);
    }

    // --- Swap Function (unchanged) ---
    function swapTokenForToken(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn,
        uint256 _minAmountOut,
        address _to,
        uint256 _deadline
    ) external nonReentrant returns (uint256 amountOut) {
        if (block.timestamp >= _deadline) {
            revert DeadlineExpired();
        }
        if (_to == address(0)) {
            revert InvalidRecipient();
        }
        if (_tokenIn == address(0) || _tokenOut == address(0) || _tokenIn == _tokenOut) {
            revert InvalidTokenAddress();
        }
        if (_amountIn == 0) {
            revert ZeroAmount();
        }

        _transferTokens(_tokenIn, msg.sender, address(this), _amountIn);

        (address token0, address token1) = _sortTokens(_tokenIn, _tokenOut);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }

        (uint256 reserveIn, uint256 reserveOut) = _getReserves(_tokenIn, _tokenOut);
        amountOut = _getAmountOutInternal(_amountIn, reserveIn, reserveOut);

        if (amountOut < _minAmountOut) {
            revert SlippageTooHigh();
        }

        _transferTokens(_tokenOut, address(this), _to, amountOut);

        uint256 newReserve0;
        uint256 newReserve1;

        if (_tokenIn == token0) {
            newReserve0 = reserveIn + _amountIn;
            newReserve1 = reserveOut - amountOut;
        } else {
            newReserve0 = reserveOut - amountOut;
            newReserve1 = reserveIn + _amountIn;
        }

        _updateReserves(token0, token1, newReserve0, newReserve1);
        emit Swap(msg.sender, _tokenIn, _tokenOut, _amountIn, amountOut);
    }

    // --- View Functions ---
    function getPool(address _tokenA, address _tokenB) public view returns (LiquidityPool memory) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }
        return liquidityPools[token0][token1];
    }

    function getAmountOut(uint256 _amountIn, address _tokenIn, address _tokenOut) public view returns (uint256 amountOut) {
        if (_tokenIn == address(0) || _tokenOut == address(0) || _tokenIn == _tokenOut) {
            revert InvalidTokenAddress();
        }
        if (_amountIn == 0) {
            revert ZeroAmount();
        }

        (address token0, address token1) = _sortTokens(_tokenIn, _tokenOut);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(_tokenIn, _tokenOut);

        amountOut = _getAmountOutInternal(_amountIn, reserveIn, reserveOut);
    }

    function getRemoveLiquidityQuote(address _tokenA, address _tokenB, uint256 _lpAmount) public view returns (uint256 amountA, uint256 amountB) {
        if (_tokenA == address(0) || _tokenB == address(0) || _tokenA == _tokenB) {
            revert InvalidTokenAddress();
        }
        if (_lpAmount == 0) {
            revert ZeroLiquidity();
        }

        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }

        LiquidityPool storage pool = liquidityPools[token0][token1];
        uint256 reserve0 = pool.reserveA;
        uint256 reserve1 = pool.reserveB;
        uint256 currentTotalLPSupply = pool.totalLPSupply;

        if (currentTotalLPSupply == 0 || reserve0 == 0 || reserve1 == 0) {
            revert InsufficientLiquidity();
        }

        amountA = (_lpAmount * reserve0) / currentTotalLPSupply;
        amountB = (_lpAmount * reserve1) / currentTotalLPSupply;

        amountA = (_tokenA == token0) ? amountA : amountB;
        amountB = (_tokenA == token0) ? amountB : amountA;
    }

    function getPoolCumulatives(address _tokenA, address _tokenB)
        public
        view
        returns (uint256 price0Cumulative, uint256 price1Cumulative, uint32 blockTimestamp)
    {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }
        price0Cumulative = price0CumulativeLast[token0][token1];
        price1Cumulative = price1CumulativeLast[token0][token1];
        blockTimestamp = blockTimestampLast[token0][token1];
    }
    
    /**
     * @dev Returns optimal liquidity amounts for adding liquidity
     * @param _tokenA First token address
     * @param _tokenB Second token address  
     * @param _amountADesired Desired amount of tokenA
     * @param _amountBDesired Desired amount of tokenB
     * @return optimalAmountA Optimal amount of tokenA to use
     * @return optimalAmountB Optimal amount of tokenB to use
     */
    function getOptimalLiquidityAmounts(
        address _tokenA,
        address _tokenB,
        uint256 _amountADesired,
        uint256 _amountBDesired
    ) external view returns (uint256 optimalAmountA, uint256 optimalAmountB) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
    
        if (!poolExists[token0][token1]) {
            // New pool - use desired amounts
            return (_amountADesired, _amountBDesired);
        }
    
        (uint256 reserveA, uint256 reserveB) = _getReserves(_tokenA, _tokenB);
    
        uint256 amountBOptimal = (reserveB * _amountADesired) / reserveA;
        if (amountBOptimal <= _amountBDesired) {
            return (_amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = (reserveA * _amountBDesired) / reserveB;
            return (amountAOptimal, _amountBDesired);
        }
    }

    /**
     * @dev Returns user's portfolio with pagination for gas optimization
     * @param _user User address to query
     * @param _offset Starting index for pagination
     * @param _limit Maximum number of positions to return
     * @return tokenAs Array of tokenA addresses
     * @return tokenBs Array of tokenB addresses  
     * @return lpBalances Array of LP token balances
     * @return sharePercentages Array of user's share percentages (basis points)
     * @return totalPositions Total number of positions user has
     * @return hasMore Whether there are more positions beyond this page
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
        require(_limit > 0 && _limit <= 50, "Invalid limit"); // Max 50 per page
    
        // First pass: count total positions
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
    
        // Calculate array size for this page
        uint256 remaining = totalPositions > _offset ? totalPositions - _offset : 0;
        uint256 pageSize = remaining > _limit ? _limit : remaining;
        hasMore = _offset + _limit < totalPositions;
    
        // Initialize arrays for this page
        tokenAs = new address[](pageSize);
        tokenBs = new address[](pageSize);
        lpBalances = new uint256[](pageSize);
        sharePercentages = new uint256[](pageSize);
    
        // Second pass: fill arrays with paginated results
        uint256 positionIndex = 0;
        uint256 resultIndex = 0;
    
        for (uint256 i = 0; i < allPoolPairs.length && resultIndex < pageSize; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
            
                if (balance > 0) {
                    // Check if this position should be included in current page
                    if (positionIndex >= _offset) {
                        tokenAs[resultIndex] = tokenA;
                        tokenBs[resultIndex] = tokenB;
                        lpBalances[resultIndex] = balance;
                    
                        uint256 totalSupply = exhibitionLPTokens.totalSupply(tokenA, tokenB);
                        sharePercentages[resultIndex] = totalSupply > 0 ? (balance * 10000) / totalSupply : 0;
                      
                        resultIndex++;
                    }
                    positionIndex++;
                }
            }
        }
    }

    /**
     * @dev Returns the total number of positions a user has (lightweight)
     * @param _user User address to query
     * @return count Total number of positions
     */
    function getUserPositionCount(address _user) external view returns (uint256 count) {
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
     * @dev Check user balances for specific pools (gas efficient)
     * @param _user User address to query
     * @param _tokenPairs Array of token pairs to check
     * @return balances Array of LP balances for each pair
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
     * @dev Returns multiple pool information with gas optimization
     * @param _tokenPairs Array of token pair arrays (max 20 pairs per call)
     * @return pools Array of LiquidityPool structs
     */
    function getMultiplePoolInfo(address[][] calldata _tokenPairs) 
        external view returns (LiquidityPool[] memory pools) {
        require(_tokenPairs.length <= 20, "Too many pairs requested"); // Gas limit
    
        pools = new LiquidityPool[](_tokenPairs.length);
    
        for (uint256 i = 0; i < _tokenPairs.length; i++) {
            require(_tokenPairs[i].length == 2, "Invalid token pair");
        
            (address token0, address token1) = _sortTokens(_tokenPairs[i][0], _tokenPairs[i][1]);
        
            if (poolExists[token0][token1]) {
                pools[i] = liquidityPools[token0][token1];
            } else {
                // Return empty pool struct for non-existent pools
                pools[i] = LiquidityPool({
                    tokenA: address(0),
                    tokenB: address(0), 
                    reserveA: 0,
                    reserveB: 0,
                    totalLPSupply: 0
                });
            }
        }
    }

    /**
     * @dev Get pools with pagination (for pool discovery)
     * @param _offset Starting index
     * @param _limit Maximum pools to return (max 25)
     * @return tokenAs Array of first tokens
     * @return tokenBs Array of second tokens
     * @return totalPools Total number of pools available
     * @return hasMore Whether more pools exist
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

    /**
     * @dev Get user's position summary (lightweight overview)
     * @param _user User address
     * @return positionCount Total positions
     * @return totalLPValue Approximate total LP value (simplified)
     * @return activePoolCount Number of pools user has positions in
     */
    function getUserPositionSummary(address _user) external view returns (
        uint256 positionCount,
        uint256 totalLPValue,
        uint256 activePoolCount
    ) {
        for (uint256 i = 0; i < allPoolPairs.length; i += 2) {
            if (i + 1 < allPoolPairs.length) {
                address tokenA = allPoolPairs[i];
                address tokenB = allPoolPairs[i + 1];
                uint256 balance = exhibitionLPTokens.balanceOf(tokenA, tokenB, _user);
            
                if (balance > 0) {
                    positionCount++;
                    activePoolCount++;
                
                    // Simplified LP value calculation (you might want to use price oracles)
                    (address token0, address token1) = _sortTokens(tokenA, tokenB);
                    if (poolExists[token0][token1]) {
                        LiquidityPool memory pool = liquidityPools[token0][token1];
                        if (pool.totalLPSupply > 0) {
                            // Approximate value based on reserves
                            uint256 userShare = (balance * 10000) / pool.totalLPSupply;
                            totalLPValue += (pool.reserveA + pool.reserveB) * userShare / 10000;
                        }
                    }
                }
            }
        }
    }

    /**
     * @dev Returns slippage impact for a trade in basis points (1% = 100 bp)
     * @param _tokenIn Input token address
     * @param _tokenOut Output token address
     * @param _amountIn Amount of input tokens
     * @return slippagePercentage Slippage in basis points
     */
    function getSlippageImpact(
        address _tokenIn,
        address _tokenOut,
        uint256 _amountIn
    ) external view returns (uint256 slippagePercentage) {
        if (_amountIn == 0) return 0;
    
        (address token0, address token1) = _sortTokens(_tokenIn, _tokenOut);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }
    
        (uint256 reserveIn, uint256 reserveOut) = _getReserves(_tokenIn, _tokenOut);
    
        if (reserveIn == 0 || reserveOut == 0) return 0;
    
        // Current price (how many tokenOut per tokenIn)
        uint256 currentPrice = (reserveOut * 1e18) / reserveIn;
    
        // Price after trade
        uint256 amountOut = _getAmountOutInternal(_amountIn, reserveIn, reserveOut);
    
        if (amountOut == 0) return 0;
    
        uint256 effectivePrice = (_amountIn * 1e18) / amountOut;
    
        // Calculate slippage percentage in basis points
        if (effectivePrice > currentPrice) {
            slippagePercentage = ((effectivePrice - currentPrice) * 10000) / currentPrice;
        }
    }

    /**
     * @dev Returns comprehensive pool statistics
     * @param _tokenA First token address
     * @param _tokenB Second token address
     * @return volume24h Trading volume in last 24h (requires event tracking)
     * @return tvl Total Value Locked in USD equivalent
     * @return utilization Pool utilization percentage
     */
    function getPoolStatistics(address _tokenA, address _tokenB) 
        external view returns (
            uint256 volume24h,
            uint256 tvl,
            uint256 utilization
        ) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }
    
        LiquidityPool storage pool = liquidityPools[token0][token1];
    
        // TVL calculation (simplified - you might want to use price oracles)
        tvl = pool.reserveA + pool.reserveB; // This is simplified
    
        // Volume would require tracking swap events (placeholder for now)
        volume24h = 0; // Implement based on your needs
    
        // Utilization (placeholder calculation)
        utilization = pool.totalLPSupply > 0 ? 
        ((pool.reserveA * pool.reserveB) * 10000) / (pool.totalLPSupply * pool.totalLPSupply) : 0;
    }
     
    /**
     * @dev Returns token decimals for proper display formatting
     */
    function getTokenDecimals(address _token) external view returns (uint8) {
        try IERC20Metadata(_token).decimals() returns (uint8 decimals) {
            return decimals;
        } catch {
            return 18; // Default to 18 decimals
        }
    }

    /**
     * @dev Returns token symbol for display
     */
    function getTokenSymbol(address _token) external view returns (string memory) {
        try IERC20Metadata(_token).symbol() returns (string memory symbol) {
            return symbol;
        } catch {
            return "UNKNOWN";
        }
    }

    /**
     * @dev Batch function to get multiple token info
     */
    function getTokensInfo(address[] calldata _tokens) external view returns (
        string[] memory symbols,
        uint8[] memory decimals,
        uint256[] memory totalSupplies
    ) {
        uint256 length = _tokens.length;
        symbols = new string[](length);
        decimals = new uint8[](length);
        totalSupplies = new uint256[](length);
    
        for (uint256 i = 0; i < length; i++) {
            symbols[i] = this.getTokenSymbol(_tokens[i]);
            decimals[i] = this.getTokenDecimals(_tokens[i]);
            totalSupplies[i] = IERC20(_tokens[i]).totalSupply();
        }
    }

    // --- Additional Utility Functions ---

    /**
     * @dev Returns all pool pairs (for frontend enumeration)
     */
    function getAllPoolPairs() external view returns (address[] memory) {
        return allPoolPairs;
    }

    /**
     * @dev Returns the total number of pools
     */
    function getPoolCount() external view returns (uint256) {
        return allPoolPairs.length / 2; // Each pool adds 2 addresses to allPoolPairs
    }

    /**
     * @dev Checks if a pool exists for a given token pair
     */
    function doesPoolExist(address _tokenA, address _tokenB) external view returns (bool) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return poolExists[token0][token1];
    }

    /**
     * @dev Returns the current reserves for a token pair
     */
    function getReserves(address _tokenA, address _tokenB) external view returns (uint256 reserveA, uint256 reserveB, uint32 blockTimestampLast_) {
        (reserveA, reserveB) = _getReserves(_tokenA, _tokenB);
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        blockTimestampLast_ = blockTimestampLast[token0][token1];
    }

    /**
     * @dev Returns the LP token balance for a user in a specific pool
     */
    function getLPBalance(address _tokenA, address _tokenB, address _user) external view returns (uint256) {
        return exhibitionLPTokens.balanceOf(_tokenA, _tokenB, _user);
    }

    /**
     * @dev Returns the total LP supply for a specific pool
     */
    function getTotalLPSupply(address _tokenA, address _tokenB) external view returns (uint256) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return exhibitionLPTokens.totalSupply(token0, token1);
    }

    // --- Price Calculation Functions ---

    /**
     * @dev Returns the current price of tokenA in terms of tokenB
     */
    function getPrice(address _tokenA, address _tokenB) external view returns (uint256 price) {
        (uint256 reserveA, uint256 reserveB) = _getReserves(_tokenA, _tokenB);
        if (reserveA == 0) revert InsufficientLiquidity();
        
        // Price of tokenA in terms of tokenB (reserveB / reserveA)
        // Multiply by 1e18 for precision
        price = (reserveB * 1e18) / reserveA;
    }

    /**
     * @dev Returns the TWAP price over a specified time period
     * @param _tokenA First token in the pair
     * @param _tokenB Second token in the pair
     * @param _period Time period in seconds for TWAP calculation
     * @return twapPrice The TWAP price of tokenA in terms of tokenB
     */
    function getTWAP(address _tokenA, address _tokenB, uint32 _period) external view returns (uint256 twapPrice) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        if (!poolExists[token0][token1]) {
            revert PoolDoesNotExist();
        }

        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast[token0][token1];
        
        require(timeElapsed >= _period, "Insufficient time elapsed");

        uint256 price0Cumulative = price0CumulativeLast[token0][token1];
        uint256 price1Cumulative = price1CumulativeLast[token0][token1];

        if (_tokenA == token0) {
            // Price of token0 in terms of token1
            twapPrice = price0Cumulative / _period;
        } else {
            // Price of token1 in terms of token0
            twapPrice = price1Cumulative / _period;
        }
    }

    // --- Emergency Functions ---

    /**
     * @dev Emergency function to pause/unpause the contract (if needed)
     * This is a placeholder for potential pause functionality
     */
    function emergencyPause() external onlyOwner {
        // Implementation would depend on whether you want to add pausable functionality
        // For now, this is a placeholder
    }

    /**
     * @dev Function to update exhibition contract address (additional security)
     */
    function updateExhibitionContract(address _newExhibitionContract) external onlyOwner {
        if (_newExhibitionContract == address(0)) revert ZeroAddress();
        
        address oldAddress = exhibitionContract;
        exhibitionContract = _newExhibitionContract;
        emit ExhibitionContractSet(oldAddress, _newExhibitionContract);
    }
}