"use client";

import {useEffect, useMemo} from "react";
import type {Hex} from "viem";
import {useHeldPositions} from "../graph/hooks";
import type {IndexedPosition} from "../graph/cope";
import {quoteCloseAtMark} from "../trade/pnl";
import type {CloseQuote} from "../trade/pnl";
import {useMarkets, usePositions} from "./hooks";
import type {MarketRow, Position} from "./reads";

/// A position with a live valuation.
///
/// The token ids come from the subgraph, because there is no way to ask an ERC-721 what someone
/// holds without enumerating it. Everything that decides money — entry price, units, collateral,
/// who the author fee goes to — is then read from the contract, because the indexer lags and the
/// user's own position is the one thing that has to feel immediate.

export interface LivePosition {
  position: Position;
  market: MarketRow | undefined;
  /// What closing right now would settle at. Undefined when there is no price for the asset.
  quote: CloseQuote | undefined;
}

export function useLivePositions(address: string | undefined) {
  const held = useHeldPositions(address);
  const tokenIds = useMemo(() => held.data?.map((position) => position.tokenId) ?? [], [held.data]);

  const positions = usePositions(tokenIds);
  const markets = useMarkets();

  /// Rows the indexer still lists as open whose token the contract no longer knows about.
  ///
  /// A position can now be closed by a liquidation keeper rather than by its owner, so this is not
  /// only ever the user's own doing — and a card silently disappearing would be the worst way to
  /// find that out.
  const settled = useMemo((): IndexedPosition[] => {
    if (!positions.data || !held.data) return [];
    return held.data.filter((row) => positions.data.get(row.tokenId.toString()) === null);
  }, [held.data, positions.data]);

  // The indexer agrees within a block or two, at which point the row leaves `positionsHeldBy` and
  // the notice goes with it. Asking again is what makes it temporary rather than permanent.
  const refetchHeld = held.refetch;
  useEffect(() => {
    if (settled.length > 0) void refetchHeld();
  }, [settled.length, refetchHeld]);

  const live = useMemo((): LivePosition[] => {
    if (!positions.data) return [];

    return (
      tokenIds
        .map((tokenId) => positions.data.get(tokenId.toString()))
        // A token the contract no longer knows about is handled above, as `settled`.
        .filter((position): position is Position => position !== null && position !== undefined)
        .map((position) => {
          const market = markets.data?.rows.find(
            (row) => row.feedId.toLowerCase() === (position.feedId as Hex).toLowerCase(),
          );

          return {
            position,
            market,
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
        })
    );
  }, [tokenIds, positions.data, markets.data]);

  return {
    positions: live,
    settled,
    isLoading: held.isLoading || positions.isLoading,
    isError: held.isError,
    error: held.error,
    refetch: () => {
      void held.refetch();
      void positions.refetch();
    },
  };
}
