// ==================== PROJECT CARD WITH DISPUTE CHECK ====================
// Component để THÊM vào marketplace.tsx — tách card project ra riêng,
// tự đọc disputes(activeListingId) để hiện badge "Đang tranh chấp"

import { useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, CARBON_MARKETPLACE_ABI } from '../lib/contract';
import type { Project } from '../lib/api';

export const ProjectCard = ({
  project,
  isConnected,
  onBuyClick,
}: {
  project: Project;
  isConnected: boolean;
  onBuyClick: (project: Project) => void;
}) => {
  const { data: disputeData } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: 'disputes',
    args: project.activeListingId !== undefined && project.activeListingId !== null
      ? [BigInt(project.activeListingId)]
      : undefined,
    query: {
      enabled: project.activeListingId !== undefined && project.activeListingId !== null,
      refetchInterval: 10000,
    },
  });

  // disputes() trả về tuple (listingId, initiator, reason, votes, active)
  const hasActiveDispute = Array.isArray(disputeData) ? Boolean(disputeData[4]) : false;

  const isSoldOut =
    project.status?.toLowerCase() !== 'approved' ||
    !project.activeListingId ||
    project.listedTokens === 0;

  const isUnavailable = isSoldOut || hasActiveDispute;

  return (
    <div
      key={project.onChainProjectId ?? project._id}
      className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden hover:border-green-500/40 transition-all duration-300 flex flex-col"
    >
      <div className="h-48 bg-gradient-to-br from-green-900/40 to-black flex items-center justify-center relative">
        <span className="text-6xl">🌿</span>
        {isUnavailable && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-bold text-lg border border-white/30 px-4 py-2 rounded-full">
              {hasActiveDispute
                ? '⚠️ Đang tranh chấp'
                : project.status?.toLowerCase() === 'pending'
                ? '⏳ Chờ duyệt'
                : !project.activeListingId || project.listedTokens === 0
                ? 'Không khả dụng'
                : 'Đang bán'}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
          {hasActiveDispute && (
            <span className="bg-red-500/20 border border-red-500/40 rounded-full px-3 py-1">
              <span className="text-red-400 text-xs font-semibold">⚠️ Đang tranh chấp</span>
            </span>
          )}
          <span className="bg-green-500/20 border border-green-500/40 rounded-full px-3 py-1">
            <span className="text-green-400 text-xs font-semibold">
              {project.status?.toLowerCase() === 'approved'
              ? project.activeListingId && project.listedTokens && project.listedTokens > 0
                ? '✅ Đang bán'
                : '✅ Đã duyệt'
              : '⏳ Pending'}
            </span>
          </span>
        </div>
      </div>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-white font-bold text-lg mb-1">{project.projectName}</h3>
        <p className="text-gray-500 text-sm mb-3">
          📍 {project.ownerWallet?.slice(0, 6)}...{project.ownerWallet?.slice(-4)}
        </p>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-400 mb-2">
            <span>Token đã duyệt</span>
            <span>{project.totalCarbon?.toLocaleString()} kg</span>
          </div>
          {project.approvedCO2Kg && (
            <div className="flex justify-between text-xs text-gray-400">
              <span>CO₂ đã duyệt</span>
              <span className="text-green-400">{project.approvedCO2Kg?.toLocaleString()} kg</span>
            </div>
          )}
          {project.listedTokens !== undefined && (
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Token đang bán</span>
              <span className="text-white">{project.listedTokens.toLocaleString()} token</span>
            </div>
          )}
          {project.soldTokens !== undefined && (
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Token đã bán</span>
              <span className="text-white">{project.soldTokens.toLocaleString()} token</span>
            </div>
          )}
          {project.pricePerCredit && (
            <div className="flex justify-between text-xs text-gray-400 mt-2">
              <span>Giá listing</span>
              <span className="text-green-400">{project.pricePerCredit} ETH</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-auto">
          <div>
            <p className="text-gray-400 text-xs">Giá / token</p>
            <p className="text-green-400 font-bold text-xl">
              {project.pricePerCredit || '0.001'} ETH
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const cid = project.ipfsHash?.replace('ipfs://', '') || project.ipfsHash;
                window.open(`https://gateway.pinata.cloud/ipfs/${cid}`, '_blank');
              }}
              className="border border-white/20 hover:border-white/40 text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm transition-all"
            >
              📄 IPFS
            </button>
            <button
              disabled={isUnavailable || !isConnected || !project.activeListingId || project.listedTokens === 0}
              onClick={() => onBuyClick(project)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isUnavailable || !isConnected
                  ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-400 text-black'
              }`}
            >
              {!isConnected
                ? 'Kết nối ví'
                : hasActiveDispute
                ? 'Đang tranh chấp'
                : isSoldOut
                ? 'N/A'
                : 'Mua Token'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
