// ============================================================
// wagmi.ts — Cấu hình Wagmi + RainbowKit cho CarboX
// ============================================================

import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import {
  mainnet,
  polygon,
  optimism,
  arbitrum,
  base,
  sepolia,
} from 'wagmi/chains';
import {
  CONTRACT_ADDRESSES,
  CARBON_MARKETPLACE_ABI,
  CARBON_CREDIT_1155_ABI,
  GREEN_CERTIFICATE_NFT_ABI,
} from './lib/contract';

const getSepoliaRpcUrl = () => {
  const alchemyUrl = process.env.NEXT_PUBLIC_ALCHEMY_URL?.trim();
  if (alchemyUrl?.startsWith('http')) return alchemyUrl;

  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_KEY?.trim();
  if (alchemyKey?.startsWith('http')) return alchemyKey;
  if (alchemyKey) return `https://eth-sepolia.g.alchemy.com/v2/${alchemyKey}`;

  return 'https://eth-sepolia.g.alchemy.com/v2/demo';
};

const SEPOLIA_RPC_URL = getSepoliaRpcUrl();

export const config = getDefaultConfig({
  appName: 'CarboX',
  projectId: 'c0a25badcd57826e0e97b1cd4ed79363',
  appUrl: 'http://localhost:3001',

  chains: [sepolia, mainnet, polygon, optimism, arbitrum, base],

  transports: {
    [sepolia.id]:  http(SEPOLIA_RPC_URL),
    [mainnet.id]:  http('https://eth-mainnet.g.alchemy.com/v2/demo'),
    [polygon.id]:  http('https://polygon-mainnet.g.alchemy.com/v2/demo'),
    [optimism.id]: http('https://opt-mainnet.g.alchemy.com/v2/demo'),
    [arbitrum.id]: http('https://arb-mainnet.g.alchemy.com/v2/demo'),
    [base.id]:     http('https://base-mainnet.g.alchemy.com/v2/demo'),
  },

  ssr: true,
});

export const marketplaceContract = {
  address: CONTRACT_ADDRESSES.CARBON_MARKETPLACE,
  abi: CARBON_MARKETPLACE_ABI,
} as const;

export const creditContract = {
  address: CONTRACT_ADDRESSES.CARBON_CREDIT_1155,
  abi: CARBON_CREDIT_1155_ABI,
} as const;

export const certificateContract = {
  address: CONTRACT_ADDRESSES.GREEN_CERTIFICATE_NFT,
  abi: GREEN_CERTIFICATE_NFT_ABI,
} as const;
