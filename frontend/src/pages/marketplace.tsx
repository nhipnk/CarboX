import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import { getAllProjects, type Project } from '../lib/api';
import { useBuyCredits } from '../lib/hook';
import { marketplaceContract } from '../wagmi';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { MyPurchasesTab } from '../components/my-purchases-tab';
import { ProjectCard } from '../components/project-card';

const Marketplace: NextPage = () => {
  const { address, isConnected } = useAccount();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'pending' | 'mine'>('all');
  const [buyModal, setBuyModal] = useState<Project | null>(null);
  const [buyAmount, setBuyAmount] = useState(1);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState('');

  const { buy, isPending } = useBuyCredits();

  const getPricePerCredit = (project?: Project | null) =>
    project?.pricePerCredit?.toString() ?? '0.001';

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAllProjects();
        if (data) setProjects(data);
      } catch (e) {
        console.warn('Lỗi tải dự án');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const approvedCount = projects.filter((p) => p.status?.toLowerCase() === 'approved').length;
  const pendingCount = projects.filter((p) => p.status?.toLowerCase() === 'pending').length;

  const filtered = projects.filter((p) => {
    const s = p.status?.toLowerCase();
    if (filter === 'active') return s === 'approved' && p.activeListingId && p.listedTokens && p.listedTokens > 0;
    if (filter === 'pending') return s === 'pending';
    return true;
  });


  // Hàm gọi API backend
  const fetchListing = async (listingId: number) => {
    const res = await axios.get(`/api/listings/${listingId}`);
    return res.data;
  };

  // Hook custom để lấy listing từ backend
  const { data: listingOnChain, refetch: refetchListingOnChain } = useQuery({
    queryKey: ['listing', buyModal?.activeListingId],
    queryFn: () => {
      if (!buyModal?.activeListingId) throw new Error("No listingId");
      return fetchListing(buyModal.activeListingId);
    },
    enabled: !!buyModal?.activeListingId,
  });

  const listingAmount = listingOnChain?.amount ?? buyModal?.listedTokens ?? 0;
  const listingPrice = listingOnChain?.pricePerUnit ?? getPricePerCredit(buyModal);
  const listingActive = listingOnChain?.active ?? true;


  const handleBuy = async () => {
    if (!buyModal || !isConnected || buyModal.activeListingId === undefined || buyModal.activeListingId === null) return;
    if (!listingActive) {
      setTxStatus('error');
      return;
    }
    try {
      setTxStatus('pending');
      const pricePerUnit = parseEther(listingPrice);
      const totalPrice = pricePerUnit * BigInt(buyAmount);
      const hash = await buy(
        BigInt(buyModal.activeListingId),
        BigInt(buyAmount),
        totalPrice
      );
      setTxHash(hash);
      const data = await getAllProjects();
      if (data) setProjects(data);
      await refetchListingOnChain?.();
      setTxStatus('success');
    } catch (e) {
      console.error(e);
      setTxStatus('error');
    }
  };

  return (
    <>
      <Head>
        <title>Marketplace — CarboX</title>
      </Head>

      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-3">
            Carbon <span className="text-green-400">Marketplace</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Khám phá và đầu tư vào các dự án giảm phát thải được xác minh trên blockchain
          </p>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-8">
          {[
            { key: 'all', label: `Tất cả (${projects.length})` },
            { key: 'active', label: `🟢 Đang mở (${projects.filter(p => p.status?.toLowerCase() === 'approved').length})` },
            { key: 'pending', label: `⏳ Chờ duyệt (${pendingCount})` },
            { key: 'mine', label: '🧾 Giao dịch của tôi' },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === f.key
                  ? 'bg-green-500 text-black'
                  : 'border border-white/10 text-gray-400 hover:border-green-500/40 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Tab Giao dịch của tôi */}
        {filter === 'mine' && <MyPurchasesTab />}

        {filter !== 'mine' && (
          <>
            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
              </div>
            )}

            {/* Empty */}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-20">
                <p className="text-gray-500 text-lg">Chưa có dự án nào</p>
              </div>
            )}

            {/* Grid dự án */}
            {!loading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((project) => (
                  <ProjectCard
                    key={project.onChainProjectId ?? project._id}
                    project={project}
                    isConnected={isConnected}
                    onBuyClick={(p) => { setBuyModal(p); setTxStatus('idle'); setBuyAmount(1); }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Mua Token */}
      {buyModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-[#111811] border border-white/10 rounded-2xl p-8 max-w-md w-full">

            {txStatus === 'success' ? (
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-white font-bold text-xl mb-2">Mua thành công!</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Bạn đã mua <span className="text-green-400 font-bold">{buyAmount} token</span> carbon
                </p>
                <button
                  onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}
                  className="text-blue-400 hover:text-blue-300 text-sm mb-4 block mx-auto"
                >
                  Xem giao dịch ↗
                </button>
                <button
                  onClick={() => setBuyModal(null)}
                  className="w-full bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-xl transition-all"
                >
                  Đóng
                </button>
              </div>
            ) : txStatus === 'error' ? (
              <div className="text-center">
                <div className="text-6xl mb-4">❌</div>
                <h3 className="text-white font-bold text-xl mb-2">Giao dịch thất bại</h3>
                <p className="text-gray-400 text-sm mb-6">Vui lòng thử lại</p>
                <button
                  onClick={() => setTxStatus('idle')}
                  className="w-full border border-white/20 text-gray-400 font-bold py-3 rounded-xl"
                >
                  Thử lại
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-white font-bold text-xl mb-6">
                  Mua Token — <span className="text-green-400">{buyModal.projectName}</span>
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Dự án</span>
                    <span className="text-white">{buyModal.projectName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Giá / token</span>
                    <span className="text-white">{listingPrice} ETH</span>
                  </div>
                  {listingOnChain && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Listing trạng thái</span>
                      <span>{listingActive ? 'Đang mở' : 'Đã đóng'}</span>
                    </div>
                  )}
                  {listingOnChain && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Token còn lại</span>
                      <span>{listingAmount}</span>
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="text-gray-400 text-sm mb-2 block">Số lượng token</label>
                  <input
                    type="number"
                    min={1}
                    max={listingAmount || undefined}
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-xl font-bold text-center focus:outline-none focus:border-green-500 transition-all"
                  />
                  {listingOnChain && !listingActive && (
                    <p className="text-red-400 text-xs mt-2">Listing này đã không còn hoạt động, vui lòng chọn dự án khác.</p>
                  )}
                </div>

                <div className="border-t border-white/10 pt-4 mb-6 flex justify-between">
                  <span className="text-gray-400">Tổng thanh toán</span>
                  <span className="text-green-400 font-black text-xl">
                    {(buyAmount * parseFloat(listingPrice)).toFixed(4)} ETH
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setBuyModal(null)}
                    className="flex-1 border border-white/20 text-gray-400 py-3 rounded-xl transition-all hover:border-white/40"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleBuy}
                    disabled={
                      isPending ||
                      txStatus === 'pending' ||
                      !listingActive ||
                      !listingAmount ||
                      buyAmount < 1 ||
                      buyAmount > listingAmount
                    }
                    className="flex-1 bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 text-black font-bold py-3 rounded-xl transition-all"
                  >
                    {isPending || txStatus === 'pending' ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        Đang xử lý...
                      </span>
                    ) : (
                      'Xác nhận mua'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Marketplace;
