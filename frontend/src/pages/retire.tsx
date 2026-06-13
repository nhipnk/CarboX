import type { NextPage } from 'next';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getProjects, type Project } from '../lib/api';
import {
  useRetireCredits,
  useIsApproved,
  useApproveMarketplace,
  useCarbonBalance,
} from '../lib/hook';

const Retire: NextPage = () => {
  const { address, isConnected } = useAccount();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [amount, setAmount] = useState(1);
  const [step, setStep] = useState<'form' | 'approving' | 'burning' | 'submitted' | 'timeoutButSubmitted' | 'done'>('form');
  const [txHash, setTxHash] = useState('');
  const [certTokenId, setCertTokenId] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const { retire, isPending: isRetiring } = useRetireCredits();
  const { approve, isPending: isApproving } = useApproveMarketplace();
  const { data: isApproved } = useIsApproved();
  const {
    data: tokenBalance,
    refetch: refetchTokenBalance,
  } = useCarbonBalance(
    selectedProject?.onChainProjectId !== undefined
      ? BigInt(selectedProject.onChainProjectId)
      : BigInt(0)
  );

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getProjects();
        if (data) {
          const active = data.filter((p) => p.status === 'Approved');
          setProjects(active);
          if (active.length > 0) setSelectedProject(active[0]);
        }
      } catch (e) {
        console.warn('Lỗi tải dự án');
      }
    };
    load();
  }, []);

  const totalCO2Kg = amount * 10; // 1 token = 10kg CO2
  const certURI = `Trung hoa carbon tu du an ${selectedProject?.projectName} vao ${new Date().toLocaleDateString('vi-VN')}`;
  const etherscanTxUrl = txHash ? `https://sepolia.etherscan.io/tx/${txHash}` : '';

  const formatErrorMessage = (error: unknown) => {
    if (!error) return 'Giao dịch thất bại';
    if (typeof error === 'string') return error;
    const maybeError = error as any;
    const maybeMessage = String(
      maybeError?.shortMessage ||
      maybeError?.message ||
      maybeError?.reason ||
      maybeError?.cause?.message ||
      ''
    );
    const maybeCode = maybeError?.code ?? maybeError?.cause?.code;

    if (
      maybeCode === 4001 ||
      /user rejected|user denied|request rejected|rejected the request/i.test(maybeMessage)
    ) {
      return 'Ban da huy giao dich trong MetaMask.';
    }

    if (error instanceof Error) return error.message || 'Giao dịch thất bại';
    const err = error as any;
    return (
      err?.reason ||
      err?.data?.message ||
      err?.message ||
      err?.error?.message ||
      JSON.stringify(err) ||
      'Giao dịch thất bại'
    );
  };

  const handleRetire = async () => {
    if (!selectedProject || !isConnected) {
      setError('Vui long chon du an va ket noi vi');
      return;
    }
    setError('');
    setWarning('');
    setTxHash('');

    let submittedRetireHash = '';

    try {
      if (!isApproved) {
        setStep('approving');
        await approve();
      }

      setStep('burning');
      const result = await retire(
        BigInt(selectedProject.onChainProjectId ?? 0),
        BigInt(amount),
        certURI,
        {
          onSubmitted: (hash) => {
            submittedRetireHash = hash;
            setTxHash(hash);
            setStep('submitted');
          },
        }
      );

      submittedRetireHash = result.hash;
      setTxHash(result.hash);

      if (result.status === 'timeout') {
        setError('');
        setWarning(
          'Transaction was submitted, but the app could not fetch the receipt from RPC before timeout. Please check Sepolia Etherscan for final status.'
        );
        setStep('timeoutButSubmitted');
        return;
      }

      if (result.status === 'reverted') {
        setError('Transaction reverted on blockchain.');
        setWarning('');
        setStep('form');
        return;
      }

      setCertTokenId(`#${Math.floor(Math.random() * 9000) + 1000}`);
      setStep('done');

      try {
        await refetchTokenBalance?.();
        const refreshed = await getProjects();
        if (refreshed) {
          const active = refreshed.filter((p) => p.status === 'Approved');
          setProjects(active);
        }
      } catch (refreshError) {
        console.warn('Retire succeeded, but refresh failed', refreshError);
      }
    } catch (e: unknown) {
      console.error(e);
      const submittedHash = (e as any)?.hash || submittedRetireHash;
      if (typeof submittedHash === 'string' && submittedHash) {
        setTxHash(submittedHash);
        setError('');
        setWarning(
          'Transaction was submitted, but the app could not fetch the receipt from RPC before timeout. Please check Sepolia Etherscan for final status.'
        );
        setStep('timeoutButSubmitted');
        return;
      }

      setWarning('');
      setError(formatErrorMessage(e));
      setStep('form');
    }
  };
  // Màn hình Approving
  if (step === 'approving') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-8xl mb-8 animate-pulse">🔐</div>
        <h2 className="text-3xl font-bold text-white mb-4">Đang xin phép...</h2>
        <p className="text-gray-400 mb-8">Xác nhận giao dịch Approve trong ví MetaMask</p>
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  // Màn hình Burning
  if (step === 'burning') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-8xl mb-8 animate-bounce">🔥</div>
        <h2 className="text-3xl font-bold text-white mb-4">Đang đốt token...</h2>
        <p className="text-gray-400 mb-8">
          {txHash
            ? 'Transaction submitted. Waiting for one Sepolia receipt confirmation...'
            : 'Dang cho ban xac nhan giao dich trong MetaMask...'}
        </p>
        {txHash ? (
          <button
            onClick={() => window.open(etherscanTxUrl, '_blank')}
            className="mb-8 text-blue-400 hover:text-blue-300 text-sm font-mono transition-all"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)} - Xem tren Etherscan
          </button>
        ) : (
          <p className="text-gray-500 text-sm mb-8">Dang cho ban xac nhan giao dich trong MetaMask...</p>
        )}
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (step === 'submitted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-8xl mb-8 animate-pulse">⏳</div>
        <h2 className="text-3xl font-bold text-white mb-4">Transaction submitted</h2>
        <p className="text-gray-400 mb-8">
          Waiting for one Sepolia receipt confirmation...
        </p>
        {txHash && (
          <button
            onClick={() => window.open(etherscanTxUrl, '_blank')}
            className="mb-8 text-blue-400 hover:text-blue-300 text-sm font-mono transition-all"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)} - Xem tren Etherscan
          </button>
        )}
        <div className="w-64 h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  if (step === 'timeoutButSubmitted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-8xl mb-8">⏳</div>
        <h2 className="text-3xl font-bold text-white mb-4">Transaction submitted</h2>
        <div className="max-w-xl bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5 mb-8">
          <p className="text-yellow-300 text-sm">{warning}</p>
        </div>
        {txHash && (
          <button
            onClick={() => window.open(etherscanTxUrl, '_blank')}
            className="mb-8 text-blue-400 hover:text-blue-300 text-sm font-mono transition-all"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-8)} - Xem tren Etherscan
          </button>
        )}
        <div className="flex flex-wrap justify-center gap-4">
          <button
            onClick={() => { setStep('form'); setWarning(''); }}
            className="border border-white/20 text-gray-400 hover:text-white px-6 py-3 rounded-xl transition-all"
          >
            Quay lai
          </button>
          <button
            onClick={() => {
              setCertTokenId(`#${Math.floor(Math.random() * 9000) + 1000}`);
              setWarning('');
              setStep('done');
            }}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl transition-all"
          >
            I checked Etherscan, continue
          </button>
          {txHash && (
            <button
              onClick={() => window.open(etherscanTxUrl, '_blank')}
              className="border border-white/20 text-gray-400 hover:text-white px-6 py-3 rounded-xl transition-all"
            >
              Xem tren Etherscan
            </button>
          )}
        </div>
      </div>
    );
  }

  // Màn hình Done — Nhận NFT
  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="text-8xl mb-6">🎉</div>
        <h2 className="text-4xl font-black text-white mb-4">
          Chứng nhận <span className="text-green-400">Xanh</span> đã được cấp!
        </h2>
        <p className="text-gray-400 mb-8 text-lg">
          Bạn đã trung hòa thành công{' '}
          <span className="text-green-400 font-bold">{amount} token ({totalCO2Kg} kg CO₂)</span>
        </p>

        {/* NFT Card */}
        <div className="border border-green-500/40 bg-green-500/5 rounded-3xl p-8 max-w-md w-full mb-8">
          <div className="text-6xl mb-4">🌱</div>
          <h3 className="text-white font-bold text-xl mb-1">Carbon Offset Certificate</h3>
          <p className="text-green-400 font-mono text-sm mb-6">
            NFT {certTokenId} — Soulbound Token
          </p>
          <div className="text-left space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Dự án</span>
              <span className="text-white">{selectedProject?.projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Số token đốt</span>
              <span className="text-green-400 font-bold">{amount} token</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CO₂ trung hòa</span>
              <span className="text-green-400 font-bold">{totalCO2Kg} kg</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Ngày</span>
              <span className="text-white">{new Date().toLocaleDateString('vi-VN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">TxHash</span>
              <span className="text-blue-400 font-mono text-xs">
                {txHash.slice(0, 10)}...{txHash.slice(-8)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => { setStep('form'); setAmount(1); setTxHash(''); setWarning(''); }}
            className="border border-white/20 text-gray-400 hover:text-white px-6 py-3 rounded-xl transition-all"
          >
            Retire thêm
          </button>
          <button
            onClick={() => window.open(etherscanTxUrl, '_blank')}
            className="bg-green-500 hover:bg-green-400 text-black font-bold px-6 py-3 rounded-xl transition-all"
          >
            Xem trên Blockchain →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Retire Carbon — CarboX</title>
      </Head>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-3">
            Trung hòa <span className="text-green-400">Carbon</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Đốt token để bù đắp lượng CO₂ và nhận NFT chứng nhận vĩnh viễn trên blockchain.
            Thanh toán bằng <span className="text-green-400 font-semibold">Sepolia ETH</span> (testnet).
          </p>
        </div>

        {!isConnected && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-8 text-center">
            <p className="text-yellow-400 font-semibold">⚠️ Vui lòng kết nối ví để sử dụng tính năng này</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-8">
            <p className="text-red-400 text-sm">❌ {error}</p>
          </div>
        )}

        {error && txHash && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 pb-4 -mt-6 mb-8">
            <button
              onClick={() => window.open(etherscanTxUrl, '_blank')}
              className="text-blue-400 hover:text-blue-300 text-xs font-mono transition-all"
            >
              {txHash.slice(0, 10)}...{txHash.slice(-8)} - Xem tren Etherscan
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Cột trái */}
          <div className="space-y-6">

            {/* Chọn dự án */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-4">1. Chọn dự án</h3>
              {projects.length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có dự án nào được duyệt</p>
              ) : (
                <div className="space-y-3">
                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selectedProject?.id === p.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <p className="text-white font-semibold text-sm">{p.projectName}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        CO₂ đã duyệt: {p.approvedCO2Kg?.toLocaleString()} kg
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Số lượng */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-2">
                2. Số lượng token cần đốt
              </h3>
              {isConnected && tokenBalance !== undefined && (
                <p className="text-gray-500 text-xs mb-3">
                  Số dư của bạn: <span className="text-green-400">{tokenBalance.toString()} token</span>
                </p>
              )}
              <input
                type="number"
                min={1}
                max={isConnected && tokenBalance ? Number(tokenBalance) : 9999}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white text-2xl font-bold text-center focus:outline-none focus:border-green-500 transition-all"
              />
              <input
                type="range"
                min={1}
                max={isConnected && tokenBalance ? Number(tokenBalance) : 100}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-4 accent-green-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1 token</span>
                <span>{isConnected && tokenBalance ? tokenBalance.toString() : '100'} token</span>
              </div>
            </div>
          </div>

          {/* Cột phải */}
          <div className="space-y-6">

            {/* Xác nhận */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-6">3. Xác nhận giao dịch</h3>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Dự án</span>
                  <span className="text-white font-medium">
                    {selectedProject?.projectName || '—'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Số token đốt</span>
                  <span className="text-green-400 font-bold">{amount} token</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">CO₂ trung hòa</span>
                  <span className="text-green-400 font-bold">{totalCO2Kg} kg</span>
                </div>
                <div className="border-t border-white/10 pt-4 flex justify-between">
                  <span className="text-gray-400">Phí gas</span>
                  <span className="text-white text-sm">~0.001 ETH</span>
                </div>
              </div>

              {/* Approve status */}
              {isConnected && (
                <div className={`rounded-xl p-3 mb-4 text-sm ${
                  isApproved
                    ? 'bg-green-500/10 border border-green-500/20'
                    : 'bg-yellow-500/10 border border-yellow-500/20'
                }`}>
                  {isApproved
                    ? <p className="text-green-400">✅ Đã cấp quyền cho Marketplace</p>
                    : <p className="text-yellow-400">⚠️ Cần Approve Marketplace trước (1 lần duy nhất)</p>
                  }
                </div>
              )}

              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
                <p className="text-green-400 text-sm font-medium mb-1">Bạn sẽ nhận được:</p>
                <p className="text-white text-sm">
                  🌱 1 NFT Chứng nhận Carbon (Soulbound — không thể chuyển nhượng)
                </p>
              </div>

              <button
                onClick={handleRetire}
                disabled={!isConnected || !selectedProject || amount <= 0 || isRetiring || isApproving}
                className="w-full bg-green-500 hover:bg-green-400 disabled:bg-white/10 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl text-lg transition-all hover:scale-105"
              >
                {isApproving ? '🔐 Đang Approve...' :
                 isRetiring ? '🔥 Đang đốt token...' :
                 !isConnected ? 'Kết nối ví trước' :
                 `🔥 Retire ${amount} token (${totalCO2Kg} kg CO₂)`}
              </button>
            </div>

            {/* Quy trình */}
            <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-bold mb-3">Quy trình hoạt động</h3>
              <div className="space-y-3">
                {[
                  { icon: '🔐', text: 'Approve Marketplace (1 lần duy nhất)' },
                  { icon: '🔥', text: 'Token bị đốt vĩnh viễn khỏi tổng cung' },
                  { icon: '📜', text: 'NFT Soulbound được đúc vào ví bạn' },
                  { icon: '✅', text: 'Giao dịch ghi vĩnh viễn trên blockchain' },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <span className="text-xl">{item.icon}</span>
                    <span className="text-gray-400 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Retire;
