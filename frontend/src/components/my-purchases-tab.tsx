// ==================== MY PURCHASES TAB ====================
// Component để THÊM vào marketplace.tsx — tab "Giao dịch của tôi"
// Hướng dẫn tích hợp ở cuối file.

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { useOpenDispute } from '../lib/hook';
import { CONTRACT_ADDRESSES, CARBON_MARKETPLACE_ABI, NETWORK } from '../lib/contract';

type ListingInfo = {
  listingId: bigint;
  projectId: bigint;
  seller: string;
  amount: bigint;
  pricePerUnit: bigint;
  active: boolean;
  createdAt: bigint;
};

type DisputeInfo = {
  listingId: bigint;
  initiator: string;
  reason: string;
  votes: bigint;
  active: boolean;
};

type PurchasedListing = {
  listing: ListingInfo;
  purchasedAmount: bigint;
  dispute: DisputeInfo | null;
};

// ── Modal mở tranh chấp ──────────────────────────────────────
const OpenDisputeModal = ({
  listingId,
  onClose,
  onSuccess,
}: {
  listingId: bigint;
  onClose: () => void;
  onSuccess: () => void;
}) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { openDispute } = useOpenDispute();

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do tranh chấp');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await openDispute(listingId, reason.trim());
      onSuccess();
    } catch (e: any) {
      setError(e?.message || 'Lỗi khi mở tranh chấp');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-[#1a0f0f] border border-white/10 rounded-2xl p-8 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">⚠️ Mở tranh chấp</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl transition-all">×</button>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Listing #{listingId.toString()} — Tranh chấp sẽ được các validator xem xét và bỏ phiếu.
        </p>
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-4">
            ⚠️ {error}
          </div>
        )}
        <div>
          <label className="text-gray-400 text-sm mb-2 block">Lý do tranh chấp</label>
          <textarea
            rows={4}
            placeholder="VD: Người bán không giao đúng số lượng / token không hợp lệ..."
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
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 bg-red-500 hover:bg-red-400 disabled:bg-white/10 disabled:text-gray-500 text-white font-black py-3 rounded-xl transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Đang gửi...
              </span>
            ) : '⚠️ Gửi tranh chấp'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Card cho 1 listing đã mua ─────────────────────────────────
const PurchasedListingCard = ({
  item,
  onOpenDispute,
}: {
  item: PurchasedListing;
  onOpenDispute: (listingId: bigint) => void;
}) => {
  const { listing, purchasedAmount, dispute } = item;
  const hasActiveDispute = dispute?.active === true;

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Listing #{listing.listingId.toString()}</h3>
          <p className="text-gray-500 text-sm font-mono mt-1">
            Seller: {listing.seller.slice(0, 10)}...{listing.seller.slice(-8)}
          </p>
        </div>
        {hasActiveDispute ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
            ⚠️ Đang tranh chấp
          </span>
        ) : (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
            ✅ Bình thường
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-5">
        <div>
          <p className="text-gray-500 text-xs">Project ID</p>
          <p className="text-white font-semibold">#{listing.projectId.toString()}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Bạn đã mua</p>
          <p className="text-green-400 font-semibold">{purchasedAmount.toString()} token</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Giá / token</p>
          <p className="text-white font-semibold">{listing.pricePerUnit.toString()} wei</p>
        </div>
      </div>

      {hasActiveDispute && dispute && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Người mở</span>
            <span className="text-gray-300 font-mono text-xs">
              {dispute.initiator.slice(0, 10)}...{dispute.initiator.slice(-8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Lý do</span>
            <span className="text-white text-right max-w-[60%]">{dispute.reason}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Số phiếu</span>
            <span className="text-yellow-400 font-bold">{dispute.votes.toString()}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.open(`https://sepolia.etherscan.io/address/${listing.seller}`, '_blank')}
          className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
        >
          🔗 Xem ví người bán ↗
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onOpenDispute(listing.listingId)}
          disabled={hasActiveDispute}
          className="border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-all"
        >
          {hasActiveDispute ? 'Đã có tranh chấp' : '⚠️ Mở tranh chấp'}
        </button>
      </div>
    </div>
  );
};

// ── Tab nội dung chính ─────────────────────────────────────
export const MyPurchasesTab = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });

  const [items, setItems] = useState<PurchasedListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [disputeTarget, setDisputeTarget] = useState<bigint | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const { data: nextListingIdData, refetch: refetchNextId } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: 'nextListingId',
    query: { enabled: true },
  });

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const loadPurchasedListings = async () => {
    if (!publicClient || !address || nextListingIdData === undefined) return;

    setLoading(true);
    setError('');
    try {
      const nextId = Number(nextListingIdData);
      const results: PurchasedListing[] = [];

      for (let id = 1; id < nextId; id++) {
        const listingId = BigInt(id);

        const purchasedAmount = (await publicClient.readContract({
          address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
          abi: CARBON_MARKETPLACE_ABI,
          functionName: 'buyerPurchased',
          args: [listingId, address],
        })) as bigint;

        if (purchasedAmount === BigInt(0)) continue;

        const listingRaw = (await publicClient.readContract({
          address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
          abi: CARBON_MARKETPLACE_ABI,
          functionName: 'listings',
          args: [listingId],
        })) as readonly [bigint, bigint, string, bigint, bigint, boolean, bigint];

        const listing: ListingInfo = {
          listingId: listingRaw[0],
          projectId: listingRaw[1],
          seller: listingRaw[2],
          amount: listingRaw[3],
          pricePerUnit: listingRaw[4],
          active: listingRaw[5],
          createdAt: listingRaw[6],
        };

        let dispute: DisputeInfo | null = null;
        try {
          const disputeRaw = (await publicClient.readContract({
            address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
            abi: CARBON_MARKETPLACE_ABI,
            functionName: 'disputes',
            args: [listingId],
          })) as readonly [bigint, string, string, bigint, boolean];

          dispute = {
            listingId: disputeRaw[0],
            initiator: disputeRaw[1],
            reason: disputeRaw[2],
            votes: disputeRaw[3],
            active: disputeRaw[4],
          };
        } catch {
          dispute = null;
        }

        results.push({ listing, purchasedAmount, dispute });
      }

      setItems(results);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Lỗi khi tải dữ liệu giao dịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadPurchasedListings();
    } else {
      setItems([]);
    }
  }, [isConnected, address, nextListingIdData]);

  const handleDisputeSuccess = () => {
    setDisputeTarget(null);
    showSuccess('⚠️ Đã mở tranh chấp thành công! Validator sẽ xem xét.');
    refetchNextId();
    loadPurchasedListings();
  };

  if (!isConnected) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
        <p className="text-yellow-400 font-semibold">⚠️ Vui lòng kết nối ví để xem giao dịch của bạn</p>
      </div>
    );
  }

  return (
    <div>
      {disputeTarget !== null && (
        <OpenDisputeModal
          listingId={disputeTarget}
          onClose={() => setDisputeTarget(null)}
          onSuccess={handleDisputeSuccess}
        />
      )}

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm mb-6">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm mb-6">
          ⚠️ {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">📭</div>
          <p>Bạn chưa mua token từ listing nào</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <PurchasedListingCard
              key={item.listing.listingId.toString()}
              item={item}
              onOpenDispute={(id) => setDisputeTarget(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
