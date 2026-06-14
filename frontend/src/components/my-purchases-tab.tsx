// ==================== MY PURCHASES TAB ====================
// Component để THÊM vào marketplace.tsx — tab "Giao dịch của tôi"

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useOpenDispute } from '../lib/hook';
import { getTransactionHistory, type Transaction } from '../lib/api';

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

// ── Card cho 1 giao dịch mua (TRANSFER với fromAddress = mình) ────
const PurchaseTxCard = ({
  tx,
  onOpenDispute,
}: {
  tx: Transaction;
  onOpenDispute: (listingId: number) => void;
}) => {
  const hasListingId = tx.listingId !== undefined && tx.listingId !== null;

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">
            Giao dịch mua token{hasListingId ? ` — Listing #${tx.listingId}` : ''}
          </h3>
          <p className="text-gray-500 text-sm font-mono mt-1">
            {tx.txHash?.slice(0, 10)}...{tx.txHash?.slice(-8)}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
          ✅ Bình thường
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-5">
        <div>
          <p className="text-gray-500 text-xs">Số lượng</p>
          <p className="text-green-400 font-semibold">{tx.amount} token</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Block</p>
          <p className="text-white font-semibold">#{tx.blockNumber}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Ngày</p>
          <p className="text-white font-semibold">
            {new Date(tx.timestamp).toLocaleDateString('vi-VN')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => window.open(`https://sepolia.etherscan.io/tx/${tx.txHash}`, '_blank')}
          className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
        >
          🔗 Xem giao dịch ↗
        </button>
        <div className="flex-1" />
        <button
          onClick={() => hasListingId && onOpenDispute(tx.listingId!)}
          disabled={!hasListingId}
          title={!hasListingId ? 'Giao dịch này chưa có Listing ID (dữ liệu cũ)' : undefined}
          className="border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-all"
        >
          ⚠️ Mở tranh chấp
        </button>
      </div>
    </div>
  );
};

// ── Tab nội dung chính ─────────────────────────────────────
export const MyPurchasesTab = () => {
  const { address, isConnected } = useAccount();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [disputeTarget, setDisputeTarget] = useState<{ listingId: bigint } | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const loadPurchases = async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const data = await getTransactionHistory(address);
      // Giao dịch mua: TRANSFER với fromAddress = mình
      const purchases = (Array.isArray(data) ? data : []).filter(
        (tx) =>
          tx.transactionType === 'TRANSFER' &&
          tx.fromAddress?.toLowerCase() === address.toLowerCase()
      );
      setTransactions(purchases);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Lỗi khi tải lịch sử giao dịch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      loadPurchases();
    } else {
      setTransactions([]);
    }
  }, [isConnected, address]);

  const handleDisputeSuccess = () => {
    setDisputeTarget(null);
    showSuccess('⚠️ Đã mở tranh chấp thành công! Validator sẽ xem xét.');
    loadPurchases();
  };

  const handleOpenDispute = (listingId: number) => {
    setDisputeTarget({ listingId: BigInt(listingId) });
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
          listingId={disputeTarget.listingId}
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

      {!loading && transactions.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <div className="text-5xl mb-4">📭</div>
          <p>Bạn chưa mua token nào</p>
        </div>
      )}

      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transactions.map((tx) => (
            <PurchaseTxCard
              key={tx.txHash}
              tx={tx}
              onOpenDispute={handleOpenDispute}
            />
          ))}
        </div>
      )}
    </div>
  );
};
