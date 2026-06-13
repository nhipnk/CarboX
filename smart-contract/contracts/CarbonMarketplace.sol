// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

import "./CarbonCredit1155.sol";
import "./GreenCertificateNFT.sol";

/// @title CarbonMarketplace
/// @notice Marketplace an toàn, tối ưu Gas và có cơ chế kinh tế cho Validator.
contract CarbonMarketplace is Ownable, ReentrancyGuard, ERC1155Holder, Pausable {
    uint256 public constant KG_CO2_PER_TOKEN = 10;

    uint256 public minPrice = 0.001 ether;
    uint256 public maxPrice = 1000 ether;

    uint256 public platformFeeBps = 200; // 2% phí giao dịch
    uint256 public treasuryBalance;      // Quỹ chung để trả thưởng cho Validator/Admin

    CarbonCredit1155 public carbonCredit;
    GreenCertificateNFT public certificateNFT;

    uint256 public nextProjectId;
    uint256 public nextListingId;

    struct Project {
        uint256 projectId;
        address owner;
        string projectURI;
        uint256 proposedCO2Kg;
        uint256 approvedCO2Kg;
        bool approved;
        bool blacklisted;
        uint256 createdAt;
        bool exists;
    }

    struct Listing {
        uint256 listingId;
        uint256 projectId;
        address seller;
        uint256 amount;
        uint256 pricePerUnit;
        bool active;
        uint256 createdAt;
    }

    struct Dispute {
        uint256 listingId;
        address initiator;
        string reason;
        uint256 votes;
        bool active;
    }

    address[] public validators;
    mapping(address => bool) public isValidator;
    mapping(address => bool) public blacklistedOwners;

    mapping(uint256 => Project) public projects;
    mapping(uint256 => Listing) public listings;
    mapping(address => uint256) public sellerBalances;

    // FIX: track ai đã mua từ listing nào để giới hạn openDispute
    mapping(uint256 => mapping(address => uint256)) public buyerPurchased;

    mapping(uint256 => uint256) public listingApprovalVotes;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnProject;

    mapping(uint256 => Dispute) public disputes;
    mapping(uint256 => mapping(address => bool)) public hasVotedOnDispute;

    // ==================== EVENTS ====================

    event ProjectSubmitted(uint256 indexed projectId, address indexed owner, string projectURI, uint256 proposedCO2Kg);
    event ProjectApprovalVoted(uint256 indexed projectId, address indexed validator, bool approved);
    event ProjectApproved(uint256 indexed projectId, address indexed approvedBy, uint256 approvedCO2Kg, uint256 tokenAmount);
    event ListingCreated(uint256 indexed listingId, uint256 indexed projectId, address indexed seller, uint256 amount, uint256 pricePerUnit);
    event ListingCancelled(uint256 indexed listingId);
    event CreditsPurchased(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPrice, uint256 feePaid);

    // FIX: thêm event mới cho retireCredits
    event CreditsRetired(address indexed buyer, uint256 indexed projectId, uint256 tokenAmount, uint256 co2Kg, uint256 certificateTokenId);

    event DisputeOpened(uint256 indexed listingId, address indexed initiator, string reason);
    event DisputeResolved(uint256 indexed listingId, bool sellerPenalized);
    event TreasuryClaimed(address indexed to, uint256 amount);

    // FIX: thêm event cho validator management
    event ValidatorAdded(address indexed validator);
    event ValidatorRemoved(address indexed validator);

    // ==================== MODIFIERS ====================

    modifier onlyValidator() {
        require(isValidator[msg.sender], "CarbonMarketplace: Nguoi goi khong phai validator");
        _;
    }

    modifier whenNotBlacklisted() {
        require(!blacklistedOwners[msg.sender], "CarbonMarketplace: Dia chi da bi dua vao danh sach den");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address carbonCreditAddress, address certificateNFTAddress) Ownable(msg.sender) {
        carbonCredit = CarbonCredit1155(carbonCreditAddress);
        certificateNFT = GreenCertificateNFT(certificateNFTAddress);
        validators.push(msg.sender);
        isValidator[msg.sender] = true;
    }

    // FIX #9: Nhận ETH vô tình gửi thẳng vào contract
    receive() external payable {
        treasuryBalance += msg.value;
    }

    // ==================== TREASURY ====================

    function updatePlatformFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "CarbonMarketplace: Phi khong duoc vuot qua 10%");
        platformFeeBps = _newFeeBps;
    }
    function updatePriceRange(uint256 _min, uint256 _max) external onlyOwner { 
        require(_min < _max, "min phai nho hon max"); 
        minPrice = _min; maxPrice = _max; 
    }

    function claimTreasury(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(amount <= treasuryBalance, "CarbonMarketplace: Quy khong du so du");
        treasuryBalance -= amount;
        (bool success, ) = to.call{value: amount}("");
        require(success, "CarbonMarketplace: Giao dich chuyen tien that bai");
        emit TreasuryClaimed(to, amount);
    }

    // ==================== VALIDATOR MANAGEMENT ====================

    // FIX #7: thêm hàm addValidator / removeValidator
    function addValidator(address validator) external onlyOwner {
        require(validator != address(0), "CarbonMarketplace: Dia chi khong hop le");
        require(!isValidator[validator], "CarbonMarketplace: Da la validator");
        validators.push(validator);
        isValidator[validator] = true;
        emit ValidatorAdded(validator);
    }

    function removeValidator(address validator) external onlyOwner {
        require(isValidator[validator], "CarbonMarketplace: Khong phai validator");
        require(validators.length > 1, "CarbonMarketplace: Phai co it nhat 1 validator");
        isValidator[validator] = false;
        // Xóa khỏi array bằng cách swap với phần tử cuối
        for (uint256 i = 0; i < validators.length; i++) {
            if (validators[i] == validator) {
                validators[i] = validators[validators.length - 1];
                validators.pop();
                break;
            }
        }
        emit ValidatorRemoved(validator);
    }

    function getValidatorsCount() external view returns (uint256) {
        return validators.length;
    }

    // ==================== PROJECT ====================

    function submitProject(string memory projectURI, uint256 proposedCO2Kg) external whenNotBlacklisted {
        require(bytes(projectURI).length > 0, "CarbonMarketplace: URI dang trong");
        require(proposedCO2Kg > 0, "CarbonMarketplace: Luong CO2 bang 0");

        nextProjectId++;
        projects[nextProjectId] = Project({
            projectId: nextProjectId,
            owner: msg.sender,
            projectURI: projectURI,
            proposedCO2Kg: proposedCO2Kg,
            approvedCO2Kg: 0,
            approved: false,
            blacklisted: false,
            createdAt: block.timestamp,
            exists: true
        });

        emit ProjectSubmitted(nextProjectId, msg.sender, projectURI, proposedCO2Kg);
    }

    function voteOnProject(uint256 projectId, bool approve) external onlyValidator {
        require(projects[projectId].exists, "CarbonMarketplace: Du an khong ton tai");
        require(!projects[projectId].approved, "CarbonMarketplace: Du an da duoc duyet");
        require(!hasVotedOnProject[projectId][msg.sender], "CarbonMarketplace: Da bo phieu cho du an nay");

        // FIX #4: Validator không được vote cho project của chính mình
        require(msg.sender != projects[projectId].owner, "CarbonMarketplace: Khong the bau phieu cho du an cua chinh minh");

        hasVotedOnProject[projectId][msg.sender] = true;
        if (approve) listingApprovalVotes[projectId]++;
        emit ProjectApprovalVoted(projectId, msg.sender, approve);
    }

    function approveAndMint(uint256 projectId, uint256 approvedCO2Kg, string memory tokenURI) external onlyOwner {
        Project storage project = projects[projectId];
        require(project.exists && !project.approved && !project.blacklisted, "CarbonMarketplace: Trang thai du an khong hop le");
        require(approvedCO2Kg > 0 && approvedCO2Kg <= project.proposedCO2Kg, "CarbonMarketplace: Luong CO2 khong hop le");
        require(listingApprovalVotes[projectId] >= (validators.length / 2) + 1, "CarbonMarketplace: Chua du so phieu bau");

        uint256 tokenAmount = approvedCO2Kg / KG_CO2_PER_TOKEN;
        project.approved = true;
        project.approvedCO2Kg = approvedCO2Kg;

        carbonCredit.mintCredit(project.owner, projectId, tokenAmount, tokenURI);
        emit ProjectApproved(projectId, msg.sender, approvedCO2Kg, tokenAmount);
    }

    // ==================== LISTING & TRADING ====================

    function createListing(uint256 projectId, uint256 amount, uint256 pricePerUnit) external whenNotPaused {
        Project storage project = projects[projectId];
        require(project.approved && !project.blacklisted, "CarbonMarketplace: Du an khong hop le");
        require(msg.sender == project.owner, "CarbonMarketplace: Nguoi goi khong phai chu du an");
        require(amount > 0, "CarbonMarketplace: So luong bang 0");

        // FIX #5: validate price nằm trong khoảng hợp lệ
        require(pricePerUnit >= minPrice && pricePerUnit <= maxPrice, "CarbonMarketplace: Gia khong hop le");

        carbonCredit.safeTransferFrom(msg.sender, address(this), projectId, amount, "");

        nextListingId++;
        listings[nextListingId] = Listing({
            listingId: nextListingId,
            projectId: projectId,
            seller: msg.sender,
            amount: amount,
            pricePerUnit: pricePerUnit,
            active: true,
            createdAt: block.timestamp
        });

        emit ListingCreated(nextListingId, projectId, msg.sender, amount, pricePerUnit);
    }

    function buyCredits(uint256 listingId, uint256 amount) external payable nonReentrant whenNotPaused {
        Listing storage listing = listings[listingId];
        require(listing.active, "CarbonMarketplace: Niem yet khong hoat dong");
        require(!disputes[listingId].active, "CarbonMarketplace: Niem yet dang xay ra tranh chap");
        require(amount > 0, "CarbonMarketplace: So luong bang 0");
        require(amount <= listing.amount, "CarbonMarketplace: So luong khong du");

        uint256 totalPrice = amount * listing.pricePerUnit;
        require(msg.value == totalPrice, "CarbonMarketplace: So luong ETH khong chinh xac");

        listing.amount -= amount;
        if (listing.amount == 0) listing.active = false;

        uint256 fee = (totalPrice * platformFeeBps) / 10000;
        uint256 sellerShare = totalPrice - fee;

        sellerBalances[listing.seller] += sellerShare;
        treasuryBalance += fee;

        // FIX: ghi nhận buyer đã mua để dùng cho openDispute
        buyerPurchased[listingId][msg.sender] += amount;

        carbonCredit.safeTransferFrom(address(this), msg.sender, listing.projectId, amount, "");
        emit CreditsPurchased(listingId, msg.sender, amount, totalPrice, fee);
    }

    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "CarbonMarketplace: Khong phai nguoi ban");
        require(listing.active, "CarbonMarketplace: Niem yet khong hoat dong");
        require(!disputes[listingId].active, "CarbonMarketplace: Khong the huy khi dang co tranh chap");

        listing.active = false;
        carbonCredit.safeTransferFrom(address(this), msg.sender, listing.projectId, listing.amount, "");
        emit ListingCancelled(listingId);
    }

    function withdrawProceeds() external nonReentrant {
        uint256 balance = sellerBalances[msg.sender];
        require(balance > 0, "CarbonMarketplace: Khong co so du de rut");
        sellerBalances[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "CarbonMarketplace: Giao dich chuyen tien that bai");
    }

    // ==================== RETIRE CREDITS (HÀM CỐT LÕI) ====================

    /// @notice FIX #1: Đây là hàm trung hòa carbon — đốt ERC-1155 và mint NFT chứng nhận SBT
    /// @dev Người dùng phải gọi carbonCredit.setApprovalForAll(marketplace, true) trước
    /// @param projectId  ID của dự án carbon muốn retire
    /// @param amount     Số lượng token muốn đốt (1 token = KG_CO2_PER_TOKEN kg CO2)
    /// @param certificateURI  Link IPFS chứa metadata của NFT chứng nhận
    function retireCredits(
        uint256 projectId,
        uint256 amount,
        string memory certificateURI
    ) external nonReentrant whenNotPaused {
        require(amount > 0, "CarbonMarketplace: So luong bang 0");
        require(projects[projectId].exists, "CarbonMarketplace: Du an khong ton tai");
        require(bytes(certificateURI).length > 0, "CarbonMarketplace: URI chung nhan trong");

        // FIX #2: dùng pattern transfer-vào-contract-rồi-burn
        // thay vì burnFrom trực tiếp để tránh lỗi approval phức tạp
        carbonCredit.safeTransferFrom(msg.sender, address(this), projectId, amount, "");
        carbonCredit.burnCredit(address(this), projectId, amount);

        // Tính lượng CO2 tương đương (kg)
        uint256 co2Kg = amount * KG_CO2_PER_TOKEN;

        // Mint NFT chứng nhận SBT cho người dùng
        uint256 certTokenId = certificateNFT.mintCertificate(
            msg.sender,
            projectId,
            amount,
            co2Kg,
            certificateURI
        );

        emit CreditsRetired(msg.sender, projectId, amount, co2Kg, certTokenId);
    }

    // ==================== DISPUTE ====================

    // FIX #6: chỉ buyer thực sự (đã mua từ listing) mới được mở dispute
    function openDispute(uint256 listingId, string memory reason) external {
        require(listings[listingId].active, "CarbonMarketplace: Niem yet khong hoat dong");
        require(!disputes[listingId].active, "CarbonMarketplace: Da xay ra tranh chap truoc do");
        require(
            buyerPurchased[listingId][msg.sender] > 0 || isValidator[msg.sender],
            "CarbonMarketplace: Chi nguoi mua hoac validator moi co the mo tranh chap"
        );

        disputes[listingId] = Dispute({
            listingId: listingId,
            initiator: msg.sender,
            reason: reason,
            votes: 0,
            active: true
        });

        emit DisputeOpened(listingId, msg.sender, reason);
    }

    function resolveDispute(uint256 listingId, bool penalizeSeller) external onlyValidator {
        Dispute storage dispute = disputes[listingId];
        require(dispute.active, "CarbonMarketplace: Khong co tranh chap nao dang mo");
        require(!hasVotedOnDispute[listingId][msg.sender], "CarbonMarketplace: Da bo phieu cho tranh chap nay");

        hasVotedOnDispute[listingId][msg.sender] = true;
        if (penalizeSeller) dispute.votes++;

        if (dispute.votes >= (validators.length / 2) + 1) {
            dispute.active = false;
            listings[listingId].active = false;

            uint256 slashedAmount = sellerBalances[listings[listingId].seller];
            sellerBalances[listings[listingId].seller] = 0;
            treasuryBalance += slashedAmount;

            emit DisputeResolved(listingId, true);
        }
    }
}
