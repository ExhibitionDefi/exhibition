// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ExhibitionUSD
 * @dev A mock ERC20 token contract to represent exUSD on the Nexus testnet.
 * It's a standard ERC20 with a fixed name, symbol, decimals, and an initial supply
 * minted to the deployer. It is Ownable, allowing the owner to manage the minter role.
 */
contract ExhibitionUSD is ERC20, Ownable {
    // Custom error for when a non-minter attempts to mint.
    error NotMinter();

    // The address authorized to call the mint function.
    address public minter;

    // Event emitted when the minter address is changed.
    event MinterChanged(address indexed previousMinter, address indexed newMinter);

    // Define the number of decimals for this token. USDT typically uses 6 decimals.
    uint8 private constant _DECIMALS = 6;

    /**
     * @dev Constructor to initialize the token.
     * Sets the token's name, symbol, and mints an initial supply to the deployer (initialOwner).
     * The initial supply is set to 1,000,000 tokens, considering 6 decimals.
     * @param initialOwner The address that will own the contract and receive the initial supply.
     * This is typically the deployer's address.
     */
    constructor(address initialOwner)
        ERC20("Exhibition USD", "exUSD")
        Ownable(initialOwner)
    {
        // Mint 1,000,000 exUSD tokens to the deployer for testing.
        // 1,000,000 * (10 ** 6) = 1,000,000,000,000
        _mint(initialOwner, 1_000_000 * (10**_DECIMALS));

        // Initially set the deployer as the minter. The owner can then change this.
        minter = initialOwner;
        emit MinterChanged(address(0), initialOwner);
    }

    /**
     * @dev Returns the number of decimals used to get its user representation.
     * For exUSD, this is 6.
     */
    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    /**
     * @dev Modifier to restrict access to functions to only the designated minter.
     */
    modifier onlyMinter() {
        if (msg.sender != minter) {
            revert NotMinter();
        }
        _;
    }

    /**
     * @dev Sets the address that is authorized to call the mint function.
     * Only the contract owner can call this function.
     * @param _newMinter The address to set as the new minter.
     */
    function setMinter(address _newMinter) public onlyOwner {
        require(_newMinter != address(0), "Minter: new minter is the zero address");
        emit MinterChanged(minter, _newMinter);
        minter = _newMinter;
    }

    /**
     * @dev Mints new tokens and assigns them to an account.
     * Only the designated minter can call this function.
     * This is useful for simulating stablecoin issuance on a testnet.
     * @param to The address of the recipient of the new tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) public onlyMinter {
        require(to != address(0), "ERC20: mint to the zero address");
        require(amount > 0, "ERC20: mint amount must be greater than zero");
        _mint(to, amount);
    }

    /**
     * @dev Burns tokens from a specific account.
     * Only the contract owner can call this function.
     * This is useful for simulating stablecoin redemption/burning on a testnet.
     * @param from The address of the account whose tokens are to be burned.
     * @param amount The amount of tokens to burn.
     */
    function burnFromOwner(address from, uint256 amount) public onlyOwner {
        require(amount > 0, "ERC20: burn amount must be greater than zero");
        _burn(from, amount);
    }
}
