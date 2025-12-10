// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ExhibitionLPTokens
 * @dev A specialized contract to manage liquidity provider shares for all pools
 * within the Exhibition AMM.
 * This contract DOES NOT inherit ERC20, as it manages multiple virtual ERC20-like
 * LP tokens (one for each pair) rather than being a single ERC20 token itself.
 * Minting and burning of these tokens are strictly restricted to the ExhibitionAMM contract.
 * It provides pair-specific `balanceOf`, `totalSupply`, `transfer`, `approve`, and `transferFrom`
 * functions, mimicking ERC20 behavior for each LP token pair.
 * The ExhibitionAMM address is now mutable, allowing the owner to update it.
 */
contract ExhibitionLPTokens is Ownable {
    // --- Custom Errors ---
    error ZeroAddress();
    error SameTokenAddress();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAmount();
    error TransferToZeroAddress();
    error ApproveToZeroAddress();
    error OnlyExhibitionAMM();

    // --- State Variables ---

    // The address of the ExhibitionAMM contract. This is the only entity
    // authorized to call the `mint` and `burn` functions for LP tokens.
    // This address is now MUTABLE, allowing the owner to change it.
    address public EXHIBITION_AMM_ADDRESS;

    // Mapping to track the total supply of LP tokens for each specific (tokenA, tokenB) pair.
    mapping(address => mapping(address => uint256)) private _lpTokenSupply;

    // Mapping to track individual user balances of LP tokens for each specific (tokenA, tokenB) pair.
    mapping(address => mapping(address => mapping(address => uint256))) private _balances;

    // Mapping for ERC20-like allowances specific to each (tokenA, tokenB) LP pair.
    mapping(address => mapping(address => mapping(address => mapping(address => uint256)))) private _allowances;

    // --- Events (Manually defined as ERC20 is not inherited) ---
    event Transfer(address indexed from, address indexed to, uint256 amount, address indexed tokenA, address tokenB);
    event Approval(address indexed owner, address indexed spender, uint256 amount, address indexed tokenA, address tokenB);
    event AmmAddressChanged(address indexed oldAmmAddress, address indexed newAmmAddress);

    /**
     * @dev Constructor for ExhibitionLPTokens.
     * The deployer of this contract becomes its administrative owner (via Ownable).
     */
    constructor() Ownable(msg.sender) {}

    // --- Modifiers ---

    /**
     * @dev Throws if called by any address other than EXHIBITION_AMM_ADDRESS.
     * This ensures that only the ExhibitionAMM contract can control LP token supply.
     */
    modifier onlyExhibitionAMM() {
        if (msg.sender != EXHIBITION_AMM_ADDRESS) {
            revert OnlyExhibitionAMM();
        }
        _;
    }

    // --- Owner-Controlled Setter ---

    /**
     * @dev Allows the owner to change the address of the ExhibitionAMM contract.
     * This is useful for upgrading the AMM without redeploying LP tokens.
     * @param _newAmmAddress The address of the new ExhibitionAMM contract.
     */
    function setExhibitionAmmAddress(address _newAmmAddress) external onlyOwner {
        if (_newAmmAddress == address(0)) revert ZeroAddress();
        
        address oldAddress = EXHIBITION_AMM_ADDRESS;
        EXHIBITION_AMM_ADDRESS = _newAmmAddress;
        emit AmmAddressChanged(oldAddress, _newAmmAddress);
    }

    // --- Internal Helper Functions ---
    
    /**
     * @dev Sorts two token addresses to ensure consistent ordering in mappings.
     * @param _tokenA First token address
     * @param _tokenB Second token address
     * @return token0 The smaller address
     * @return token1 The larger address
     */
    function _sortTokens(address _tokenA, address _tokenB) internal pure returns (address token0, address token1) {
        if (_tokenA == address(0) || _tokenB == address(0)) {
            revert ZeroAddress();
        }
        if (_tokenA == _tokenB) {
            revert SameTokenAddress();
        }

        if (_tokenA < _tokenB) {
            token0 = _tokenA;
            token1 = _tokenB;
        } else {
            token0 = _tokenB;
            token1 = _tokenA;
        }
    }

    // --- Core Functions (Controlled by ExhibitionAMM) ---
    
    /**
     * @dev Mints LP tokens for a specific pair to a given address.
     * @param _tokenA First token of the pair
     * @param _tokenB Second token of the pair
     * @param to Address to mint tokens to
     * @param amount Amount of LP tokens to mint
     */
    function mint(address _tokenA, address _tokenB, address to, uint256 amount) external onlyExhibitionAMM {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        // Check for overflow before addition (extra safety)
        unchecked {
            if (_lpTokenSupply[token0][token1] + amount < _lpTokenSupply[token0][token1]) {
                revert("ExhibitionLPTokens: Supply overflow");
            }
            if (_balances[token0][token1][to] + amount < _balances[token0][token1][to]) {
                revert("ExhibitionLPTokens: Balance overflow");
            }
        }

        _lpTokenSupply[token0][token1] += amount;
        _balances[token0][token1][to] += amount;
        emit Transfer(address(0), to, amount, token0, token1);
    }

    /**
     * @dev Burns LP tokens for a specific pair from a given address.
     * @param _tokenA First token of the pair
     * @param _tokenB Second token of the pair
     * @param from Address to burn tokens from
     * @param amount Amount of LP tokens to burn
     */
    function burn(address _tokenA, address _tokenB, address from, uint256 amount) external onlyExhibitionAMM {
        if (amount == 0) revert ZeroAmount();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        if (_balances[token0][token1][from] < amount) {
            revert InsufficientBalance();
        }
        
        _lpTokenSupply[token0][token1] -= amount;
        _balances[token0][token1][from] -= amount;
        emit Transfer(from, address(0), amount, token0, token1);
    }

    // --- ERC-20 Standard Functions (Adapted for Pair-Specific Logic) ---
    
    /**
     * @dev Returns the LP token balance for a specific pair and account.
     */
    function balanceOf(address _tokenA, address _tokenB, address account) external view returns (uint256) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return _balances[token0][token1][account];
    }

    /**
     * @dev Returns the total supply of LP tokens for a specific pair.
     */
    function totalSupply(address _tokenA, address _tokenB) external view returns (uint256) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return _lpTokenSupply[token0][token1];
    }

    /**
     * @dev Transfers LP tokens for a specific pair from sender to another address.
     */
    function transfer(address _tokenA, address _tokenB, address to, uint256 amount) external returns (bool) {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert TransferToZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        if (_balances[token0][token1][msg.sender] < amount) {
            revert InsufficientBalance();
        }

        _balances[token0][token1][msg.sender] -= amount;
        _balances[token0][token1][to] += amount;
        emit Transfer(msg.sender, to, amount, token0, token1);
        return true;
    }

    /**
     * @dev Sets allowance for a spender to transfer LP tokens for a specific pair.
     */
    function approve(address _tokenA, address _tokenB, address spender, uint256 amount) external returns (bool) {
        if (spender == address(0)) revert ApproveToZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        _allowances[token0][token1][msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount, token0, token1);
        return true;
    }

    /**
     * @dev Returns the allowance for a spender to transfer LP tokens for a specific pair.
     */
    function allowance(address _tokenA, address _tokenB, address owner, address spender) external view returns (uint256) {
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        return _allowances[token0][token1][owner][spender];
    }

    /**
     * @dev Transfers LP tokens for a specific pair from one address to another using allowance.
     */
    function transferFrom(address _tokenA, address _tokenB, address from, address to, uint256 amount) external returns (bool) {
        if (amount == 0) revert ZeroAmount();
        if (to == address(0)) revert TransferToZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);

        if (_balances[token0][token1][from] < amount) {
            revert InsufficientBalance();
        }
        if (_allowances[token0][token1][from][msg.sender] < amount) {
            revert InsufficientAllowance();
        }

        _balances[token0][token1][from] -= amount;
        _balances[token0][token1][to] += amount;
        _allowances[token0][token1][from][msg.sender] -= amount;

        emit Transfer(from, to, amount, token0, token1);
        return true;
    }

    // --- Additional Helper Functions ---
    
    /**
     * @dev Increases the allowance granted to a spender for a specific pair.
     * @param _tokenA First token of the pair
     * @param _tokenB Second token of the pair
     * @param spender Address to increase allowance for
     * @param addedValue Amount to increase allowance by
     * @return success True if the operation succeeded
     */
    function increaseAllowance(address _tokenA, address _tokenB, address spender, uint256 addedValue) external returns (bool) {
        if (spender == address(0)) revert ApproveToZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        uint256 currentAllowance = _allowances[token0][token1][msg.sender][spender];
        uint256 newAllowance = currentAllowance + addedValue;
        
        // Check for overflow
        if (newAllowance < currentAllowance) {
            revert("ExhibitionLPTokens: Allowance overflow");
        }
        
        _allowances[token0][token1][msg.sender][spender] = newAllowance;
        emit Approval(msg.sender, spender, newAllowance, token0, token1);
        return true;
    }

    /**
     * @dev Decreases the allowance granted to a spender for a specific pair.
     * @param _tokenA First token of the pair
     * @param _tokenB Second token of the pair
     * @param spender Address to decrease allowance for
     * @param subtractedValue Amount to decrease allowance by
     * @return success True if the operation succeeded
     */
    function decreaseAllowance(address _tokenA, address _tokenB, address spender, uint256 subtractedValue) external returns (bool) {
        if (spender == address(0)) revert ApproveToZeroAddress();
        
        (address token0, address token1) = _sortTokens(_tokenA, _tokenB);
        
        uint256 currentAllowance = _allowances[token0][token1][msg.sender][spender];
        if (currentAllowance < subtractedValue) {
            revert InsufficientAllowance();
        }
        
        uint256 newAllowance = currentAllowance - subtractedValue;
        _allowances[token0][token1][msg.sender][spender] = newAllowance;
        emit Approval(msg.sender, spender, newAllowance, token0, token1);
        return true;
    }
}