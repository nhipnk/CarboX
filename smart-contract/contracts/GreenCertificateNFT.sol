// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Pausable.sol"; // Đã cập nhật đường dẫn chuẩn của OpenZeppelin v5

/// @title GreenCertificateNFT
/// @notice Improved soulbound NFT certificate with revocation capability.
contract GreenCertificateNFT is ERC721, Ownable, Pausable {
    address public marketplace;

    uint256 private _nextTokenId;

    struct CertificateInfo {
        uint256 projectId;
        uint256 retiredTokenAmount;
        uint256 retiredCO2Kg;
        address buyer;
        uint256 retiredAt;
        string certificateURI;
        bool revoked;
    }

    mapping(uint256 => CertificateInfo) public certificates;
    mapping(uint256 => bool) public revokedCertificates;

    event MarketplaceUpdated(address indexed oldMarketplace, address indexed newMarketplace);
    event CertificateMinted(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 indexed projectId,
        uint256 retiredTokenAmount,
        uint256 retiredCO2Kg,
        string certificateURI
    );
    event CertificateRevoked(uint256 indexed tokenId, string reason);
    event CertificateURIUpdated(uint256 indexed tokenId, string newURI);

    modifier onlyMarketplace() {
        require(msg.sender == marketplace, "GreenCertificateNFT: caller is not marketplace");
        _;
    }

    /// @notice Constructor khởi tạo NFT, marketplace sẽ được set sau để tránh Circular Dependency
    constructor() ERC721("CarboX Green Certificate", "CGC") Ownable(msg.sender) {}

    /// @notice Sets the marketplace contract
    function setMarketplace(address _marketplace) external onlyOwner {
        require(_marketplace != address(0), "GreenCertificateNFT: marketplace is zero address");

        address oldMarketplace = marketplace;
        marketplace = _marketplace;

        emit MarketplaceUpdated(oldMarketplace, _marketplace);
    }

    /// @notice Pauses all transfers
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses transfers
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Mints a non-transferable certificate
    function mintCertificate(
        address to,
        uint256 projectId,
        uint256 retiredTokenAmount,
        uint256 retiredCO2Kg,
        string memory certificateURI
    ) external onlyMarketplace whenNotPaused returns (uint256) {
        require(to != address(0), "GreenCertificateNFT: mint to zero address");
        require(retiredTokenAmount > 0, "GreenCertificateNFT: amount is zero");
        require(retiredCO2Kg > 0, "GreenCertificateNFT: CO2 is zero");
        require(bytes(certificateURI).length > 0, "GreenCertificateNFT: empty URI");

        _nextTokenId++;
        uint256 tokenId = _nextTokenId;

        certificates[tokenId] = CertificateInfo({
            projectId: projectId,
            retiredTokenAmount: retiredTokenAmount,
            retiredCO2Kg: retiredCO2Kg,
            buyer: to,
            retiredAt: block.timestamp,
            certificateURI: certificateURI,
            revoked: false
        });

        _safeMint(to, tokenId);

        emit CertificateMinted(tokenId, to, projectId, retiredTokenAmount, retiredCO2Kg, certificateURI);

        return tokenId;
    }

    /// @notice Revokes a fraudulent certificate
    function revokeCertificate(uint256 tokenId, string memory reason) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "GreenCertificateNFT: token does not exist");
        require(!revokedCertificates[tokenId], "GreenCertificateNFT: already revoked");

        revokedCertificates[tokenId] = true;
        certificates[tokenId].revoked = true;

        // Burn the certificate
        _burn(tokenId);

        emit CertificateRevoked(tokenId, reason);
    }

    /// @notice Updates certificate URI
    function updateCertificateURI(uint256 tokenId, string memory newURI) external onlyOwner {
        require(_ownerOf(tokenId) != address(0), "GreenCertificateNFT: token does not exist");
        require(bytes(newURI).length > 0, "GreenCertificateNFT: empty URI");
        require(!revokedCertificates[tokenId], "GreenCertificateNFT: token is revoked");

        certificates[tokenId].certificateURI = newURI;

        emit CertificateURIUpdated(tokenId, newURI);
    }

    /// @notice Returns certificate metadata
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "GreenCertificateNFT: token does not exist");
        require(!revokedCertificates[tokenId], "GreenCertificateNFT: token is revoked");

        return certificates[tokenId].certificateURI;
    }

    /// @notice Checks if a certificate is revoked
    function isRevoked(uint256 tokenId) external view returns (bool) {
        return revokedCertificates[tokenId];
    }

    /// @notice Blocks all transfers (makes certificates soulbound)
    function _update(address to, uint256 tokenId, address auth) internal override whenNotPaused returns (address) {
        address from = _ownerOf(tokenId);

        // Only allow minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert("GreenCertificateNFT: certificate is non-transferable");
        }

        return super._update(to, tokenId, auth);
    }
}