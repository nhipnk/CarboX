import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useVoteProject, useAddValidator } from '../lib/hook';
import { CONTRACT_ADDRESSES, CARBON_MARKETPLACE_ABI } from '../lib/contract';
import { AdminDisputeTab } from '../components/admin-dispute-tab';

const ADMIN_KEY = 'CarbonX_Admin_Super_Secret_2026';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const MARKETPLACE_READ_ABI = [
  ...CARBON_MARKETPLACE_ABI,
  {
    name: 'listingApprovalVotes',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'projectId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getValidatorsCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'hasVotedOnProject',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'projectId', type: 'uint256' },
      { name: 'voter', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
];

interface Project {
  _id: string;
  projectName: string;
  ownerWallet: string;
  ipfsHash: string;
  totalCarbon: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  onChainProjectId: number | null;
  approvedCO2Kg: number | null;
  createdAt: string;
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    let message = err.error || `Lỗi ${res.status}`;
    if (err.details) {
      message += ` — ${err.details}`;
    }
    throw new Error(message);
  }
  return res.json();
}

const openIPFS = (hash: string) => {
  const cid = hash?.replace('ipfs://', '');
  window.open(`https://gateway.pinata.cloud/ipfs/${cid}`, '_blank');
};

const ApproveModal = ({
  project,
  onClose,
  onSuccess,
}: {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [form, setForm] = useState({
    onChainProjectId: project.onChainProjectId?.toString() ?? '',
    approvedCO2Kg: project.totalCarbon.toString(),
    tokenURI: project.ipfsHash?.startsWith('ipfs://') ? project.ipfsHash : `ipfs://${project.ipfsHash}`,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    if (!form.onChainProjectId || !form.approvedCO2Kg || !form.tokenURI) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await adminFetch(`/api/projects/approve/${project._id}`, {
        method: 'PUT',
        body: JSON.stringify({
          onChainProjectId: Number(form.onChainProjectId),
          approvedCO2Kg: Number(form.approvedCO2Kg),
          tokenURI: form.tokenURI,
        }),
      });
      onSuccess();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#0f1a0f] border border-white/10 rounded-2xl p-8 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">✅ Duyệt dự án</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-all">×</button>
        </div>
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Tên dự án</span>
            <span className="text-white font-semibold">{project.projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Chủ sở hữu</span>
            <span className="text-gray-300 font-mono text-xs">{project.ownerWallet}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CO₂ đề xuất</span>
            <span className="text-yellow-400 font-bold">{project.totalCarbon.toLocaleString()} kg</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">IPFS</span>
            <button onClick={() => openIPFS(project.ipfsHash)} className="text-blue-400 hover:text-blue-300 text-xs transition-all">
              Xem tài liệu ↗
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">
              onChainProjectId <span className="text-yellow-400 text-xs">(lấy từ event ProjectSubmitted)</span>
            </label>
            <input
              type="number"
              placeholder="VD: 1"
              value={form.onChainProjectId}
              onChange={(e) => setForm({ ...form, onChainProjectId: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">
              CO₂ xác nhận (kg) <span className="text-gray-500 text-xs">— có thể điều chỉnh</span>
            </label>
            <input
              type="number"
              value={form.approvedCO2Kg}
              onChange={(e) => setForm({ ...form, approvedCO2Kg: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
            />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">
              Token URI <span className="text-gray-500 text-xs">(ipfs://...)</span>
            </label>
            <input
              type="text"
              placeholder="ipfs://Qm..."
              value={form.tokenURI}
              onChange={(e) => setForm({ ...form, tokenURI: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 font-mono text-sm transition-all"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-white/20 text-gray-400 hover:text-white py-3 rounded-xl transition-all">
            Hủy
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 text-black font-black py-3 rounded-xl transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Đang gọi blockchain...
              </span>
            ) : '✅ Duyệt & Mint Token'}
          </button>
        </div>
        <p className="text-gray-600 text-xs text-center mt-3">
          Backend sẽ tự động gọi approveAndMint() lên smart contract
        </p>
      </div>
    </div>
  );
};

const RejectModal = ({
  project,
  onClose,
  onSuccess,
}: {
  project: Project;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleReject = async () => {
    setLoading(true);
    setError('');
    try {
      await adminFetch(`/api/projects/reject/${project._id}`, {
        method: 'PUT',
        body: JSON.stringify({ reason }),
      });
      onSuccess();
    } catch (e: any) {
      try {
        await adminFetch(`/api/projects/${project._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'Rejected' }),
        });
        onSuccess();
      } catch {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">❌ Từ chối dự án</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-all">×</button>
        </div>
        <div className="bg-white/3 border border-white/10 rounded-xl p-4 mb-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Tên dự án</span>
            <span className="text-white font-semibold">{project.projectName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Chủ sở hữu</span>
            <span className="text-gray-300 font-mono text-xs">{project.ownerWallet}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CO₂ đề xuất</span>
            <span className="text-yellow-400 font-bold">{project.totalCarbon.toLocaleString()} kg</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">IPFS</span>
            <button onClick={() => openIPFS(project.ipfsHash)} className="text-blue-400 hover:text-blue-300 text-xs transition-all">
              Xem tài liệu ↗
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}
        <div>
          <label className="text-gray-400 text-sm mb-2 block">
            Lý do từ chối <span className="text-gray-500 text-xs">(không bắt buộc)</span>
          </label>
          <textarea
            rows={3}
            placeholder="VD: Tài liệu không đầy đủ..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-all resize-none"
          />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 border border-white/20 text-gray-400 hover:text-white py-3 rounded-xl transition-all">
            Hủy
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-gray-500 text-white font-black py-3 rounded-xl transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang xử lý...
              </span>
            ) : '❌ Xác nhận từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
};

const PendingCard = ({
  p,
  onApprove,
  onReject,
  onVote,
  isConnected,
  votePending,
}: {
  p: Project;
  onApprove: (p: Project) => void;
  onReject: (p: Project) => void;
  onVote: (p: Project) => void;
  isConnected: boolean;
  votePending: boolean;
}) => {
  const { address } = useAccount();

  const { data: approvalVotesData, refetch: refetchVotes } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: MARKETPLACE_READ_ABI,
    functionName: 'listingApprovalVotes',
    args: p.onChainProjectId !== null ? [BigInt(p.onChainProjectId)] : undefined,
    query: { 
      enabled: p.onChainProjectId !== null,
      refetchInterval: 5000, // tự động refresh mỗi 5 giây
    },
  });

  const { data: totalValidatorsData } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: MARKETPLACE_READ_ABI,
    functionName: 'getValidatorsCount',
    args: [],
    query: { enabled: p.onChainProjectId !== null },
  });

  const { data: hasVotedData } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: MARKETPLACE_READ_ABI,
    functionName: 'hasVotedOnProject',
    args:
      p.onChainProjectId !== null && address
        ? [BigInt(p.onChainProjectId), address as `0x${string}`]
        : undefined,
    query: { enabled: p.onChainProjectId !== null && !!address },
  });

  const approvalVotes = approvalVotesData ? Number(approvalVotesData) : 0;
  const totalValidators = totalValidatorsData ? Number(totalValidatorsData) : null;
  const hasVoted = Boolean(hasVotedData);

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-yellow-500/30 transition-all">
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-white font-bold text-lg">{p.projectName}</h3>
        <p className="text-gray-500 text-sm font-mono mt-1">
          {p.ownerWallet.slice(0, 10)}...{p.ownerWallet.slice(-8)}
        </p>
      </div>
      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400">
        ⏳ Pending
      </span>
    </div>
    <div className="grid grid-cols-3 gap-4 text-sm mb-5">
      <div>
        <p className="text-gray-500 text-xs">CO₂ đề xuất</p>
        <p className="text-white font-semibold">{p.totalCarbon.toLocaleString()} kg</p>
      </div>
      <div>
        <p className="text-gray-500 text-xs">onChainProjectId</p>
        <p className={`font-semibold ${p.onChainProjectId !== null ? 'text-green-400' : 'text-gray-500'}`}>
          {p.onChainProjectId !== null ? `#${p.onChainProjectId}` : 'Chưa có'}
        </p>
      </div>
      
    </div>
    <div className="flex items-center gap-3 flex-wrap">
      <button
        onClick={() => openIPFS(p.ipfsHash)}
        className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
      >
        📄 Xem IPFS ↗
      </button>
      <button
        onClick={() => window.open(`https://sepolia.etherscan.io/address/${p.ownerWallet}`, '_blank')}
        className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
      >
        🔗 Xem ví ↗
      </button>
      <div className="flex-1" />
      <button
        onClick={() => onVote(p)}
        disabled={p.onChainProjectId === null || !isConnected || votePending || hasVoted}
        className="border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-all"
      >
        {hasVoted ? 'Đã bỏ phiếu' : votePending ? 'Đang vote...' : '🗳️ Vote duyệt'}
      </button>
      <button
        onClick={() => onReject(p)}
        className="border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 px-4 py-2 rounded-lg text-sm transition-all"
      >
        ❌ Từ chối
      </button>
      <button
        onClick={() => onApprove(p)}
        className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-2 rounded-lg text-sm transition-all"
      >
        ✅ Duyệt dự án
      </button>
    </div>
    {hasVoted && (
      <p className="text-yellow-300 text-xs mt-3">⚠️ Bạn đã bỏ phiếu dự án này rồi.</p>
    )}
  </div>
  );
};

const AdminPage: NextPage = () => {
  const [authed, setAuthed] = useState(false);
  const [inputKey, setInputKey] = useState('');
  const [keyError, setKeyError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'dispute'>('pending');
  const [pendingProjects, setPendingProjects] = useState<Project[]>([]);
  const [approvedProjects, setApprovedProjects] = useState<Project[]>([]);
  const [rejectedProjects, setRejectedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { address, isConnected } = useAccount();
  const { vote, isPending: votePending } = useVoteProject();
  const { addValidator, isPending: addValidatorPending } = useAddValidator();
  const [validatorAddress, setValidatorAddress] = useState('');
  const [approveTarget, setApproveTarget] = useState<Project | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Project | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [voteCount, setVoteCount] = useState(0);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleAddValidator = async () => {
    if (!validatorAddress) {
      setError('Vui lòng nhập địa chỉ validator');
      return;
    }
    setError('');
    try {
      await addValidator(validatorAddress);
      showSuccess('✅ Đã gửi yêu cầu thêm validator!');
      setValidatorAddress('');
    } catch (e: any) {
      setError(e?.message || 'Lỗi khi thêm validator');
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pending, allProjects] = await Promise.all([
        adminFetch<Project[]>('/api/projects/pending'),
        adminFetch<Project[]>('/api/projects?status=all'),
      ]);
      setPendingProjects(Array.isArray(pending) ? pending : []);

      const projects = Array.isArray(allProjects) ? allProjects : [];
      setApprovedProjects(projects.filter(p => p.status === 'Approved'));
      setRejectedProjects(projects.filter(p => p.status === 'Rejected'));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadAll();
  }, [authed]);

  const handleLogin = () => {
    if (inputKey === ADMIN_KEY) {
      setAuthed(true);
    } else {
      setKeyError('Admin key không đúng');
    }
  };

  const handleApproveSuccess = () => {
    setApproveTarget(null);
    showSuccess('✅ Dự án đã được duyệt và mint token thành công!');
    loadAll();
  };

  const handleRejectSuccess = () => {
    setRejectTarget(null);
    showSuccess('❌ Đã từ chối dự án.');
    loadAll();
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Bạn có chắc muốn xóa dự án này không?')) return;
    try {
      await adminFetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      showSuccess('🗑️ Đã xóa dự án thành công!');
      loadAll();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleVote = async (project: Project) => {
    if (!isConnected) {
      setError('Vui lòng kết nối ví validator trước khi vote');
      return;
    }

    if (address?.toLowerCase() === project.ownerWallet.toLowerCase()) {
      const confirmed = confirm('Bạn đang vote cho dự án của chính mình. Bạn có chắc chắn muốn tiếp tục?');
      if (!confirmed) {
        return;
      }
      setError('Vote không thành công — bạn không thể vote dự án của chính mình');
      return;
    }

    if (project.onChainProjectId === null) {
      setError('Dự án chưa có onChainProjectId');
      return;
    }
    try {
      await vote(project.onChainProjectId, true);
      showSuccess('🗳️ Đã vote duyệt thành công!');
      setVoteCount(c => c + 1);
      loadAll();
    } catch (e: any) {
      const message = String(e?.message || e || '');
      if (message.toLowerCase().includes('da bo phieu') || message.toLowerCase().includes('already voted')) {
        setError('Bạn đã bỏ phiếu dự án này rồi.');
      } else {
        setError(message || 'Lỗi khi vote dự án');
      }
    }
  };

  if (!authed) {
    return (
      <>
        <Head><title>Admin — CarboX</title></Head>
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="bg-white/3 border border-white/10 rounded-2xl p-10 w-full max-w-md text-center">
            <div className="text-5xl mb-6">🔐</div>
            <h1 className="text-2xl font-black text-white mb-2">Admin Portal</h1>
            <p className="text-gray-400 text-sm mb-8">Nhập Admin Key để truy cập</p>
            {keyError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
                {keyError}
              </div>
            )}
            <input
              type="password"
              placeholder="Admin Key"
              value={inputKey}
              onChange={(e) => { setInputKey(e.target.value); setKeyError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all mb-4"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-3 rounded-xl transition-all"
            >
              Đăng nhập →
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head><title>Admin Dashboard — CarboX</title></Head>

      {approveTarget && (
        <ApproveModal
          project={approveTarget}
          onClose={() => setApproveTarget(null)}
          onSuccess={handleApproveSuccess}
        />
      )}

      {rejectTarget && (
        <RejectModal
          project={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSuccess={handleRejectSuccess}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 py-12">

        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-white mb-2">
                Admin <span className="text-green-400">Dashboard</span>
              </h1>
              <p className="text-gray-400">Duyệt dự án và mint token carbon lên blockchain</p>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2"
            >
              {loading
                ? <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                : '🔄'
              } Làm mới
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <div>
              <p className="text-gray-400 text-sm mb-2">Thêm validator (chỉ owner được thực hiện)</p>
              <input
                value={validatorAddress}
                onChange={(e) => setValidatorAddress(e.target.value)}
                placeholder="0x..."
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-500 transition-all"
              />
            </div>
            <button
              onClick={handleAddValidator}
              disabled={!isConnected || addValidatorPending}
              className="w-full md:w-auto bg-blue-500 hover:bg-blue-400 disabled:bg-white/10 disabled:text-gray-500 text-black font-bold px-6 py-3 rounded-xl transition-all"
            >
              {addValidatorPending ? 'Đang thêm...' : 'Thêm validator'}
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm mb-6">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-2">Chờ duyệt</p>
            <p className="text-3xl font-black text-yellow-400">{pendingProjects.length}</p>
            <p className="text-gray-600 text-xs mt-1">dự án</p>
          </div>
          <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-2">Đã duyệt</p>
            <p className="text-3xl font-black text-green-400">{approvedProjects.length}</p>
            <p className="text-gray-600 text-xs mt-1">dự án</p>
          </div>
          <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
            <p className="text-gray-400 text-sm mb-2">Tổng CO₂ đề xuất</p>
            <p className="text-3xl font-black text-white">
              {pendingProjects.reduce((s, p) => s + p.totalCarbon, 0).toLocaleString()}
            </p>
            <p className="text-gray-600 text-xs mt-1">kg</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">
            ⚠️ {error}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          {[
            { key: 'pending', label: '⏳ Chờ duyệt', count: pendingProjects.length, active: 'bg-yellow-500 text-black' },
            { key: 'approved', label: '✅ Đã duyệt', count: approvedProjects.length, active: 'bg-green-500 text-black' },
            { key: 'rejected', label: '❌ Đã từ chối', count: rejectedProjects.length, active: 'bg-red-500 text-white' },
            { key: 'dispute', label: '⚠️ Tranh chấp', count: 0, active: 'bg-red-500 text-white' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? tab.active
                  : 'border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {tab.key === 'dispute' ? tab.label : `${tab.label} (${tab.count})`}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
          </div>
        )}

        {/* Tab Pending */}
        {!loading && activeTab === 'pending' && (
          <div className="space-y-4">
            {pendingProjects.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
                <div className="text-5xl mb-4">🎉</div>
                <p>Không có dự án nào chờ duyệt</p>
              </div>
            ) : (
              pendingProjects.map((p) => (
                <PendingCard
                  key={`${p._id}-${voteCount}`}
                  p={p}
                  onApprove={setApproveTarget}
                  onReject={setRejectTarget}
                  onVote={handleVote}
                  isConnected={isConnected}
                  votePending={votePending}
                />
              ))
            )}
          </div>
        )}

        {/* Tab Approved */}
        {!loading && activeTab === 'approved' && (
          <div className="space-y-4">
            {approvedProjects.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
                <p>Chưa có dự án nào được duyệt</p>
              </div>
            ) : (
              approvedProjects.map((p) => (
                <div key={p._id} className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-green-500/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-bold text-lg">{p.projectName}</h3>
                      <p className="text-gray-500 text-sm font-mono mt-1">
                        {p.ownerWallet.slice(0, 10)}...{p.ownerWallet.slice(-8)}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                      ✅ Đã duyệt
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm mb-5">
                    <div>
                      <p className="text-gray-500 text-xs">CO₂ đề xuất</p>
                      <p className="text-white font-semibold">{p.totalCarbon.toLocaleString()} kg</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">CO₂ đã duyệt</p>
                      <p className="text-green-400 font-semibold">
                        {p.approvedCO2Kg ? `${p.approvedCO2Kg.toLocaleString()} kg` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">onChainProjectId</p>
                      <p className="text-green-400 font-semibold">
                        {p.onChainProjectId !== null ? `#${p.onChainProjectId}` : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openIPFS(p.ipfsHash)}
                      className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      📄 Xem IPFS ↗
                    </button>
                    <button
                      onClick={() => window.open(`https://sepolia.etherscan.io/address/${p.ownerWallet}`, '_blank')}
                      className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      🔗 Xem ví ↗
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Rejected */}
        {!loading && activeTab === 'rejected' && (
          <div className="space-y-4">
            {rejectedProjects.length === 0 ? (
              <div className="text-center py-20 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
                <p>Chưa có dự án nào bị từ chối</p>
              </div>
            ) : (
              rejectedProjects.map((p) => (
                <div key={p._id} className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-bold text-lg">{p.projectName}</h3>
                      <p className="text-gray-500 text-sm font-mono mt-1">
                        {p.ownerWallet.slice(0, 10)}...{p.ownerWallet.slice(-8)}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
                      ❌ Từ chối
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                    <div>
                      <p className="text-gray-500 text-xs">CO₂ đề xuất</p>
                      <p className="text-white font-semibold">{p.totalCarbon.toLocaleString()} kg</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Ngày nộp</p>
                      <p className="text-white font-semibold">{new Date(p.createdAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openIPFS(p.ipfsHash)}
                      className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      📄 Xem IPFS ↗
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => handleDelete(p._id)}
                      className="border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/60 px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab Dispute */}
        {activeTab === 'dispute' && <AdminDisputeTab />}

      </div>
    </>
  );
};

export default AdminPage;
