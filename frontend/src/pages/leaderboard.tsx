import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, type LeaderboardEntry } from '../lib/api';

const medals = ['🥇', '🥈', '🥉'];

const Leaderboard: NextPage = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const data = await getLeaderboard();
        if (Array.isArray(data?.leaderboard)) setEntries(data.leaderboard);
      } catch (e) {
        setError('Khong the tai leaderboard. Vui long thu lai.');
        console.warn('Lỗi tải leaderboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const refreshLeaderboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    try {
      setError('');
      const data = await getLeaderboard();
      if (Array.isArray(data?.leaderboard)) setEntries(data.leaderboard);
    } catch (e) {
      console.warn('Loi tai leaderboard', e);
      setError('Khong the tai leaderboard. Vui long thu lai.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshLeaderboard(false);
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [refreshLeaderboard]);

  return (
    <>
      <Head>
        <title>Leaderboard — CarboX</title>
      </Head>

      <div className="max-w-4xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-white mb-3">
            🏆 Bảng xếp hạng <span className="text-green-400">Xanh</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Các ví đã trung hòa carbon nhiều nhất — minh bạch 100% on-chain
          </p>
          <button
            onClick={() => refreshLeaderboard(true)}
            className="mt-5 border border-green-500/50 hover:border-green-400 text-green-400 font-semibold px-5 py-2 rounded-xl text-sm transition-all hover:bg-green-500/10"
          >
            Refresh
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 rounded-full border-2 border-green-500 border-t-transparent animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-8 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && entries.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg">Chưa có dữ liệu</p>
            <p className="text-sm mt-2">Hãy là người đầu tiên trung hòa carbon!</p>
          </div>
        )}

        {!loading && entries.length > 0 && (
          <>
            {/* Top 3 */}
            {entries.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-10">
                {entries.slice(0, 3).map((item, index) => (
                  <div
                    key={item.parentWalletAddress}
                    className={`border rounded-2xl p-6 text-center transition-all ${
                      index === 0
                        ? 'border-yellow-500/50 bg-yellow-500/5'
                        : index === 1
                        ? 'border-gray-400/50 bg-gray-400/5'
                        : 'border-orange-600/50 bg-orange-600/5'
                    }`}
                  >
                    <div className="text-4xl mb-3">{medals[index]}</div>
                    <p className="text-white font-bold text-sm mb-1 font-mono">
                      {item.parentWalletAddress.slice(0, 6)}...{item.parentWalletAddress.slice(-4)}
                    </p>
                    <p className="text-green-400 font-black text-2xl">
                      {item.totalRetired.toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-xs">kg CO2 retired</p>
                  </div>
                ))}
              </div>
            )}

            {/* Bảng đầy đủ */}
            <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/10 text-xs text-gray-500 font-semibold uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Địa chỉ ví</div>
                <div className="col-span-3 text-right">Đã Retire</div>
                <div className="col-span-3 text-right">TX</div>
              </div>

              {entries.map((item, index) => (
                <div
                  key={item.parentWalletAddress}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/5 hover:bg-white/3 transition-all items-center"
                >
                  <div className="col-span-1 text-gray-400 font-bold">
                    {index < 3 ? medals[index] : index + 1}
                  </div>
                  <div className="col-span-5">
                    <p className="text-white font-mono text-sm">
                      {item.parentWalletAddress.slice(0, 8)}...{item.parentWalletAddress.slice(-6)}
                    </p>
                  </div>
                  <div className="col-span-3 text-right">
                    <p className="text-green-400 font-bold">
                      {item.totalRetired.toLocaleString()}
                    </p>
                    <p className="text-gray-600 text-xs">kg CO2</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-gray-400 text-sm">—</p>
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      onClick={() => window.open(`https://sepolia.etherscan.io/address/${item.parentWalletAddress}`, '_blank')}
                      className="text-blue-400 hover:text-blue-300 text-xs transition-all"
                    >
                      ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Ghi chú */}
            <p className="text-center text-gray-600 text-sm mt-6">
              Tất cả giao dịch có thể xác minh trên{' '}
              <button
                onClick={() => window.open('https://sepolia.etherscan.io/address/0xBb1d739d98dAe76DD1E95e4A978Fd1E4b525ABa4', '_blank')}
                className="text-blue-400 hover:text-blue-300 transition-all"
              >
                Sepolia Etherscan ↗
              </button>
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default Leaderboard;
