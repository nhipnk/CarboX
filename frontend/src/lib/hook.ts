import { useReadContract, useWriteContract, useAccount, usePublicClient } from "wagmi";
import type { TransactionReceipt } from "viem";
import {
  CONTRACT_ADDRESSES,
  CARBON_MARKETPLACE_ABI,
  CARBON_CREDIT_1155_ABI,
  NETWORK,
} from "./contract";

const DEFAULT_RECEIPT_OPTIONS = {
  pollingInterval: 4000,
  timeout: 180_000,
};

const RETIRE_RECEIPT_OPTIONS = {
  pollingInterval: 2000,
  timeout: 180_000,
};

// These are gas limits, not fixed gas fees. MetaMask still chooses gas pricing.
export const GAS_LIMITS = {
  setApprovalForAll: 120000n,
  submitProject: 300000n,
  createListing: 350000n,
  buyCredits: 350000n,
  retireCredits: 700000n,
  voteOnProject: 250000n,
  addValidator: 150000n,
  openDispute: 200000n,     
  resolveDispute: 250000n,   
  withdrawProceeds: 100000n,
} as const;

type ReceiptWaitOptions = {
  pollingInterval?: number;
  timeout?: number;
};

type RetireOptions = {
  onSubmitted?: (hash: `0x${string}`) => void;
};

export type ReceiptWaitResult = {
  status: "success" | "reverted" | "timeout";
  hash: `0x${string}`;
  receipt?: TransactionReceipt;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForReceipt(
  publicClient: any,
  hash: `0x${string}`,
  options: ReceiptWaitOptions = {}
): Promise<ReceiptWaitResult> {
  if (!publicClient) return { status: "timeout", hash };

  const waitOptions = {
    ...DEFAULT_RECEIPT_OPTIONS,
    ...options,
  };

  const pollingInterval = waitOptions.pollingInterval ?? DEFAULT_RECEIPT_OPTIONS.pollingInterval;
  const timeout = waitOptions.timeout ?? DEFAULT_RECEIPT_OPTIONS.timeout;
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeout) {
    try {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      if (receipt) {
        return {
          status: receipt.status === "reverted" ? "reverted" : "success",
          hash,
          receipt,
        };
      }
    } catch (error) {
      lastError = error;
    }

    await sleep(pollingInterval);
  }

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash });
    if (receipt) {
      return {
        status: receipt.status === "reverted" ? "reverted" : "success",
        hash,
        receipt,
      };
    }
  } catch (error) {
    lastError = error;
  }

  console.warn(`Receipt was not available before timeout for ${hash}`, lastError);
  return { status: "timeout", hash };
}

// ── Đọc số dư token carbon của ví ────────────────────────────
export function useCarbonBalance(projectId: bigint) {
  const { address } = useAccount();
  return useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_CREDIT_1155,
    abi: CARBON_CREDIT_1155_ABI,
    functionName: "balanceOf",
    args: address ? [address, projectId] : undefined,
    query: { enabled: !!address },
  });
}

// ── Kiểm tra đã approve marketplace chưa ─────────────────────
export function useIsApproved() {
  const { address } = useAccount();
  return useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_CREDIT_1155,
    abi: CARBON_CREDIT_1155_ABI,
    functionName: "isApprovedForAll",
    args: address
      ? [address, CONTRACT_ADDRESSES.CARBON_MARKETPLACE]
      : undefined,
    query: { enabled: !!address },
  });
}

// ── Approve marketplace (cần làm trước khi retire) ───────────
export function useApproveMarketplace() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const approve = async () => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_CREDIT_1155,
      abi: CARBON_CREDIT_1155_ABI,
      functionName: "setApprovalForAll",
      args: [CONTRACT_ADDRESSES.CARBON_MARKETPLACE, true],
      gas: GAS_LIMITS.setApprovalForAll,
    });
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { approve, isPending };
}

// ── Mua token carbon ──────────────────────────────────────────
export function useBuyCredits() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const buy = async (listingId: bigint, amount: bigint, totalPrice: bigint) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "buyCredits",
      args: [listingId, amount],
      value: totalPrice,
      gas: GAS_LIMITS.buyCredits,
    });
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { buy, isPending };
}

// ── Retire carbon (đốt token + nhận NFT) ─────────────────────
export function useRetireCredits() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const retire = async (
    projectId: bigint,
    amount: bigint,
    certURI: string,
    options: RetireOptions = {}
  ) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: 'retireCredits',
      args: [projectId, amount, certURI],
      gas: GAS_LIMITS.retireCredits,
    });

    options.onSubmitted?.(hash);
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      return await waitForReceipt(publicClient, hash, RETIRE_RECEIPT_OPTIONS);
    }
    return { status: "timeout", hash } satisfies ReceiptWaitResult;
  };

  return { retire, isPending };
}

// ── Submit dự án mới ──────────────────────────────────────────
export function useSubmitProject() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const submit = async (projectURI: string, proposedCO2Kg: bigint) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "submitProject",
      args: [projectURI, proposedCO2Kg],
      gas: GAS_LIMITS.submitProject,
    });
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { submit, isPending };
}

// ── Vote dự án (dùng ví đang đăng nhập) ───────────────────────
export function useVoteProject() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const vote = async (onChainProjectId: number, approve = true) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "voteOnProject",
      args: [BigInt(onChainProjectId), approve],
      gas: GAS_LIMITS.voteOnProject,
    });
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { vote, isPending };
}

// ── Add validator (dùng ví owner) ───────────────────────────
export function useAddValidator() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const addValidator = async (validatorAddress: string) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "addValidator",
      args: [validatorAddress as `0x${string}`],
      gas: GAS_LIMITS.addValidator,
    });
    
    // Chờ receipt để kiểm tra status
    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { addValidator, isPending };
}

// ── Mở tranh chấp (buyer hoặc validator) ──────────────────────
export function useOpenDispute() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const openDispute = async (listingId: bigint, reason: string) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "openDispute",
      args: [listingId, reason],
      gas: 200000n,
    });

    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { openDispute, isPending };
}

// ── Giải quyết tranh chấp (validator vote) ────────────────────
export function useResolveDispute() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const resolveDispute = async (listingId: bigint, penalizeSeller: boolean) => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "resolveDispute",
      args: [listingId, penalizeSeller],
      gas: 250000n,
    });

    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { resolveDispute, isPending };
}
// ── Đọc số dư đang chờ rút của seller ──────────────────────────
export function useSellerBalance() {
  const { address } = useAccount();
  return useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: "sellerBalances",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

// ── Rút tiền bán hàng về ví ─────────────────────────────────────
export function useWithdrawProceeds() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const withdraw = async () => {
    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
      abi: CARBON_MARKETPLACE_ABI,
      functionName: "withdrawProceeds",
      args: [],
      gas: GAS_LIMITS.withdrawProceeds,
    });

    if (publicClient && hash) {
      const receipt = await waitForReceipt(publicClient, hash);
      if (receipt?.status === 'reverted') {
        throw new Error('Giao dịch bị revert trên blockchain');
      }
    }
    return hash;
  };

  return { withdraw, isPending };
}
