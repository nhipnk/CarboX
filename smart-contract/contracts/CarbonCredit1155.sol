// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CarbonCredit1155
/// @notice ERC1155 carbon credits for the CarboX marketplace MVP with improved security.
contract CarbonCredit1155 is ERC1155, Ownable, Pausable {
    address public marketplace;

    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) public projectBlacklist;

    event MarketplaceUpdated(address indexed oldMarketplace, address indexed newMarketplace);
    event CreditMinted(address indexed to, uint256 indexed projectId, uint256 amount, string tokenURI);
    event CreditBurned(address indexed from, uint256 indexed projectId, uint256 amount);
    event TokenURIUpdated(uint256 indexed projectId, string tokenURI);
    event ProjectBlacklisted(uint256 indexed projectId, string reason);
    event ProjectUnblacklisted(uint256 indexed projectId);

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "CarbonCredit1155: caller is not marketplace");
        _;
    }

    constructor() ERC1155("") Ownable(msg.sender) {}

    function setMarketplace(address _marketplace) external onlyOwner {
        require(_marketplace != address(0), "CarbonCredit1155: marketplace is zero address");
        address oldMarketplace = marketplace;
        marketplace = _marketplace;
        emit MarketplaceUpdated(oldMarketplace, _marketplace);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function blacklistProject(uint256 projectId, string memory reason) external onlyOwner {
        projectBlacklist[projectId] = true;
        emit ProjectBlacklisted(projectId, reason);
    }

    function unblacklistProject(uint256 projectId) external onlyOwner {
        projectBlacklist[projectId] = false;
        emit ProjectUnblacklisted(projectId);
    }

    function _validateURI(string memory tokenURI) internal pure {
        bytes memory uriBytes = bytes(tokenURI);
        require(uriBytes.length >= 7, "CarbonCredit1155: empty or invalid URI");
        require(
            uriBytes[0] == 'i' && uriBytes[1] == 'p' && uriBytes[2] == 'f' && uriBytes[3] == 's' && uriBytes[4] == ':' && uriBytes[5] == '/' && uriBytes[6] == '/',
            "CarbonCredit1155: must be valid IPFS URI (ipfs://...)"
        );
    }

    function mintCredit(
        address to,
        uint256 projectId,
        uint256 amount,
        string memory tokenURI
    ) external onlyMarketplace whenNotPaused {
        require(to != address(0), "CarbonCredit1155: mint to zero address");
        require(amount > 0, "CarbonCredit1155: amount is zero");
        require(!projectBlacklist[projectId], "CarbonCredit1155: project is blacklisted");
        
        _validateURI(tokenURI);
        _setTokenURI(projectId, tokenURI);
        _mint(to, projectId, amount, "");

        emit CreditMinted(to, projectId, amount, tokenURI);
    }

    function burnCredit(address from, uint256 projectId, uint256 amount) external onlyMarketplace whenNotPaused {
        require(from != address(0), "CarbonCredit1155: burn from zero address");
        require(amount > 0, "CarbonCredit1155: amount is zero");
        
        _burn(from, projectId, amount);

        emit CreditBurned(from, projectId, amount);
    }

    function setTokenURI(uint256 projectId, string memory tokenURI) external onlyOwner {
        _validateURI(tokenURI);
        _setTokenURI(projectId, tokenURI);
    }

    function uri(uint256 projectId) public view override returns (string memory) {
        return _tokenURIs[projectId];
    }

    function _setTokenURI(uint256 projectId, string memory tokenURI) internal {
        _tokenURIs[projectId] = tokenURI;
        emit TokenURIUpdated(projectId, tokenURI);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override whenNotPaused {
        super._update(from, to, ids, values);
    }
}