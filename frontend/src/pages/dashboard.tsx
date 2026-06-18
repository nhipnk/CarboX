import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther } from 'viem';
import { creditContract, marketplaceContract } from '../wagmi';
import {
  getProjects,
  getStats,
  getTransactionHistory,
  uploadToIPFS,
  createProject,
  type Project,
  type Transaction,
  type Stats,
} from '../lib/api';
import { GAS_LIMITS, useSubmitProject, waitForReceipt } from '../lib/hook';
import { WithdrawProceedsCard } from '../components/withdraw-proceeds-card';

// ── Sell Form Component ───────────────────────────────────────
const SellForm = ({
  address,
  projects,
  onSuccess,
}: {
  address: string;
  projects: Project[];
  onSuccess?: () => Promise<void> | void;
}) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(
    projects.length > 0 ? projects[0] : null
  );

  useEffect(() => {
    if (!selectedProject && projects.length > 0) {
      setSelectedProject(projects[0]);
    }
  }, [projects, selectedProject]);
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // Đọc balance token của ví
  const { data: tokenBalance } = useReadContract({
    ...creditContract,
    functionName: 'balanceOf',
    args: selectedProject?.onChainProjectId
      ? [address as `0x${string}`, BigInt(selectedProject.onChainProjectId)]
      : undefined,
    query: { enabled: !!selectedProject?.onChainProjectId },
  });

  // Đọc approval
  const { data: isApproved, refetch: refetchApproval } = useReadContract({
    ...creditContract,
    functionName: 'isApprovedForAll',
    args: [address as `0x${string}`, marketplaceContract.address],
    query: { enabled: !!address },
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [step, setStep] = useState<'form' | 'approving' | 'listing' | 'done'>('form');

  const handleSell = async () => {
    if (!selectedProject?.onChainProjectId) { setError('Dự án chưa có onChainProjectId'); return; }
    if (!amount || Number(amount) <= 0) { setError('Vui lòng nhập số lượng'); return; }
    if (!price || Number(price) <= 0) { setError('Vui lòng nhập giá'); return; }
    if (tokenBalance !== undefined && BigInt(amount) > tokenBalance) {
      setError(`Số dư không đủ (có ${tokenBalance.toString()} token)`);
      return;
    }
    setError('');

    try {
      // Bước 1: Approve nếu chưa
      if (!isApproved) {
        setStep('approving');
        await writeContractAsync({
          ...creditContract,
          functionName: 'setApprovalForAll',
          args: [marketplaceContract.address, true],
          gas: GAS_LIMITS.setApprovalForAll,
        });
        await refetchApproval();
      }

      // Bước 2: Tạo listing
      setStep('listing');
      const hash = await writeContractAsync({
        ...(marketplaceContract as any),
        functionName: 'createListing',
        args: [
          BigInt(selectedProject.onChainProjectId),
          BigInt(amount),
          parseEther(price),
        ],
        gas: GAS_LIMITS.createListing,
      });
      setTxHash(hash);

      if (publicClient && hash) {
        const receipt = await waitForReceipt(publicClient, hash);
        if (receipt?.status === 'reverted') {
          throw new Error('Giao dịch bị revert trên blockchain');
        }
      }

      setStep('done');
      await onSuccess?.();
    } catch (e: any) {
      setError(e?.message || 'Có lỗi xảy ra');
      setStep('form');
    }
  };

  if (step === 'approving') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-6xl mb-6 animate-pulse">🔐</div>
        <h2 className="text-2xl font-bold text-white mb-4">Đang cấp quyền...</h2>
        <p className="text-gray-400">Xác nhận approve trong MetaMask</p>
      </div>
    );
  }

  if (step === 'listing') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-6xl mb-6 animate-bounce">📋</div>
        <h2 className="text-2xl font-bold text-white mb-4">Đang tạo listing...</h2>
        <p className="text-gray-400">Xác nhận giao dịch trong MetaMask</p>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-4">Tạo listing thành công!</h2>
        <p className="text-gray-400 mb-6">
          Token của bạn đã được niêm yết trên marketplace.
        </p>
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6 text-left space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Dự án</span>
            <span className="text-white">{selectedProject?.projectName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Số lượng</span>
            <span className="text-green-400 font-bold">{amount} token</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Giá / token</span>
            <span className="text-white">{price} ETH</span>
          </div>
          {txHash && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">TX Hash</span>
              <button
                onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}
                className="text-blue-400 hover:text-blue-300 text-xs font-mono"
              >
                {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
              </button>
            </div>
          )}
        </div>
        <button
          onClick={() => { setStep('form'); setAmount(''); setPrice(''); }}
          className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all"
        >
          Tạo listing khác
        </button>
      </div>
    );
  }

  // Lọc project của ví hiện tại
  const myProjects = projects.filter(
    (p) => p.ownerWallet?.toLowerCase() === address?.toLowerCase() && p.onChainProjectId
  );

  if (myProjects.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
        <div className="text-5xl mb-4">📭</div>
        <p className="mb-2">Bạn chưa có dự án nào được duyệt</p>
        <p className="text-sm">Đăng ký dự án và chờ Admin phê duyệt trước</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6">
          <p className="text-red-400 text-sm">❌ {error}</p>
        </div>
      )}
  
      <div className="bg-white/3 border border-white/10 rounded-2xl p-8 space-y-6">
        <h2 className="text-xl font-bold text-white">Tạo listing bán token</h2>

        <div className="space-y-4">
          {/* Chọn dự án */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Chọn dự án của bạn *</label>
            <div className="space-y-2">
              {myProjects.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelectedProject(p)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    selectedProject?._id === p._id
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <p className="text-white font-semibold text-sm">{p.projectName}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    onChain ID: #{p.onChainProjectId} · CO₂: {p.approvedCO2Kg?.toLocaleString()} kg
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Balance token */}
          {selectedProject && (
            <div className="space-y-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Giới hạn token dự án</span>
                  <span className="text-white font-semibold">
                    {selectedProject.approvedCO2Kg != null
                      ? `${selectedProject.approvedCO2Kg.toLocaleString()} token`
                      : '—'}
                  </span>
                </div>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
                <p className="text-green-400 text-sm">
                  💰 Số dư token của bạn:{' '}
                  <span className="font-bold">
                    {tokenBalance !== undefined ? tokenBalance.toString() : '...'} token
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Số lượng */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Số lượng token muốn bán *</label>
            <input
              type="number"
              placeholder="VD: 100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
            />
          </div>

          {/* Giá */}
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Giá mỗi token (ETH) *</label>
            <input
              type="number"
              step="0.001"
              placeholder="VD: 0.001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all"
            />
            {amount && price && (
              <p className="text-gray-500 text-xs mt-2">
                Tổng nhận (sau 2% phí): ~{(Number(amount) * Number(price) * 0.98).toFixed(4)} ETH
              </p>
            )}
          </div>

          {/* Approval status */}
          <div className={`rounded-xl px-4 py-3 text-xs font-medium ${
            isApproved
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
          }`}>
            {isApproved
              ? '✅ Marketplace đã được cấp quyền'
              : '⚠️ Cần approve marketplace (tự động khi bấm tạo listing)'}
          </div>
        </div>

        <button
          onClick={handleSell}
          disabled={!selectedProject || !amount || !price}
          className="w-full bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl text-lg transition-all"
        >
          🏷️ Tạo Listing Bán Token →
        </button>

        <p className="text-gray-600 text-xs text-center">
          Token sẽ được chuyển vào contract marketplace cho đến khi có người mua
        </p>
      </div>
      <WithdrawProceedsCard />
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────
const Dashboard: NextPage = () => {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'overview' | 'upload' | 'sell'>('overview');
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalApprovedProjects: 0,
    totalAvailableCarbon: 0,
    totalRetiredCarbon: 0,
  });
  const [loading, setLoading] = useState(true);

  const refreshProjects = async () => {
    try {
      const data = await getProjects();
      if (data) setProjects(data);
    } catch (e) {
      console.warn('Lỗi tải dự án');
    }
  };

  const refreshTransactions = async () => {
    if (!address) return;
    try {
      const data = await getTransactionHistory(address);
      if (Array.isArray(data)) setTransactions(data);
    } catch (e) {
      console.warn('Lỗi tải lịch sử giao dịch');
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [data, statsData] = await Promise.all([getProjects(), getStats()]);
        if (data) setProjects(data);
        if (statsData) setStats(statsData);
      } catch (e) {
        console.warn('Lỗi tải dự án');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!address) return;
    refreshTransactions();
  }, [address]);

  const statCards = [
    { label: 'Dự án đã duyệt', value: stats.totalApprovedProjects, unit: 'dự án', color: 'text-green-400' },
    { label: 'Carbon khả dụng', value: stats.totalAvailableCarbon.toLocaleString(), unit: 'kg', color: 'text-white' },
    { label: 'CO₂ đã bù đắp', value: stats.totalRetiredCarbon.toLocaleString(), unit: 'kg', color: 'text-green-400' },
    { label: 'Giao dịch', value: transactions.length, unit: 'tx', color: 'text-white' },
  ];

  return (
    <>
      <Head><title>Dashboard — CarboX</title></Head>

      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">
              Project <span className="text-green-400">Dashboard</span>
            </h1>
            <p className="text-gray-400">
              {isConnected
                ? `Ví: ${address?.slice(0, 6)}...${address?.slice(-4)}`
                : 'Kết nối ví để xem dữ liệu của bạn'}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap justify-end">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'overview'
                  ? 'bg-green-500 text-black'
                  : 'border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              Tổng quan
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'sell'
                  ? 'bg-green-500 text-black'
                  : 'border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              🏷️ Bán token
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'upload'
                  ? 'bg-green-500 text-black'
                  : 'border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              + Đăng ký dự án
            </button>
          </div>
        </div>

        {/* Tab Overview */}
        {activeTab === 'overview' && (
          <div className="space-y-8">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statCards.map((s) => (
                <div key={s.label} className="bg-white/3 border border-white/10 rounded-2xl p-6">
                  <p className="text-gray-400 text-sm mb-2">{s.label}</p>
                  <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-gray-600 text-xs mt-1">{s.unit}</p>
                </div>
              ))}
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-4">Dự án đã được duyệt</h2>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
                </div>
              ) : projects.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
                  Chưa có dự án nào được duyệt
                </div>
              ) : (
                <div className="space-y-4">
                  {projects.map((p) => (
                    <div key={p._id} className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-green-500/30 transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-white font-bold text-lg">{p.projectName}</h3>
                          <p className="text-gray-500 text-sm font-mono">
                            {p.ownerWallet?.slice(0, 6)}...{p.ownerWallet?.slice(-4)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                            ✅ Đã duyệt
                          </span>
                          {/* Nút bán nhanh nếu là dự án của mình */}
                          {p.ownerWallet?.toLowerCase() === address?.toLowerCase() && (
                            <button
                              onClick={() => setActiveTab('sell')}
                              className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-all"
                            >
                              🏷️ Bán
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 text-xs">Token được duyệt</p>
                          <p className="text-white font-semibold">{p.totalCarbon?.toLocaleString()} kg</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">CO₂ đã duyệt</p>
                          <p className="text-green-400 font-semibold">
                            {p.approvedCO2Kg ? `${p.approvedCO2Kg.toLocaleString()} kg` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Token đang bán</p>
                          <p className="text-white font-semibold">
                            {(p.listedTokens ?? 0).toLocaleString()} token
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Token đã bán</p>
                          <p className="text-white font-semibold">
                            {(p.soldTokens ?? 0).toLocaleString()} token
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">onChain ID</p>
                          <p className="text-green-400 font-semibold">
                            {p.onChainProjectId ? `#${p.onChainProjectId}` : '—'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${p.ipfsHash?.replace('ipfs://', '')}`, '_blank')}
                          className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                        >
                          📄 Xem IPFS ↗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isConnected && (
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Lịch sử giao dịch của bạn</h2>
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
                    Chưa có giao dịch nào
                  </div>
                ) : (
                  <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
                    {transactions.map((tx, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all">
                        <div>
                          <p className="text-white font-semibold text-sm">{tx.transactionType}</p>
                          <p className="text-gray-500 text-xs font-mono">{tx.txHash?.slice(0, 10)}...{tx.txHash?.slice(-8)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-green-400 font-bold">{tx.amount} token</p>
                          <p className="text-gray-500 text-xs">Block #{tx.blockNumber}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-400 text-xs">
                            {new Date(tx.timestamp).toLocaleDateString('vi-VN')}
                          </p>
                          <button
                            onClick={() => window.open(`https://sepolia.etherscan.io/tx/${tx.txHash}`, '_blank')}
                            className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                          >
                            Xem TX ↗
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab Bán token */}
        {activeTab === 'sell' && (
          isConnected && address
            ? <SellForm address={address} projects={projects} onSuccess={refreshProjects} />
            : <div className="text-center py-20 text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl">
                ⚠️ Vui lòng kết nối ví để tạo listing
              </div>
        )}

        {/* Tab Upload */}
        {activeTab === 'upload' && (
          <UploadForm address={address} isConnected={isConnected} onSuccess={refreshProjects} />
        )}

      </div>
    </>
  );
};

// ── Upload Form ───────────────────────────────────────────────
const UploadForm = ({
  address,
  isConnected,
  onSuccess,
}: {
  address: string | undefined;
  isConnected: boolean;
  onSuccess?: () => Promise<void> | void;
}) => {
  const [status, setStatus] = useState<'form' | 'uploading' | 'submitting' | 'pending'>('form');
  const [error, setError] = useState('');
  const [ipfsHash, setIpfsHash] = useState('');
  const [txHash, setTxHash] = useState('');
  const [fileName, setFileName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({ name: '', co2: '', standard: 'VCS' });
  const { submit, isPending } = useSubmitProject();

  const handleSubmit = async () => {
    if (!isConnected || !address) { setError('Vui lòng kết nối ví trước'); return; }
    if (!file) { setError('Vui lòng upload file PDF'); return; }
    if (!formData.name) { setError('Vui lòng nhập tên dự án'); return; }
    if (!formData.co2) { setError('Vui lòng nhập lượng CO₂'); return; }
    setError('');
    try {
      setStatus('uploading');
      const { ipfsHash: hash } = await uploadToIPFS(file);
      setIpfsHash(hash);
      
      // FIX: Tạo project trong MongoDB TRƯỚC submitProject
      // Để listener chỉ cần UPDATE với onChainProjectId, không CREATE mới
      setStatus('submitting');
      await createProject({ projectName: formData.name, ownerWallet: address, ipfsHash: hash, totalCarbon: Number(formData.co2) });
      
      // Sau đó ghi lên blockchain
      const txh = await submit(hash, BigInt(Number(formData.co2)));
      setTxHash(txh);
      
      await onSuccess?.();
      setStatus('pending');
    } catch (e: any) {
      setError(e?.message || 'Có lỗi xảy ra');
      setStatus('form');
    }
  };

  if (status === 'uploading') return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-6xl mb-6 animate-pulse">📤</div>
      <h2 className="text-2xl font-bold text-white mb-4">Đang upload lên IPFS...</h2>
      <p className="text-gray-400">Pinata đang xử lý file PDF của bạn</p>
    </div>
  );

  if (status === 'submitting') return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-6xl mb-6 animate-bounce">⛓️</div>
      <h2 className="text-2xl font-bold text-white mb-4">Đang ghi lên blockchain...</h2>
      <p className="text-gray-400">Xác nhận giao dịch trong ví MetaMask</p>
      {ipfsHash && <p className="text-green-400 text-sm mt-4 font-mono">IPFS: {ipfsHash.slice(0, 30)}...</p>}
    </div>
  );

  if (status === 'pending') return (
    <div className="max-w-lg mx-auto text-center py-20">
      <div className="text-6xl mb-6">⏳</div>
      <h2 className="text-2xl font-bold text-white mb-4">Đang chờ phê duyệt</h2>
      <p className="text-gray-400 mb-6">Hồ sơ đã được ghi lên blockchain. Validator sẽ xem xét trong 1-3 ngày.</p>
      <div className="bg-white/3 border border-white/10 rounded-2xl p-6 text-left space-y-3 mb-6">
        <div className="flex justify-between text-sm"><span className="text-gray-400">Tên dự án</span><span className="text-white">{formData.name}</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-400">CO₂ đề xuất</span><span className="text-green-400">{formData.co2} kg</span></div>
        <div className="flex justify-between text-sm"><span className="text-gray-400">Trạng thái</span><span className="text-yellow-400">⏳ Pending</span></div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">TX Hash</span>
          <button onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')} className="text-blue-400 hover:text-blue-300 text-xs font-mono">
            {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
          </button>
        </div>
      </div>
      <button onClick={() => { setStatus('form'); setFile(null); setFileName(''); setFormData({ name: '', co2: '', standard: 'VCS' }); }}
        className="bg-green-500 hover:bg-green-400 text-black font-bold px-8 py-3 rounded-xl transition-all">
        Đăng ký thêm
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {!isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6 text-center">
          <p className="text-yellow-400 font-semibold">⚠️ Vui lòng kết nối ví để đăng ký dự án</p>
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6">
          <p className="text-red-400 text-sm">❌ {error}</p>
        </div>
      )}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-8 space-y-6">
        <h2 className="text-xl font-bold text-white">Thông tin dự án</h2>
        <div className="space-y-4">
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Tên dự án *</label>
            <input type="text" placeholder="VD: Rừng ngập mặn Cần Giờ" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all" />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Lượng CO₂ đề xuất (kg) *</label>
            <input type="number" placeholder="VD: 10000" value={formData.co2}
              onChange={(e) => setFormData({ ...formData, co2: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-all" />
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Tiêu chuẩn chứng nhận</label>
            <select value={formData.standard} onChange={(e) => setFormData({ ...formData, standard: e.target.value })}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-all"
              style={{ backgroundColor: '#111811' }}>
              <option value="VCS" style={{ backgroundColor: '#111811' }}>VCS</option>
              <option value="GS" style={{ backgroundColor: '#111811' }}>GS</option>
              <option value="CDM" style={{ backgroundColor: '#111811' }}>CDM</option>
              <option value="GCC" style={{ backgroundColor: '#111811' }}>GCC</option>
              <option value="REC" style={{ backgroundColor: '#111811' }}>REC</option>
            </select>
          </div>
          <div>
            <label className="text-gray-400 text-sm mb-2 block">Báo cáo thẩm định (PDF) *</label>
            <div className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center hover:border-green-500/50 transition-all">
              <input type="file" accept=".pdf" className="hidden" id="pdf-upload"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); setFileName(f.name); } }} />
              <label htmlFor="pdf-upload" className="cursor-pointer">
                <div className="text-4xl mb-3">📄</div>
                {fileName ? <p className="text-green-400 font-semibold">{fileName}</p> : (
                  <><p className="text-gray-400 mb-2">Kéo thả file PDF vào đây</p><p className="text-green-400 text-sm font-semibold">hoặc bấm để chọn file</p></>
                )}
                <p className="text-gray-600 text-xs mt-2">File sẽ được upload lên IPFS qua Pinata</p>
              </label>
            </div>
          </div>
        </div>
        <button onClick={handleSubmit} disabled={!isConnected || !formData.name || !formData.co2 || !file || isPending}
          className="w-full bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl text-lg transition-all">
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              Đang xử lý...
            </span>
          ) : 'Gửi yêu cầu Mint Token →'}
        </button>
        <p className="text-gray-600 text-xs text-center">Quy trình: Upload PDF → IPFS → Ghi lên blockchain → Validator xét duyệt</p>
      </div>
    </div>
  );
};

export default Dashboard;
