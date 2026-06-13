/**
 * CarboX — Full Test Suite
 * Covers: CarbonCredit1155, GreenCertificateNFT, CarbonMarketplace
 *
 * Chạy: npx hardhat test
 */

import { expect } from "chai";
import { network } from "hardhat";

const hre = await network.create();
const { ethers } = hre;

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const IPFS_URI = "ipfs://QmTestCID123456789";
const CERT_URI = "ipfs://QmCertCID987654321";
const PROPOSED_CO2_KG = 1000n; // 1000 kg → 100 tokens (vì KG_CO2_PER_TOKEN = 10)
const APPROVED_CO2_KG = 1000n;
const TOKEN_AMOUNT = APPROVED_CO2_KG / 10n; // = 100 tokens

async function deployAll() {
  const [owner, projectOwner, buyer, validator2, stranger] =
    await ethers.getSigners();

  const CarbonCredit = await ethers.deployContract("CarbonCredit1155");
  await CarbonCredit.waitForDeployment();

  const GreenCert = await ethers.deployContract("GreenCertificateNFT");
  await GreenCert.waitForDeployment();

  const Marketplace = await ethers.deployContract("CarbonMarketplace", [
    await CarbonCredit.getAddress(),
    await GreenCert.getAddress(),
  ]);
  await Marketplace.waitForDeployment();

  // Cấp quyền cho Marketplace
  await CarbonCredit.setMarketplace(await Marketplace.getAddress());
  await GreenCert.setMarketplace(await Marketplace.getAddress());

  return { CarbonCredit, GreenCert, Marketplace, owner, projectOwner, buyer, validator2, stranger };
}

// Hàm tiện ích: đưa project lên trạng thái approved + mint token
async function setupApprovedProject(
  Marketplace: any,
  projectOwner: any,
  owner: any
) {
  await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
  const projectId = await Marketplace.nextProjectId();

  // owner là validator mặc định, vote duyệt
  await Marketplace.connect(owner).voteOnProject(projectId, true);

  // owner approve và mint
  await Marketplace.connect(owner).approveAndMint(projectId, APPROVED_CO2_KG, IPFS_URI);

  return projectId;
}

// ─────────────────────────────────────────────
// TEST: CarbonCredit1155
// ─────────────────────────────────────────────

describe("CarbonCredit1155", function () {
  it("deploy thành công", async function () {
    const { CarbonCredit } = await deployAll();
    expect(await CarbonCredit.getAddress()).to.be.properAddress;
  });

  it("chỉ owner mới setMarketplace được", async function () {
    const { CarbonCredit, stranger } = await deployAll();
    await expect(
      CarbonCredit.connect(stranger).setMarketplace(stranger.address)
    ).to.be.revert(ethers);
  });

  it("chỉ marketplace mới mintCredit được", async function () {
    const { CarbonCredit, stranger } = await deployAll();
    await expect(
      CarbonCredit.connect(stranger).mintCredit(stranger.address, 1n, 100n, IPFS_URI)
    ).to.be.revertedWith("CarbonCredit1155: caller is not marketplace");
  });

  it("revert khi URI không phải ipfs://", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    const projectId = await Marketplace.nextProjectId();
    await Marketplace.connect(owner).voteOnProject(projectId, true);

    await expect(
      Marketplace.connect(owner).approveAndMint(projectId, APPROVED_CO2_KG, "https://not-ipfs.com")
    ).to.be.revertedWith("CarbonCredit1155: must be valid IPFS URI (ipfs://...)");
  });

  it("blacklist project → mintCredit revert", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    const projectId = await Marketplace.nextProjectId();
    await Marketplace.connect(owner).voteOnProject(projectId, true);

    await CarbonCredit.connect(owner).blacklistProject(projectId, "fraud");

    await expect(
      Marketplace.connect(owner).approveAndMint(projectId, APPROVED_CO2_KG, IPFS_URI)
    ).to.be.revertedWith("CarbonCredit1155: project is blacklisted");
  });
});

// ─────────────────────────────────────────────
// TEST: GreenCertificateNFT
// ─────────────────────────────────────────────

