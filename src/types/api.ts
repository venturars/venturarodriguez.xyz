import type { Address } from "viem";
import type { TokenWithChainId, TokenWithDetails } from "cooperative";

export type ResolveTokenDetails = (
  chainId: number,
  address: Address,
) => Promise<TokenWithDetails>;

export interface AlchemyToken {
  network: string;
  address: string;
  tokenAddress: string | null;
  tokenBalance: string;
  tokenMetadata?: {
    decimals?: number;
    logo?: string;
    name?: string;
    symbol?: string;
  };
  tokenPrices?: Array<{
    currency: string;
    value: string;
    lastUpdatedAt: string;
  }>;
}

export interface AlchemyTokensByAddressResponse {
  data: {
    tokens: AlchemyToken[];
    pageKey?: string;
  };
}

export interface AlchemyGetTokenMetadataResult {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface AlchemyTokenPriceEntry {
  currency: string;
  value: string;
  lastUpdatedAt: string;
}

export interface AlchemyPricesByAddressResponse {
  data: Array<{
    network: string;
    address: string;
    prices: AlchemyTokenPriceEntry[];
    error: { message: string } | null;
  }>;
}

export interface AlchemyPricesBySymbolResponse {
  data: Array<{
    symbol: string;
    prices: AlchemyTokenPriceEntry[];
    error: { message: string } | null;
  }>;
}

export interface UniswapTokenListToken {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  extensions?: Record<string, unknown>;
}

export interface UniswapTokenListJson {
  name: string;
  timestamp: string;
  version: { major: number; minor: number; patch: number };
  tokens: UniswapTokenListToken[];
}

export interface UniswapTokenListCachedPayload {
  fetchedAt: number;
  tokens: TokenWithChainId[];
}

export interface BlockscoutTokenItem {
  address_hash: string;
  bridge_type: "omni" | "amb" | null;
  circulating_market_cap: string | null;
  decimals: string | null;
  exchange_rate: string | null;
  foreign_address: string | null;
  holders_count: string | null;
  icon_url: string | null;
  name: string | null;
  origin_chain_id: string | null;
  reputation: "ok" | "scam" | null;
  symbol: string | null;
  total_supply: string | null;
  type: "ERC-20" | "ERC-721" | "ERC-1155" | "ERC-404" | "ERC-7984" | null;
  volume_24h: string | null;
}

export interface BlockscoutTokensNextPageParams {
  contract_address_hash?: string;
  fiat_value?: string;
  holders_count?: number | string;
  is_name_null?: boolean;
  market_cap?: string;
  name?: string;
  items_count?: number;
  [key: string]: unknown;
}

export interface BlockscoutTokensListResponse {
  items: BlockscoutTokenItem[];
  next_page_params: BlockscoutTokensNextPageParams | null;
}

export interface ZeroExFeeEntry {
  amount: string;
  token: string;
  type: "volume" | "gas";
}

export interface ZeroExPriceResponse {
  liquidityAvailable: boolean;
  blockNumber?: string;
  gas?: string | null;
  gasPrice?: string;
  totalNetworkFee?: string | null;
  buyToken?: string;
  sellToken?: string;
  sellAmount?: string;
  buyAmount?: string;
  minBuyAmount?: string;
  allowanceTarget?: string | null;
  issues?: {
    allowance?: {
      spender?: string;
    } | null;
  };
  fees?: {
    integratorFee?: ZeroExFeeEntry | null;
    integratorFees?: ZeroExFeeEntry[] | null;
    zeroExFee?: ZeroExFeeEntry | null;
    gasFee?: ZeroExFeeEntry | null;
  };
}

export interface ZeroExQuoteIssues {
  allowance?: {
    actual?: string;
    spender?: string;
  } | null;
  balance?: {
    token?: string;
    actual?: string;
    expected?: string;
  } | null;
  simulationIncomplete?: boolean;
  invalidSourcesPassed?: string[];
}

export interface ZeroExQuoteRouteFill {
  from: string;
  to: string;
  source: string;
  proportionBps: string;
}

export interface ZeroExQuoteRouteToken {
  address: string;
  symbol: string;
}

export interface ZeroExQuoteRoute {
  fills: ZeroExQuoteRouteFill[];
  tokens: ZeroExQuoteRouteToken[];
}

export interface ZeroExQuoteTokenMetadataSide {
  buyTaxBps: number | null;
  sellTaxBps: number | null;
  transferTaxBps: number | null;
}

export interface ZeroExQuoteTokenMetadata {
  buyToken: ZeroExQuoteTokenMetadataSide;
  sellToken: ZeroExQuoteTokenMetadataSide;
}

export interface ZeroExQuoteTransaction {
  to: string;
  data: string;
  gas?: string | null;
  gasPrice: string;
  value: string;
}

export interface ZeroExQuoteResponse extends ZeroExPriceResponse {
  allowanceTarget?: string | null;
  blockNumber?: string;
  buyAmount?: string;
  buyToken?: string;
  sellAmount?: string;
  sellToken?: string;
  minBuyAmount?: string;
  totalNetworkFee?: string | null;
  issues?: ZeroExQuoteIssues;
  route?: ZeroExQuoteRoute;
  tokenMetadata?: ZeroExQuoteTokenMetadata;
  transaction?: ZeroExQuoteTransaction;
  zid?: string;
}
