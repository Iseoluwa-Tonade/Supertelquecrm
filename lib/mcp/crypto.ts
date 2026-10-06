import { webcrypto } from "node:crypto";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getKeyBytes() {
  const raw = process.env.MCP_ENCRYPTION_KEY;
  if (!raw) throw new Error("MCP_ENCRYPTION_KEY is not configured");
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function getKey() {
  return webcrypto.subtle.importKey("raw", getKeyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const encrypted = await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `v1:${Buffer.from(iv).toString("base64url")}:${Buffer.from(encrypted).toString("base64url")}`;
}

export async function decryptSecret(value: string | null | undefined) {
  if (!value) return null;
  const [version, ivPart, cipherPart] = value.split(":");
  if (version !== "v1" || !ivPart || !cipherPart) throw new Error("Unsupported encrypted secret format");
  const key = await getKey();
  const decrypted = await webcrypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivPart, "base64url") },
    key,
    Buffer.from(cipherPart, "base64url"),
  );
  return decoder.decode(decrypted);
}

export function createPkcePair() {
  const verifier = Buffer.from(webcrypto.getRandomValues(new Uint8Array(48))).toString("base64url");
  return webcrypto.subtle.digest("SHA-256", encoder.encode(verifier)).then((hash) => ({
    verifier,
    challenge: Buffer.from(hash).toString("base64url"),
  }));
}

export function randomState() {
  return Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}
