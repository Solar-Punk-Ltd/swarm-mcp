/**
 * Postage stamp depth and price estimation helpers.
 *
 * A Swarm chunk is 4 KiB. A batch at depth D covers 2^D theoretical chunks,
 * but effective utilization starts degrading well before that ceiling, so
 * the depth recommendation adds ~20% headroom on top of the raw data size.
 *
 * Price math uses the Bee chainstate `currentPrice` (PLUR per chunk per block)
 * and a Gnosis block time of ~5s.
 */
import { Bee, Size } from "@ethersphere/bee-js";

export const CHUNK_SIZE_BYTES = 4096;
export const MIN_DEPTH = 17;
export const HEADROOM_FACTOR = 1.2;
export const GNOSIS_BLOCK_TIME_SECONDS = 5;
export const PLUR_PER_BZZ = 1e16;

export function recommendDepthForBytes(dataBytes: number): number {
  if (dataBytes <= 0) return MIN_DEPTH;
  const chunks = Math.ceil((dataBytes * HEADROOM_FACTOR) / CHUNK_SIZE_BYTES);
  const required = Math.ceil(Math.log2(chunks));
  return Math.max(MIN_DEPTH, required);
}

export function theoreticalCapacityBytesForDepth(depth: number): number {
  return Math.pow(2, depth) * CHUNK_SIZE_BYTES;
}

export interface StampCostEstimate {
  depth: number;
  dataSizeBytes: number;
  headroomFactor: number;
  theoreticalCapacityBytes: number;
  durationSeconds: number;
  durationBlocks: number;
  currentPricePlurPerChunkPerBlock: number;
  amountPlurPerChunk: string;
  totalCostPlur: string;
  totalCostBzz: string;
}

export async function estimateStampCost(
  bee: Bee,
  size: Size,
  durationSeconds: number,
  depthOverride?: number,
): Promise<StampCostEstimate> {
  const dataSizeBytes = size.toBytes();
  const depth = depthOverride ?? recommendDepthForBytes(dataSizeBytes);

  const durationBlocks = Math.ceil(durationSeconds / GNOSIS_BLOCK_TIME_SECONDS);

  const chainState = await bee.getChainState();
  const currentPrice = Number(chainState.currentPrice);
  const amountPerChunk = BigInt(currentPrice) * BigInt(durationBlocks);
  const totalChunks = 1n << BigInt(depth);
  const totalPlur = amountPerChunk * totalChunks;
  const totalBzz = Number(totalPlur) / PLUR_PER_BZZ;

  return {
    depth,
    dataSizeBytes,
    headroomFactor: HEADROOM_FACTOR,
    theoreticalCapacityBytes: theoreticalCapacityBytesForDepth(depth),
    durationSeconds,
    durationBlocks,
    currentPricePlurPerChunkPerBlock: currentPrice,
    amountPlurPerChunk: amountPerChunk.toString(),
    totalCostPlur: totalPlur.toString(),
    totalCostBzz: totalBzz.toFixed(6),
  };
}