describe("GreenCertificateNFT", function () {
  it("deploy thành công với tên đúng", async function () {
    const { GreenCert } = await deployAll();
    expect(await GreenCert.name()).to.equal("CarboX Green Certificate");
    expect(await GreenCert.symbol()).to.equal("CGC");
  });

  it("chỉ marketplace mới mintCertificate được", async function () {
    const { GreenCert, stranger } = await deployAll();
    await expect(
      GreenCert.connect(stranger).mintCertificate(stranger.address, 1n, 10n, 100n, CERT_URI)
    ).to.be.revertedWith("GreenCertificateNFT: caller is not marketplace");
  });

  it("NFT là Soulbound — không thể chuyển nhượng", async function () {
    const { GreenCert, Marketplace, CarbonCredit, owner, projectOwner, buyer, stranger } = await deployAll();

    // Setup: buyer có token rồi retire
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(
      await Marketplace.getAddress(), true
    );
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    const buyAmount = 10n;
    const totalCost = BigInt(buyAmount) * pricePerUnit;
    await Marketplace.connect(buyer).buyCredits(1n, buyAmount, { value: totalCost });

    await CarbonCredit.connect(buyer).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(buyer).retireCredits(projectId, buyAmount, CERT_URI);

    // Thử transfer NFT → phải revert
    const certTokenId = 1n;
    await expect(
      GreenCert.connect(buyer).transferFrom(buyer.address, stranger.address, certTokenId)
    ).to.be.revertedWith("GreenCertificateNFT: certificate is non-transferable");
  });

  it("revoke certificate hoạt động đúng", async function () {
    const { GreenCert, Marketplace, CarbonCredit, owner, projectOwner, buyer } = await deployAll();

    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    const buyAmount = 5n;
    await Marketplace.connect(buyer).buyCredits(1n, buyAmount, { value: buyAmount * pricePerUnit });
    await CarbonCredit.connect(buyer).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(buyer).retireCredits(projectId, buyAmount, CERT_URI);

    await GreenCert.connect(owner).revokeCertificate(1n, "invalid project");
    expect(await GreenCert.isRevoked(1n)).to.equal(true);
  });
});

// ─────────────────────────────────────────────
// TEST: CarbonMarketplace — PROJECT
// ─────────────────────────────────────────────

describe("CarbonMarketplace — Project", function () {
  it("submitProject lưu đúng thông tin", async function () {
    const { Marketplace, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    const project = await Marketplace.projects(1n);
    expect(project.owner).to.equal(projectOwner.address);
    expect(project.proposedCO2Kg).to.equal(PROPOSED_CO2_KG);
    expect(project.approved).to.equal(false);
  });

  it("voteOnProject → emit event đúng", async function () {
    const { Marketplace, owner, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    await expect(Marketplace.connect(owner).voteOnProject(1n, true))
      .to.emit(Marketplace, "ProjectApprovalVoted")
      .withArgs(1n, owner.address, true);
  });

  it("FIX #4: validator không thể vote cho project của chính mình", async function () {
    const { Marketplace, owner } = await deployAll();
    // owner vừa là validator vừa submit project
    await Marketplace.connect(owner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    await expect(
      Marketplace.connect(owner).voteOnProject(1n, true)
    ).to.be.revertedWith("CarbonMarketplace: Khong the bau phieu cho du an cua chinh minh");
  });

  it("không thể vote 2 lần", async function () {
    const { Marketplace, owner, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    await Marketplace.connect(owner).voteOnProject(1n, true);
    await expect(
      Marketplace.connect(owner).voteOnProject(1n, true)
    ).to.be.revertedWith("CarbonMarketplace: Da bo phieu cho du an nay");
  });

  it("approveAndMint thất bại nếu chưa đủ phiếu", async function () {
    const { Marketplace, owner, projectOwner } = await deployAll();
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    // Không vote → revert
    await expect(
      Marketplace.connect(owner).approveAndMint(1n, APPROVED_CO2_KG, IPFS_URI)
    ).to.be.revertedWith("CarbonMarketplace: Chua du so phieu bau");
  });

  it("approveAndMint thành công sau khi đủ phiếu → mint đúng số token", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);

    const balance = await CarbonCredit.balanceOf(projectOwner.address, projectId);
    expect(balance).to.equal(TOKEN_AMOUNT);
  });
});

// ─────────────────────────────────────────────
// TEST: CarbonMarketplace — LISTING & TRADING
// ─────────────────────────────────────────────

describe("CarbonMarketplace — Listing & Trading", function () {
  it("FIX #5: createListing revert nếu pricePerUnit = 0", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);

    await expect(
      Marketplace.connect(projectOwner).createListing(projectId, 10n, 0n)
    ).to.be.revertedWith("CarbonMarketplace: Gia khong hop le");
  });

  it("createListing thành công và emit event đúng", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);

    await expect(
      Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit)
    )
      .to.emit(Marketplace, "ListingCreated")
      .withArgs(1n, projectId, projectOwner.address, TOKEN_AMOUNT, pricePerUnit);
  });

  it("buyCredits: buyer nhận đúng token, phí được tính đúng", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner, buyer } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    const buyAmount = 10n;
    const totalCost = buyAmount * pricePerUnit;
    const expectedFee = (totalCost * 200n) / 10000n; // 2%

    await Marketplace.connect(buyer).buyCredits(1n, buyAmount, { value: totalCost });

    const buyerBalance = await CarbonCredit.balanceOf(buyer.address, projectId);
    expect(buyerBalance).to.equal(buyAmount);

    const treasuryBalance = await Marketplace.treasuryBalance();
    expect(treasuryBalance).to.equal(expectedFee);
  });

  it("buyCredits revert nếu ETH không đủ", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner, buyer } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    await expect(
      Marketplace.connect(buyer).buyCredits(1n, 10n, { value: ethers.parseEther("0.05") }) // thiếu tiền
    ).to.be.revertedWith("CarbonMarketplace: So luong ETH khong chinh xac");
  });

  it("cancelListing: token trả lại cho seller đúng", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    const balanceBefore = await CarbonCredit.balanceOf(projectOwner.address, projectId);
    await Marketplace.connect(projectOwner).cancelListing(1n);
    const balanceAfter = await CarbonCredit.balanceOf(projectOwner.address, projectId);

    expect(balanceAfter - balanceBefore).to.equal(TOKEN_AMOUNT);
  });

  it("withdrawProceeds: seller rút tiền thành công", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner, buyer } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);
    await Marketplace.connect(buyer).buyCredits(1n, TOKEN_AMOUNT, {
      value: TOKEN_AMOUNT * pricePerUnit,
    });

    const sellerShare = await Marketplace.sellerBalances(projectOwner.address);
    expect(sellerShare).to.be.gt(0n);

    await expect(Marketplace.connect(projectOwner).withdrawProceeds()).to.not.be.revert(ethers);
    expect(await Marketplace.sellerBalances(projectOwner.address)).to.equal(0n);
  });
});

