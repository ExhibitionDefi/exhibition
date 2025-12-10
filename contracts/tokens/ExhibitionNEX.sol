// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title ExhibitionNEX
 * @dev An ERC-20 wrapped version of the native NEX token on Nexus Layer 1.
 * This contract allows users to deposit native NEX (using msg.value) to receive
 * an equivalent amount of exNEX (ERC-20), and to burn exNEX to withdraw
 * native NEX.
 *
 * All interactions with native NEX are handled via msg.value for deposits
 * and direct native transfers for withdrawals.
 */
contract ExhibitionNEX is ERC20 {

    // Constructor initializes the ERC20 token with its name and symbol.
    // The symbol 'exNEX' clearly indicates its purpose within your ecosystem.
    constructor() ERC20("Exhibition NEX", "exNEX") {
        // No initial supply is minted in the constructor for a wrapped native token.
        // Supply is minted dynamically as native NEX is deposited.
    }

    event Deposit(address indexed user, uint256 amountNEX, uint256 amountExNEX);
    event Withdrawal(address indexed user, uint256 amountExNEX, uint256 amountNEX);

    /**
     * @dev Allows a user to deposit native NEX and receive an equivalent amount of exNEX.
     * The deposited native NEX is held by this contract.
     * This function must be called with native NEX attached (msg.value).
     * @custom:native-token-interaction Deposits native NEX.
     */
    function deposit() public payable {
        // Ensure that some native NEX was sent with the transaction.
        require(msg.value > 0, "ExhibitionNEX: Deposit amount must be greater than zero");

        // Mint an equivalent amount of exNEX tokens to the sender.
        _mint(msg.sender, msg.value);

        // Optional: Emit an event for logging deposits.
        // event Deposit(address indexed user, uint256 amountNEX, uint256 amountExNEX);
        emit Deposit(msg.sender, msg.value, msg.value); // Assuming 1:1 ratio
    }

    /**
     * @dev Allows a user to burn their exNEX tokens to withdraw native NEX.
     * The native NEX is sent from this contract's balance directly to the user.
     * @param amount The amount of exNEX to burn and native NEX to withdraw.
     * @custom:native-token-interaction Withdraws native NEX.
     */
    function withdraw(uint256 amount) public {
        // Ensure the amount to withdraw is greater than zero.
        require(amount > 0, "ExhibitionNEX: Withdraw amount must be greater than zero");

        // Ensure the contract has enough native NEX to send.
        require(address(this).balance >= amount, "ExhibitionNEX: Insufficient native NEX balance in contract");

        // Burn the specified amount of exNEX tokens from the sender's balance.
        _burn(msg.sender, amount);

        // Transfer the corresponding native NEX directly to the user.
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "ExhibitionNEX: Failed to withdraw native NEX");

        // Optional: Emit an event for logging withdrawals.
        // event Withdrawal(address indexed user, uint256 amountExNEX, uint256 amountNEX);
        emit Withdrawal(msg.sender, amount, amount); // Assuming 1:1 ratio
    }

    // This is a standard fallback function for receiving native NEX.
    // It calls the deposit function, allowing users to simply send native NEX
    // to the contract address to wrap it.
    receive() external payable {
        deposit();
    }
}