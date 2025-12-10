// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ExhibitionBase.sol";

abstract contract ExhibitionConfig is ExhibitionBase {
    using SafeERC20 for IERC20;
    
    function setExhibitionFactoryAddress(address _exhibitionFactoryAddress) external onlyOwner {
        if (_exhibitionFactoryAddress == address(0)) revert ZeroAddress();
        address oldFactoryAddress = exhibitionFactory;
        exhibitionFactory = _exhibitionFactoryAddress;
        emit ExhibitionFactoryAddressSet(oldFactoryAddress, _exhibitionFactoryAddress);
    }

    function setExhibitionAMMAddress(address _exhibitionAMMAddress) external onlyOwner {
        if (_exhibitionAMMAddress == address(0)) revert ZeroAddress();
        address oldAMMAddress = exhibitionAMM;
        exhibitionAMM = _exhibitionAMMAddress;
        emit ExhibitionAMMAddressSet(oldAMMAddress, _exhibitionAMMAddress);
    }

    function setExhTokenAddress(address _exhTokenAddress) external onlyOwner {
        if (_exhTokenAddress == address(0)) revert ZeroAddress();
        exhTokenAddress = _exhTokenAddress;
        emit ExhTokenAddressSet(_exhTokenAddress);
    }

    function setExUSDTokenAddress(address _exUSDTokenAddress) external onlyOwner {
        if (_exUSDTokenAddress == address(0)) revert ZeroAddress();
        exUSDTokenAddress = _exUSDTokenAddress;
        emit ExhibitionUSDAddressSet(_exUSDTokenAddress);
    }

    function getExNEXAddress() external view returns (address) {
        if (exhibitionAMM == address(0)) revert AMMNotSet();
        return IExhibitionAMM(exhibitionAMM).exNEXADDRESS();
    }

    function setPlatformFeePercentage(uint256 _newPercentage) public onlyOwner {
        if (_newPercentage > 10000) revert InvalidPercentage();
        emit PlatformFeePercentageUpdated(platformFeePercentage, _newPercentage);
        platformFeePercentage = _newPercentage;
    }

    function setPlatformFeeRecipient(address _newRecipient) public onlyOwner {
        if (ExLibrary.isZeroAddress(_newRecipient)) revert InvalidInput();
        emit PlatformFeeRecipientUpdated(platformFeeRecipient, _newRecipient);
        platformFeeRecipient = _newRecipient;
    }

    function addExhibitionContributionToken(address _tokenAddress) public onlyOwner {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (isExhibitionContributionToken[_tokenAddress]) revert TokenAlreadyApproved();
        ExhibitionContributionTokens.push(_tokenAddress);
        isExhibitionContributionToken[_tokenAddress] = true;
        emit ExhibitionContributionTokenAdded(_tokenAddress);
    }

    function removeExhibitionContributionToken(address _tokenAddress) public onlyOwner {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (!isExhibitionContributionToken[_tokenAddress]) revert TokenNotApproved();
        isExhibitionContributionToken[_tokenAddress] = false;
        uint256 length = ExhibitionContributionTokens.length;
        for (uint256 i = 0; i < length; i++) {
            if (ExhibitionContributionTokens[i] == _tokenAddress) {
                ExhibitionContributionTokens[i] = ExhibitionContributionTokens[length - 1];
                ExhibitionContributionTokens.pop();
                break;
            }
        }
        emit ExhibitionContributionTokenRemoved(_tokenAddress);
    }

    function approveAmmForContributionTokens() public onlyOwner {
        for (uint256 i = 0; i < ExhibitionContributionTokens.length; i++) {
            address tokenAddress = ExhibitionContributionTokens[i];
            IERC20(tokenAddress).forceApprove(address(exhibitionAMM), type(uint256).max);
            emit AmmApprovedForToken(tokenAddress, address(exhibitionAMM), type(uint256).max);
        }
    }

    function setFaucetAmountEXH(uint256 _amount) public onlyOwner {
        faucetAmountEXH = _amount;
    }

    function setFaucetAmountexUSD(uint256 _amount) public onlyOwner {
        faucetAmountexUSD = _amount;
    }

    function setFaucetCooldown(uint256 _seconds) public onlyOwner {
        faucetCooldownSeconds = _seconds;
    }
}