// ==================== WITHDRAW PROCEEDS CARD ====================
// Component để THÊM vào dashboard.tsx, render trong SellForm

import { useState } from 'react';
import { formatEther } from 'viem';
import { useSellerBalance, useWithdrawProceeds } from '../lib/hook';

export const WithdrawProceedsCard = () => {
  const { data: balanceData, refetch } = useSellerBalance();
  const { withdraw, isPending } = useWithdrawProceeds();
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [txHash, setTxHash] = useState('');

  const balance = balanceData ? (balanceData as bigint) : BigInt(0);
  const hasBalance = balance > BigInt(0);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const handleWithdraw = async () => {
    setError('');
    try {
      const hash = await withdraw();
      setTxHash(hash);
      showSuccess('✅ Đã rút tiền về ví thành công!');
      refetch();
    } catch (e: any) {
      setError(e?.message || 'Lỗi khi rút tiền');
    }
  };

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-8 space-y-4">
      <h2 className="text-xl font-bold text-white">💰 Rút tiền bán hàng</h2>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm">
          {successMsg}
          {txHash && (
            <button
              onClick={() => window.open(`https://sepolia.etherscan.io/tx/${txHash}`, '_blank')}
              className="text-blue-400 hover:text-blue-300 text-xs ml-2"
            >
              Xem TX ↗
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          ⚠️ {error}
        </div>
      )}

      <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
        <p className="text-gray-400 text-sm mb-1">Số dư đang chờ rút</p>
        <p className="text-green-400 text-2xl font-black">
          {formatEther(balance)} ETH
        </p>
      </div>

      <button
        onClick={handleWithdraw}
        disabled={!hasBalance || isPending}
        className="w-full bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl text-lg transition-all"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            Đang xử lý...
          </span>
        ) : hasBalance ? (
          '💸 Rút tiền về ví →'
        ) : (
          'Chưa có số dư để rút'
        )}
      </button>

      <p className="text-gray-600 text-xs text-center">
        Số dư này được tích lũy từ các giao dịch bán token thành công (sau khi trừ phí platform)
      </p>
    </div>
  );
};
