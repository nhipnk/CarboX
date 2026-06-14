// ==================== ADMIN DISPUTE TAB ====================
import { useState, useEffect } from 'react';
import { useAccount, useReadContract, usePublicClient } from 'wagmi';
import { useResolveDispute } from '../lib/hook';
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

type OpenDisputeItem = {
  listing: ListingInfo;
  dispute: DisputeInfo;
};

// ── Card cho 1 dispute đang mở ──────────────────────────────
const DisputeCard = ({
  item,
  totalValidators,
  isConnected,
  resolvePending,
  onResolve,
}: {
  item: OpenDisputeItem;
  totalValidators: number | null;
  isConnected: boolean;
  resolvePending: boolean;
  onResolve: (listingId: bigint, penalizeSeller: boolean) => void;
}) => {
  const { address } = useAccount();
  const { dispute, listing } = item;

  const { data: hasVotedData } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: 'hasVotedOnDispute',
    args: address ? [dispute.listingId, address as `0x${string}`] : undefined,
    query: { enabled: !!address },
  });

  const hasVoted = Boolean(hasVotedData);

  return (
    <div className="bg-white/3 border border-white/10 rounded-2xl p-6 hover:border-red-500/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-bold text-lg">Listing #{listing.listingId.toString()}</h3>
          <p className="text-gray-500 text-sm font-mono mt-1">
            Người mở: {dispute.initiator.slice(0, 10)}...{dispute.initiator.slice(-8)}
          </p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400">
          ⚠️ Đang mở
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-500 text-xs">Project ID</p>
          <p className="text-white font-semibold">#{listing.projectId.toString()}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Seller</p>
          <p className="text-gray-300 font-mono text-xs">
            {listing.seller.slice(0, 8)}...{listing.seller.slice(-6)}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs">Số phiếu phạt seller</p>
          <p className="text-yellow-400 font-semibold">
            {dispute.votes.toString()}{totalValidators !== null ? ` / ${Math.floor(totalValidators / 2) + 1} cần` : ''}
          </p>
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mb-4 text-sm">
        <p className="text-gray-400 text-xs mb-1">Lý do tranh chấp</p>
        <p className="text-white">{dispute.reason}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => window.open(`https://sepolia.etherscan.io/address/${listing.seller}`, '_blank')}
          className="border border-white/10 text-gray-400 hover:text-white hover:border-white/30 px-4 py-2 rounded-lg text-sm transition-all"
        >
          🔗 Xem ví seller ↗
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onResolve(dispute.listingId, true)}
          disabled={!isConnected || resolvePending || hasVoted}
          className="border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-all"
        >
          {hasVoted ? 'Đã bỏ phiếu' : resolvePending ? 'Đang xử lý...' : '⚖️ Vote phạt Seller'}
        </button>
        <button
          onClick={() => onResolve(dispute.listingId, false)}
          disabled={!isConnected || resolvePending || hasVoted}
          className="border border-green-500/30 text-green-400 hover:bg-green-500/10 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm transition-all"
        >
          {hasVoted ? 'Đã bỏ phiếu' : resolvePending ? 'Đang xử lý...' : '✅ Vote không phạt'}
        </button>
      </div>

      {hasVoted && (
        <p className="text-yellow-300 text-xs mt-3">⚠️ Bạn đã bỏ phiếu cho tranh chấp này rồi.</p>
      )}
    </div>
  );
};

// ── Tab nội dung chính, dùng trong AdminPage ────────────────
export const AdminDisputeTab = () => {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: NETWORK.CHAIN_ID });
  const { resolveDispute, isPending: resolvePending } = useResolveDispute();

  const [items, setItems] = useState<OpenDisputeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data: nextListingIdData, refetch: refetchNextId } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: 'nextListingId',
    query: { enabled: true },
  });

  const { data: totalValidatorsData } = useReadContract({
    address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
    abi: CARBON_MARKETPLACE_ABI,
    functionName: 'getValidatorsCount',
    query: { enabled: true },
  });

  const totalValidators = totalValidatorsData ? Number(totalValidatorsData) : null;

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const loadOpenDisputes = async () => {
    if (!publicClient || nextListingIdData === undefined) return;

    setLoading(true);
    setError('');
    try {
      const nextId = Number(nextListingIdData);
      console.log('🔍 [AdminDisputeTab] NEXT LISTING ID:', nextId);
      
      if (nextId <= 1) {
        console.warn('⚠️ [AdminDisputeTab] Không có listing nào để check (nextId <= 1)');
        setItems([]);
        setLoading(false);
        return;
      }

      console.log('🔍 [AdminDisputeTab] Sẽ loop từ id=1 đến id=' + (nextId - 1));
      
      const results: OpenDisputeItem[] = [];

      for (let id = 1; id <= nextId - 1; id++) {
        const listingId = BigInt(id);

        let disputeRaw: readonly [bigint, string, string, bigint, boolean];

        try {
          disputeRaw = (await publicClient.readContract({
            address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
            abi: CARBON_MARKETPLACE_ABI,
            functionName: 'disputes',
            args: [listingId],
          })) as readonly [bigint, string, string, bigint, boolean];
        
          console.log(`📋 [AdminDisputeTab] Listing ${id} - dispute.active = ${disputeRaw[4]}`);
        
        } catch (error) {
          console.error(
            `❌ [AdminDisputeTab] Failed to read dispute for listing ${id}:`,
            error
          );
        
          continue;
        }

        const dispute: DisputeInfo = {
          listingId: disputeRaw[0],
          initiator: disputeRaw[1],
          reason: disputeRaw[2],
          votes: disputeRaw[3],
          active: disputeRaw[4],
        };

        if (!dispute.active) {
          console.log(`⏭️ [AdminDisputeTab] Skipping listing ${id}: dispute not active`);
          continue;
        }

        console.log(`✅ [AdminDisputeTab] Found active dispute for listing ${id}:`, dispute);

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

        results.push({ listing, dispute });
      }

      console.log(`🎯 [AdminDisputeTab] Total active disputes found: ${results.length}`);
      setItems(results);
    } catch (e: any) {
      console.error('[AdminDisputeTab] Error loading disputes:', e);
      setError(e?.message || 'Lỗi khi tải dữ liệu tranh chấp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOpenDisputes();
  }, [nextListingIdData]);

  const handleResolve = async (listingId: bigint, penalizeSeller: boolean) => {
    setError('');
    try {
      await resolveDispute(listingId, penalizeSeller);
      showSuccess(
        penalizeSeller
          ? '⚖️ Đã vote phạt seller thành công!'
          : '✅ Đã vote không phạt seller thành công!'
      );
      refetchNextId();
      loadOpenDisputes();
    } catch (e: any) {
      const message = String(e?.message || e || '');
      if (message.toLowerCase().includes('da bo phieu') || message.toLowerCase().includes('already voted')) {
        setError('Bạn đã bỏ phiếu cho tranh chấp này rồi.');
      } else {
        setError(message || 'Lỗi khi xử lý tranh chấp');
      }
    }
  };

  return (
    <div>
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
          <div className="w-8 h-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-20 text-gray-500 bg-white/3 border border-white/10 rounded-2xl">
          <div className="text-5xl mb-4">🎉</div>
          <p>Không có tranh chấp nào đang mở</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="space-y-4">
          {items.map((item) => (
            <DisputeCard
              key={item.listing.listingId.toString()}
              item={item}
              totalValidators={totalValidators}
              isConnected={isConnected}
              resolvePending={resolvePending}
              onResolve={handleResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
};
