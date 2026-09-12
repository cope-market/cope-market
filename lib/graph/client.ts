import {z} from "zod";

/// A small typed GraphQL client for the two subgraphs.
///
/// Responses are validated before they reach a caller, for the same reason the API client
/// validates its own: an indexer that answers with an unexpected shape should fail here, loudly,
/// rather than three components later as an unreadable render error.
///
/// Every figure a subgraph returns is as of its last indexed block. Nothing built on this module
/// may describe such a figure as "current" — see `metaSchema` and the `AsOf` component.

export const COPE_SUBGRAPH =
  process.env["NEXT_PUBLIC_SUBGRAPH_COPE"] ??
  "https://api.studio.thegraph.com/query/101383/cope-market-arc/v0.2.0";

export const VAULT_SUBGRAPH =
  process.env["NEXT_PUBLIC_SUBGRAPH_VAULT"] ??
  "https://api.studio.thegraph.com/query/101383/erc-4626-vault-arc/v0.2.0";

/// An indexer that is slow is indistinguishable from one that is down, and a screen waiting on
/// either should give up and say so.
const TIMEOUT_MS = 10_000;

export class SubgraphError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
  ) {
    super(message);
    this.name = "SubgraphError";
  }
}

/// Addresses come back lower-case from graph-node, always. Queries accept either form, so this is
/// applied on the way in for consistency and on the way out for comparison: matching a checksummed
/// wallet address against a subgraph result without it is silently always false.
export function lower(address: string): string {
  return address.toLowerCase();
}

export async function query<T extends z.ZodType>(
  endpoint: string,
  document: string,
  variables: Record<string, unknown>,
  schema: T,
): Promise<z.infer<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let payload: unknown;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({query: document, variables}),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new SubgraphError(`The subgraph answered ${response.status}.`, endpoint);
    }
    payload = await response.json();
  } catch (error) {
    if (error instanceof SubgraphError) throw error;
    const reason =
      error instanceof Error && error.name === "AbortError" ? "timed out" : "is unreachable";
    throw new SubgraphError(`The subgraph ${reason}.`, endpoint);
  } finally {
    clearTimeout(timer);
  }

  const envelope = z
    .object({
      data: z.unknown().optional(),
      errors: z.array(z.object({message: z.string()})).optional(),
    })
    .parse(payload);

  if (envelope.errors?.length) {
    throw new SubgraphError(envelope.errors.map((error) => error.message).join("; "), endpoint);
  }

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new SubgraphError(
      `The subgraph returned an unexpected shape: ${parsed.error.message}`,
      endpoint,
    );
  }
  return parsed.data;
}

/// Amounts cross the wire as decimal strings, because a uint256 does not fit in a JavaScript
/// number and JSON has no other integer.
export const BigIntString = z.string().transform((value) => BigInt(value));
export const NullableBigIntString = z
  .string()
  .nullable()
  .transform((value) => (value === null ? null : BigInt(value)));

/// Distinguishing "no rows" from "zero" is the whole job of a nullable numeric field here. A
/// trader with no closed positions has no realised P&L; they did not break even.
export const Meta = z.object({
  _meta: z
    .object({block: z.object({number: z.number(), timestamp: z.number().nullable()})})
    .nullable(),
});
