// ============================================================
// api.ts — Tất cả các hàm gọi Backend API
// ============================================================

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const ADMIN_KEY = "CarbonX_Admin_Super_Secret_2026";

// ── Helper fetch ──────────────────────────────────────────────
async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || `API error: ${res.status}`);
    }

    return res.json() as Promise<T>;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Backend chưa khả dụng');
    }
    throw error;
  }
}

// ── Types ─────────────────────────────────────────────────────
export interface Project {
  _id: string;
  projectName: string;
  ownerWallet: string;
  ipfsHash: string;
  totalCarbon: number;
  approvedCO2Kg?: number;
  status: "Pending" | "Approved" | "Rejected";
  onChainProjectId?: number;
  listedTokens?: number;
  soldTokens?: number;
  activeListingId?: number;
  pricePerCredit?: string | number;
  createdAt: string;
  // Optional frontend/contract metadata
  projectURI?: string;
  name?: string;
  owner?: string;
  id?: string | number;
  proposedCO2Kg?: number;
}

export interface Stats {
  totalApprovedProjects: number;
  totalAvailableCarbon: number;
  totalRetiredCarbon: number;
}

export interface Transaction {
  txHash: string;
  transactionType: "MINT" | "TRANSFER" | "RETIRE";
  fromAddress: string;
  toAddress: string;
  amount: number;
  blockNumber: number;
  timestamp: string;
}

export interface LeaderboardEntry {
  parentWalletAddress: string;
  totalRetired: number;
}

export interface CreateProjectPayload {
  projectName: string;
  ownerWallet: string;
  ipfsHash: string;
  totalCarbon: number;
}

// ── Projects ──────────────────────────────────────────────────

/** Lấy danh sách project đã Approved (dùng ở Dashboard và Retire) */
export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/api/projects');
}

/** Lấy danh sách tất cả project công khai (dùng ở Marketplace để hiển thị cả list và count) */
export async function getAllProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/api/projects?status=all');
}

/** Lấy danh sách project Pending (dùng ở Dashboard — hiển thị dự án của ví hiện tại) */
export async function getPendingProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/api/projects/pending", {
    headers: { "x-admin-key": ADMIN_KEY },
  });
}

/** Lấy thống kê tổng quan (dùng ở Dashboard stats) */
export async function getStats(): Promise<Stats> {
  return apiFetch<Stats>("/api/projects/stats");
}

/** Tạo project mới sau khi đã submitProject lên chain */
export async function createProject(payload: CreateProjectPayload): Promise<any> {
  return apiFetch('/api/projects/create', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── IPFS Upload ───────────────────────────────────────────────

/** Upload file PDF lên IPFS qua backend — trả về { ipfsHash, timestamp } */
export async function uploadToIPFS(file: File): Promise<{ ipfsHash: string }> {
  const formData = new FormData();
  formData.append("document", file);

  const res = await fetch(`${BASE_URL}/api/upload/ipfs`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Upload error: ${res.status}`);
  }

  return res.json();
}

// ── Leaderboard ───────────────────────────────────────────────

/** Lấy bảng xếp hạng */
export async function getLeaderboard(): Promise<{ leaderboard: LeaderboardEntry[] }> {
  return apiFetch<{ leaderboard: LeaderboardEntry[] }>("/api/leaderboard");
}

// ── Transaction History ───────────────────────────────────────

/** Lấy lịch sử giao dịch của một ví */
export async function getTransactionHistory(wallet: string): Promise<Transaction[]> {
  return apiFetch<Transaction[]>(`/api/transactions/history/${wallet}`);
}