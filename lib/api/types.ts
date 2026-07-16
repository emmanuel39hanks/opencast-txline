/**
 * Backend response DTOs — kept in sync (by convention) with the NestJS layer.
 * Only includes fields the UI actually reads. If backend drifts, TS will yell
 * at consumers and we update both ends.
 *
 * These shapes are a best-effort mirror of the Prisma models from
 * /docs/backend.md. Where the backend isn't yet wired, the UI uses the same
 * client types as placeholders — the API client normalises to these shapes.
 */

import type {
  AIDecisionLog as FrontendAIDecisionLog,
  Adapter as FrontendAdapter,
  Alert as FrontendAlert,
  Dispute as FrontendDispute,
  DraftResult as FrontendDraftResult,
  Holder as FrontendHolder,
  Market as FrontendMarket,
  MarketCategory as FrontendMarketCategory,
  MarketFilters,
  Position as FrontendPosition,
  Trade as FrontendTrade,
  User as FrontendUser,
} from "@/lib/types";

export type Market = FrontendMarket;
export type Trade = FrontendTrade;
export type Holder = FrontendHolder;
export type Dispute = FrontendDispute;
export type AIDecisionLog = FrontendAIDecisionLog;
export type Adapter = FrontendAdapter;
export type User = FrontendUser;
export type Position = FrontendPosition;
export type Alert = FrontendAlert;
export type DraftResult = FrontendDraftResult;
export type MarketCategory = FrontendMarketCategory;

export type { MarketFilters };

/**
 * Response from POST /markets — backend prepares unsigned createMarket
 * calldata the user's wallet must sign.
 */
export interface CreateMarketCalldata {
  to: `0x${string}`;
  chainId: number;
  /** MarketConfig tuple serialised as raw args (matches MarketFactory.createMarket). */
  args: {
    cfg: {
      question: string;
      questionHash: `0x${string}`;
      startTime: string | number;
      endTime: string | number;
      disputeWindow: number;
      lmsrB: string;
      adapterId: `0x${string}`;
      source: 0 | 1 | 2;
    };
    initialLiquidity: string; // 6-dec USDC units, stringified
    hint: {
      ttl: string | number;
      sig: `0x${string}`;
    };
  };
  /** Pre-commit DB id for the draft — backend uses this to reconcile the tx hash. */
  draftId?: string;
  /** USDC approval required? amount in 6-dec units, stringified. */
  approvalRequired?: {
    token: `0x${string}`;
    spender: `0x${string}`;
    amount: string;
  };
  /**
   * Id the factory will assign to the new market (read from `nextMarketId`
   * on the contract at request time). Used by the frontend to redirect
   * without having to parse event logs.
   */
  expectedMarketId?: number;
}

/**
 * Response from POST /markets/:id/dispute — backend pins evidence and prepares
 * the unsigned Market.dispute(evidenceURI) call.
 */
export interface DisputeCalldata {
  to: `0x${string}`;
  chainId: number;
  evidenceURI: string;
  bondUsdc: string; // 6-dec units, stringified
  approvalRequired?: {
    token: `0x${string}`;
    spender: `0x${string}`;
    amount: string;
  };
}

/** Response from GET /me. */
export interface MeResponse {
  user: User & { role?: "USER" | "ADMIN" | "OWNER" };
}

/** Paginated list envelope for market list endpoint. */
export interface ListResponse<T> {
  items: T[];
  total?: number;
  hasMore?: boolean;
}

/** Owner stats payload (for /owner dashboard). */
export interface OwnerStats {
  users: { total: number; admins: number };
  markets: { total: number; active: number; pending: number };
  adapters: { total: number };
  chainWritesEnabled: boolean;
}
