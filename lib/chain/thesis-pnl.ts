"use client";

import type {Hex} from "viem";
import {quoteCloseAtMark} from "../trade/pnl";
import type {CloseQuote} from "../trade/pnl";
import {useMarkets, usePositions} from "./hooks";
import type {MarketRow, Position} from "./reads";

/// The live value of the position backing a thesis.
///
/// A thesis carries a `tokenId` once its trade confirms, and that is the only thing needed: the
/// position struct and the price both come from the contract. A closed position reverts, which is
/// mapped to "no position" rather than to an error — the thesis outlives the trade.

export interface LivePnl {
  position: Position | null;
  market: MarketRow | undefined;
  quote: CloseQuote | undefined;
  /// True when the token existed and has since been closed or liquidated.
  settled: boolean;
}

export function useLivePnl(tokenId: string | null): LivePnl {
  const ids = tokenId === null ? [] : [BigInt(tokenId)];
  const positions = usePositions(ids);
  const markets = useMarkets();

  if (tokenId === null) {
    return {position: null, market: undefined, quote: undefined, settled: false};
  }

  const position = positions.data?.get(tokenId) ?? null;
  if (!position) {
    return {
      position: null,
      market: undefined,
      quote: undefined,
      settled: positions.data !== undefined,
    };
  }

  const market = markets.data?.rows.find(
    (row) => row.feedId.toLowerCase() === (position.feedId as Hex).toLowerCase(),
  );

  return {
    position,
    market,
    settled: false,
    quote: market
      ? quoteCloseAtMark(
          {
            isLong: position.isLong,
            units: position.units,
            entryPrice: position.entryPrice,
            collateral: position.collateral,
            closeFeeBps: market.config.closeFeeBps,
            copyAuthor: position.copyAuthor,
            authorFeeBps: position.authorFeeBps,
          },
          market.mark,
        )
      : undefined,
  };
}
