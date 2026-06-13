// ============================================================
// contract.ts — Địa chỉ & ABI các smart contract trên Sepolia
// ABI lấy trực tiếp từ artifacts sau khi compile Hardhat
// ============================================================

export const CONTRACT_ADDRESSES = {
  CARBON_MARKETPLACE: "0xBb1d739d98dAe76DD1E95e4A978Fd1E4b525ABa4",
  CARBON_CREDIT_1155: "0xb6093FBE46BA1C0222F0D24D829EB7f310d314c7",
  GREEN_CERTIFICATE_NFT: "0xb525976C24285B3D87033FD3A3E74deDdF6878f7",
} as const;

export const NETWORK = {
  CHAIN_ID: 11155111,
  NAME: "Sepolia Testnet",
  EXPLORER: "https://sepolia.etherscan.io",
} as const;

// ── ABI: CarbonMarketplace ────────────────────────────────────
export const CARBON_MARKETPLACE_ABI = [
  {
    inputs: [{ internalType: "string", name: "projectURI", type: "string" }, { internalType: "uint256", name: "proposedCO2Kg", type: "uint256" }],
    name: "submitProject", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }, { internalType: "bool", name: "approve", type: "bool" }],
    name: "voteOnProject", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }, { internalType: "uint256", name: "amount", type: "uint256" }],
    name: "buyCredits", outputs: [], stateMutability: "payable", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "validator", type: "address" }],
    name: "addValidator", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "validator", type: "address" }],
    name: "removeValidator", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  // ⚠️ Tên param phải khớp chính xác với contract đã deploy
  {
    inputs: [
      { internalType: "uint256", name: "creditId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "string", name: "reason", type: "string" },
    ],
    name: "retireCredits", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "projectId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "pricePerUnit", type: "uint256" },
    ],
    name: "createListing", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }],
    name: "cancelListing", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [],
    name: "withdrawProceeds", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }, { internalType: "uint256", name: "approvedCO2Kg", type: "uint256" }, { internalType: "string", name: "tokenURI", type: "string" }],
    name: "approveAndMint", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }, { internalType: "string", name: "reason", type: "string" }],
    name: "openDispute", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "listingId", type: "uint256" }, { internalType: "bool", name: "penalizeSeller", type: "bool" }],
    name: "resolveDispute", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "address payable", name: "to", type: "address" }, { internalType: "uint256", name: "amount", type: "uint256" }],
    name: "claimTreasury", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_newFeeBps", type: "uint256" }],
    name: "updatePlatformFee", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "_min", type: "uint256" }, { internalType: "uint256", name: "_max", type: "uint256" }],
    name: "updatePriceRange", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  // View functions
  {
    inputs: [],
    name: "getValidatorsCount",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "listings",
    outputs: [
      { internalType: "uint256", name: "listingId", type: "uint256" },
      { internalType: "uint256", name: "projectId", type: "uint256" },
      { internalType: "address", name: "seller", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "pricePerUnit", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
    ],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "projects",
    outputs: [
      { internalType: "uint256", name: "projectId", type: "uint256" },
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "string", name: "projectURI", type: "string" },
      { internalType: "uint256", name: "proposedCO2Kg", type: "uint256" },
      { internalType: "uint256", name: "approvedCO2Kg", type: "uint256" },
      { internalType: "bool", name: "approved", type: "bool" },
      { internalType: "bool", name: "blacklisted", type: "bool" },
      { internalType: "uint256", name: "createdAt", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "nextListingId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "nextProjectId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "platformFeeBps",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "minPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "maxPrice",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "treasuryBalance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [],
    name: "paused",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "isValidator",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "sellerBalances",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "listingApprovalVotes",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "validators",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "", type: "address" }],
    name: "blacklistedOwners",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }, { internalType: "address", name: "", type: "address" }],
    name: "buyerPurchased",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "projectId", type: "uint256" },
      { indexed: true, internalType: "address", name: "owner", type: "address" },
      { indexed: false, internalType: "string", name: "projectURI", type: "string" },
      { indexed: false, internalType: "uint256", name: "proposedCO2Kg", type: "uint256" },
    ],
    name: "ProjectSubmitted", type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "projectId", type: "uint256" },
      { indexed: true, internalType: "address", name: "approvedBy", type: "address" },
      { indexed: false, internalType: "uint256", name: "approvedCO2Kg", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "tokenAmount", type: "uint256" },
    ],
    name: "ProjectApproved", type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "listingId", type: "uint256" },
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: false, internalType: "uint256", name: "amount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "totalPrice", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "feePaid", type: "uint256" },
    ],
    name: "CreditsPurchased", type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "buyer", type: "address" },
      { indexed: true, internalType: "uint256", name: "projectId", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "tokenAmount", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "co2Kg", type: "uint256" },
      { indexed: false, internalType: "uint256", name: "certificateTokenId", type: "uint256" },
    ],
    name: "CreditsRetired", type: "event",
  },
  { stateMutability: "payable", type: "receive" },
] as const;

// ── ABI: CarbonCredit1155 ─────────────────────────────────────
export const CARBON_CREDIT_1155_ABI = [
  {
    inputs: [{ internalType: "address", name: "operator", type: "address" }, { internalType: "bool", name: "approved", type: "bool" }],
    name: "setApprovalForAll", outputs: [], stateMutability: "nonpayable", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }, { internalType: "uint256", name: "id", type: "uint256" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }, { internalType: "address", name: "operator", type: "address" }],
    name: "isApprovedForAll",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "from", type: "address" }, { internalType: "address", name: "to", type: "address" }, { internalType: "uint256", name: "id", type: "uint256" }, { internalType: "uint256", name: "amount", type: "uint256" }, { internalType: "bytes", name: "data", type: "bytes" }],
    name: "safeTransferFrom", outputs: [], stateMutability: "nonpayable", type: "function",
  },
] as const;

// ── ABI: GreenCertificateNFT ──────────────────────────────────
export const GREEN_CERTIFICATE_NFT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view", type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view", type: "function",
  },
] as const;