// ─────────────────────────────────────────────
// TEST: FIX #1 — retireCredits (hàm cốt lõi)
// ─────────────────────────────────────────────

describe("CarbonMarketplace — retireCredits (FIX #1)", function () {
  async function setupBuyerWithTokens(buyAmount = 10n) {
    const ctx = await deployAll();
    const { CarbonCredit, Marketplace, owner, projectOwner, buyer } = ctx;

    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);
    await Marketplace.connect(buyer).buyCredits(1n, buyAmount, { value: buyAmount * pricePerUnit });

    // Buyer approve Marketplace để có thể retire
    await CarbonCredit.connect(buyer).setApprovalForAll(await Marketplace.getAddress(), true);

    return { ...ctx, projectId };
  }

  it("retireCredits đốt token và mint NFT chứng nhận", async function () {
    const { CarbonCredit, GreenCert, Marketplace, buyer, projectId } =
      await setupBuyerWithTokens(10n);

    await Marketplace.connect(buyer).retireCredits(projectId, 10n, CERT_URI);

    // Token bị đốt → balance = 0
    const remaining = await CarbonCredit.balanceOf(buyer.address, projectId);
    expect(remaining).to.equal(0n);

    // NFT chứng nhận được mint
    const certOwner = await GreenCert.ownerOf(1n);
    expect(certOwner).to.equal(buyer.address);
  });

  it("retireCredits emit CreditsRetired đúng thông tin", async function () {
    const { Marketplace, buyer, projectId } = await setupBuyerWithTokens(5n);

    await expect(Marketplace.connect(buyer).retireCredits(projectId, 5n, CERT_URI))
      .to.emit(Marketplace, "CreditsRetired")
      .withArgs(buyer.address, projectId, 5n, 50n, 1n); // 5 tokens × 10 kg = 50 kg CO2
  });

  it("retireCredits revert nếu số lượng = 0", async function () {
    const { Marketplace, buyer, projectId } = await setupBuyerWithTokens(5n);
    await expect(
      Marketplace.connect(buyer).retireCredits(projectId, 0n, CERT_URI)
    ).to.be.revertedWith("CarbonMarketplace: So luong bang 0");
  });

  it("retireCredits revert nếu không đủ token", async function () {
    const { Marketplace, buyer, projectId } = await setupBuyerWithTokens(5n);
    // Chỉ có 5 token nhưng thử retire 100
    await expect(
      Marketplace.connect(buyer).retireCredits(projectId, 100n, CERT_URI)
    ).to.be.revert(ethers);
  });

  it("NFT nhận được là Soulbound — không chuyển được", async function () {
    const { GreenCert, Marketplace, buyer, stranger, projectId } =
      await setupBuyerWithTokens(10n);

    await Marketplace.connect(buyer).retireCredits(projectId, 10n, CERT_URI);

    await expect(
      GreenCert.connect(buyer).transferFrom(buyer.address, stranger.address, 1n)
    ).to.be.revertedWith("GreenCertificateNFT: certificate is non-transferable");
  });
});

