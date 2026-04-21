/**
 * Postage stamp depth heuristic.
 *
 * Price/duration math is delegated to bee-js's `bee.getStorageCost` and
 * `bee.buyStorage` -- we only provide a depth suggestion here so the tool
 * output shows the caller what capacity they'll get for a given data size.
 *
 * A Swarm chunk is 4 KiB. A batch at depth D covers 2^D theoretical chunks.
 * Effective utilization caps out well before the theoretical ceiling, so the
 * suggested depth adds ~20% headroom over the raw data size.
 */
export const CHUNK_SIZE_BYTES = 4096;
export const MIN_DEPTH = 17;
export const HEADROOM_FACTOR = 1.2;

export function recommendDepthForBytes(dataBytes: number): number {
  if (dataBytes <= 0) return MIN_DEPTH;
  const chunks = Math.ceil((dataBytes * HEADROOM_FACTOR) / CHUNK_SIZE_BYTES);
  const required = Math.ceil(Math.log2(chunks));
  return Math.max(MIN_DEPTH, required);
}

export function theoreticalCapacityBytesForDepth(depth: number): number {
  return Math.pow(2, depth) * CHUNK_SIZE_BYTES;
}
