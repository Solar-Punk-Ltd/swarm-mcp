/**
 * Helpers for ACT (Access Control Trie) operations.
 */

export function normalizePublicKeyHex(input: string): string {
  let value = input.trim();
  if (value.startsWith("0x") || value.startsWith("0X")) {
    value = value.slice(2);
  }
  if (!/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error("public key must be a hex string");
  }
  // Uncompressed 64-byte key = 128 hex chars. Compressed 33-byte key = 66 hex chars.
  if (value.length !== 128 && value.length !== 66) {
    throw new Error(
      "public key length invalid: expected 66 hex chars (compressed, 33 bytes) or 128 hex chars (uncompressed, 64 bytes)",
    );
  }
  return value.toLowerCase();
}

export function normalizeReferenceHex(input: string): string {
  let value = input.trim();
  if (value.startsWith("0x") || value.startsWith("0X")) {
    value = value.slice(2);
  }
  if (!/^[0-9a-fA-F]+$/.test(value)) {
    throw new Error("reference must be a hex string");
  }
  // Plain reference = 32 bytes (64 hex). Encrypted reference = 64 bytes (128 hex).
  if (value.length !== 64 && value.length !== 128) {
    throw new Error(
      "reference length invalid: expected 64 or 128 hex chars",
    );
  }
  return value.toLowerCase();
}

export function normalizeGranteeList(grantees: string[] | undefined): string[] {
  if (!grantees) return [];
  return grantees.map(normalizePublicKeyHex);
}