// ─────────────────────────────────────────────
// TEST: FIX #7 — Validator Management
// ─────────────────────────────────────────────

describe("CarbonMarketplace — Validator Management (FIX #7)", function () {
  it("addValidator thành công", async function () {
    const { Marketplace, owner, validator2 } = await deployAll();
    await Marketplace.connect(owner).addValidator(validator2.address);
    expect(await Marketplace.isValidator(validator2.address)).to.equal(true);
    expect(await Marketplace.getValidatorsCount()).to.equal(2n);
  });

  it("addValidator emit ValidatorAdded", async function () {
    const { Marketplace, owner, validator2 } = await deployAll();
    await expect(Marketplace.connect(owner).addValidator(validator2.address))
      .to.emit(Marketplace, "ValidatorAdded")
      .withArgs(validator2.address);
  });

  it("removeValidator thành công", async function () {
    const { Marketplace, owner, validator2 } = await deployAll();
    await Marketplace.connect(owner).addValidator(validator2.address);
    await Marketplace.connect(owner).removeValidator(validator2.address);
    expect(await Marketplace.isValidator(validator2.address)).to.equal(false);
  });

  it("không thể xóa validator cuối cùng", async function () {
    const { Marketplace, owner } = await deployAll();
    await expect(
      Marketplace.connect(owner).removeValidator(owner.address)
    ).to.be.revertedWith("CarbonMarketplace: Phai co it nhat 1 validator");
  });

  it("stranger không thể addValidator", async function () {
    const { Marketplace, stranger, validator2 } = await deployAll();
    await expect(
      Marketplace.connect(stranger).addValidator(validator2.address)
    ).to.be.revert(ethers);
  });

  it("2 validator vote → dự án được duyệt sau khi đủ quorum", async function () {
    const { Marketplace, CarbonCredit, owner, projectOwner, validator2 } = await deployAll();

    // Thêm validator2
    await Marketplace.connect(owner).addValidator(validator2.address);

    // Submit project bởi projectOwner (không phải validator)
    await Marketplace.connect(projectOwner).submitProject(IPFS_URI, PROPOSED_CO2_KG);
    const projectId = await Marketplace.nextProjectId();

    // Cần >= (2/2)+1 = 2 phiếu
    await Marketplace.connect(owner).voteOnProject(projectId, true);
    await Marketplace.connect(validator2).voteOnProject(projectId, true);

    // Giờ đủ phiếu → approveAndMint thành công
    await expect(
      Marketplace.connect(owner).approveAndMint(projectId, APPROVED_CO2_KG, IPFS_URI)
    ).to.not.be.revert(ethers);

    const balance = await CarbonCredit.balanceOf(projectOwner.address, projectId);
    expect(balance).to.equal(TOKEN_AMOUNT);
  });
});

// ─────────────────────────────────────────────
// TEST: FIX #6 — openDispute chỉ buyer/validator
// ─────────────────────────────────────────────

describe("CarbonMarketplace — Dispute (FIX #6)", function () {
  it("stranger không thể openDispute", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner, stranger } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);

    await expect(
      Marketplace.connect(stranger).openDispute(1n, "fraud")
    ).to.be.revertedWith("CarbonMarketplace: Chi nguoi mua hoac validator moi co the mo tranh chap");
  });

  it("buyer thực sự có thể openDispute", async function () {
    const { CarbonCredit, Marketplace, owner, projectOwner, buyer } = await deployAll();
    const projectId = await setupApprovedProject(Marketplace, projectOwner, owner);
    const pricePerUnit = ethers.parseEther("0.01");

    await CarbonCredit.connect(projectOwner).setApprovalForAll(await Marketplace.getAddress(), true);
    await Marketplace.connect(projectOwner).createListing(projectId, TOKEN_AMOUNT, pricePerUnit);
    await Marketplace.connect(buyer).buyCredits(1n, 5n, { value: 5n * pricePerUnit });

    await expect(
      Marketplace.connect(buyer).openDispute(1n, "seller is fraudulent")
    ).to.emit(Marketplace, "DisputeOpened");
  });
});

// ─────────────────────────────────────────────
// TEST: FIX #9 — receive() ETH
// ─────────────────────────────────────────────

describe("CarbonMarketplace — receive() ETH (FIX #9)", function () {
  it("nhận ETH trực tiếp vào contract thành công", async function () {
    const { Marketplace, buyer } = await deployAll();
    const amount = ethers.parseEther("0.1");

    await buyer.sendTransaction({
      to: await Marketplace.getAddress(),
      value: amount,
    });

    expect(await Marketplace.treasuryBalance()).to.equal(amount);
  });
});
