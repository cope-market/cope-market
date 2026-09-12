import {z} from "zod";
import {BigIntString, COPE_SUBGRAPH, NullableBigIntString, lower, query} from "./client";

/// Queries against the Cope Market subgraph: positions, the copy graph, author fees, realised P&L.
///
/// Two rules run through all of it. P&L belongs to `author` — the address that opened a position
/// and never changes — rather than to `owner`, which changes if the NFT is sold. And a trader who
/// has closed nothing has no win rate at all, which is not the same as a win rate of zero.

const StatusSchema = z.enum(["OPEN", "CLOSED", "LIQUIDATED"]);
export type PositionStatus = z.infer<typeof StatusSchema>;

const IndexedPosition = z.object({
  tokenId: BigIntString,
  asset: z.object({id: z.string()}),
  author: z.object({id: z.string()}),
  owner: z.object({id: z.string()}),
  isLong: z.boolean(),
  collateral: BigIntString,
  units: BigIntString,
  entryPrice: BigIntString,
  openedAt: BigIntString,
  status: StatusSchema,
  exitPrice: NullableBigIntString,
  realizedPnlWad: NullableBigIntString,
  payout: NullableBigIntString,
  authorFeePaid: NullableBigIntString,
  closedAt: NullableBigIntString,
  copyCount: z.number(),
  copiedFrom: z.object({tokenId: BigIntString, author: z.object({id: z.string()})}).nullable(),
});

export type IndexedPosition = z.infer<typeof IndexedPosition>;

const POSITION_FIELDS = `
  tokenId
  asset { id }
  author { id }
  owner { id }
  isLong
  collateral
  units
  entryPrice
  openedAt
  status
  exitPrice
  realizedPnlWad
  payout
  authorFeePaid
  closedAt
  copyCount
  copiedFrom { tokenId author { id } }
`;

/// Everything a trader holds that is still open, newest first. Keyed on `owner`, because holding
/// is what entitles someone to the payout.
export async function positionsHeldBy(address: string): Promise<IndexedPosition[]> {
  const {positions} = await query(
    COPE_SUBGRAPH,
    `query Held($owner: String!) {
      positions(where: {owner: $owner, status: OPEN}, orderBy: openedAt, orderDirection: desc, first: 100) {
        ${POSITION_FIELDS}
      }
    }`,
    {owner: lower(address)},
    z.object({positions: z.array(IndexedPosition)}),
  );
  return positions;
}

/// Someone's closed record, newest first. Keyed on `author`, because a sold position's results
/// still belong to whoever opened it.
export async function closedPositionsBy(address: string, limit = 50): Promise<IndexedPosition[]> {
  const {positions} = await query(
    COPE_SUBGRAPH,
    `query Closed($author: String!, $limit: Int!) {
      positions(
        where: {author: $author, status_not: OPEN}
        orderBy: closedAt
        orderDirection: desc
        first: $limit
      ) { ${POSITION_FIELDS} }
    }`,
    {author: lower(address), limit},
    z.object({positions: z.array(IndexedPosition)}),
  );
  return positions;
}

export async function positionByTokenId(tokenId: bigint): Promise<IndexedPosition | null> {
  const {positions} = await query(
    COPE_SUBGRAPH,
    `query ByToken($tokenId: BigInt!) {
      positions(where: {tokenId: $tokenId}, first: 1) { ${POSITION_FIELDS} }
    }`,
    {tokenId: tokenId.toString()},
    z.object({positions: z.array(IndexedPosition)}),
  );
  return positions[0] ?? null;
}

const TraderSchema = z.object({
  id: z.string(),
  positionsOpened: z.number(),
  positionsClosed: z.number(),
  positionsLiquidated: z.number(),
  wins: z.number(),
  losses: z.number(),
  realizedPnlWad: BigIntString,
  cumulativeCollateral: BigIntString,
  copiesMade: z.number(),
  copiesReceived: z.number(),
  authorFeesEarned: BigIntString,
});

export type Trader = z.infer<typeof TraderSchema>;

/// A trader's lifetime record, or null if the address has never traded.
///
/// Null and a row of zeros mean different things and callers have to keep them apart: an address
/// with no history is not a trader who broke even.
export async function traderRecord(address: string): Promise<Trader | null> {
  const {trader} = await query(
    COPE_SUBGRAPH,
    `query Record($id: ID!) {
      trader(id: $id) {
        id positionsOpened positionsClosed positionsLiquidated wins losses
        realizedPnlWad cumulativeCollateral copiesMade copiesReceived authorFeesEarned
      }
    }`,
    {id: lower(address)},
    z.object({trader: TraderSchema.nullable()}),
  );
  return trader;
}

/// A win rate, or null when nothing has been closed. `wins` counts strictly positive P&L, so a
/// flat close counts as a loss and `wins + losses` always equals `positionsClosed`.
export function winRate(trader: Trader): number | null {
  const closed = trader.wins + trader.losses;
  return closed === 0 ? null : trader.wins / closed;
}

const CopyNode = z.object({
  tokenId: BigIntString,
  author: z.object({id: z.string()}),
  status: StatusSchema,
  realizedPnlWad: NullableBigIntString,
  collateral: BigIntString,
});

export type CopyNode = z.infer<typeof CopyNode>;

/// Who copied a position, and how those copies turned out.
///
/// This is the number that answers "should I copy this author", and it is deliberately separate
/// from the author's own P&L. A trader can do well on their own entries while everyone who
/// followed them in later did badly.
export async function copiesOf(tokenId: bigint): Promise<CopyNode[]> {
  const {positions} = await query(
    COPE_SUBGRAPH,
    `query Copies($tokenId: BigInt!) {
      positions(where: {tokenId: $tokenId}, first: 1) {
        copies(first: 100, orderBy: openedAt, orderDirection: desc) {
          tokenId author { id } status realizedPnlWad collateral
        }
      }
    }`,
    {tokenId: tokenId.toString()},
    z.object({positions: z.array(z.object({copies: z.array(CopyNode)}))}),
  );
  return positions[0]?.copies ?? [];
}
