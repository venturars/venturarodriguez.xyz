import type { Network } from "./types";

export const SUPPORTED_NETWORKS: Network[] = [
  {
    name: "Ethereum",
    chainId: 1,
    nativeCurrency: {
      name: "Ethereum",
      symbol: "ETH",
      decimals: 18,
      logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png",
    },
    rpcUrls: "https://eth-mainnet.g.alchemy.com/v2",
    explorerUrl: "https://etherscan.io",
  },
  {
    name: "BaseETH",
    chainId: 8453,
    nativeCurrency: {
      name: "Base",
      symbol: "ETH",
      decimals: 18,
      logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png",
    },
    rpcUrls: "https://base-mainnet.g.alchemy.com/v2",
    explorerUrl: "https://basescan.org",
  },
  {
    name: "Polygon",
    chainId: 137,
    nativeCurrency: {
      name: "Polygon",
      symbol: "MATIC",
      decimals: 18,
      logo: "https://assets.smold.app/api/token/137/0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270/logo-128.png",
    },
    rpcUrls: "https://polygon-mainnet.g.alchemy.com/v2",
    explorerUrl: "https://polygonscan.com",
  },
];

export const SUPPORTED_CHAIN_IDS = Object.values(SUPPORTED_NETWORKS).map(
  (network) => network.chainId,
);

export const ALCHEMY_NETWORKS: Record<Network["chainId"], string> = {
  1: "eth-mainnet",
  8453: "base-mainnet",
  137: "matic-mainnet",
};

/**
 * Network slug for Alchemy Prices API (`/prices/v1/.../tokens/by-address`).
 * Reuses {@link ALCHEMY_NETWORKS} except Polygon (137): Portfolio/Data use `matic-mainnet`,
 * Prices API expects `polygon-mainnet` (same as Alchemy SDK `Network.MATIC_MAINNET`).
 */
export function alchemyPricesNetworkSlug(chainId: Network["chainId"]): string {
  if (chainId === 137) return "polygon-mainnet";
  return ALCHEMY_NETWORKS[chainId];
}

export const SMOL_DAPP_NETWORKS: Record<Network["chainId"], string> = {
  1: "ethereum",
  8453: "base",
  137: "polygon",
};

export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export const TRUST_WALLET_ASSETS_BASE =
  "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";

export const SMOL_TOKEN_ASSETS_BASE = "https://assets.smold.app/api/token";

export const MAX_UINT256: bigint = BigInt(
  "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
);
