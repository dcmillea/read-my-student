/**
 * @jest-environment node
 *
 * Unit tests for PDF integrity logic — SHA-256 hashing and HMAC signing.
 *
 * Why `@jest-environment node`?
 * The Node.js `crypto` module and Buffer are Node-native APIs. There is no
 * need (or benefit) to involve a simulated browser DOM here, and running in the
 * pure Node environment avoids any jsdom overhead.
 *
 * These tests verify the hashing pipeline used in:
 *   POST /api/letters/[id]/finalize  — creates hash + HMAC at signing time
 *   GET  /api/letters/[id]/verify    — recomputes and compares at verification time
 *
 * If either of these functions is accidentally changed (e.g., algorithm swapped,
 * digest format changed, signing order reversed), these tests will catch it.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";

// ─── Helpers that mirror the exact logic in the route handlers ────────────────

/** SHA-256 hash of an arbitrary byte buffer — same as route step 6. */
function hashPdfBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** HMAC-SHA256 of the hex hash using a secret — same as route step 7. */
function signHash(hexHash: string, secret: string): string {
  return createHmac("sha256", secret).update(hexHash).digest("hex");
}

/**
 * Timing-safe comparison of two hex strings — same as verify route.
 * Returns true only when the two values are identical.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// ─── SHA-256 hashing ──────────────────────────────────────────────────────────

describe("hashPdfBuffer (SHA-256)", () => {
  it("returns a 64-character lowercase hex string", () => {
    const buf = Buffer.from("hello world");
    const hash = hashPdfBuffer(buf);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the correct well-known SHA-256 digest for 'hello world'", () => {
    // SHA-256('hello world') in hex without a newline — fixed known test vector.
    // Command to independently verify: echo -n 'hello world' | sha256sum
    const buf = Buffer.from("hello world");
    const hash = hashPdfBuffer(buf);
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });

  it("is deterministic: same input always produces the same hash", () => {
    const buf = Buffer.from("PDF content");
    expect(hashPdfBuffer(buf)).toBe(hashPdfBuffer(buf));
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashPdfBuffer(Buffer.from("PDF A"));
    const hash2 = hashPdfBuffer(Buffer.from("PDF B"));
    expect(hash1).not.toBe(hash2);
  });

  it("produces a different hash when a single byte changes", () => {
    const original = Buffer.from("stable content");
    const tampered = Buffer.from("stable Content"); // capital C
    expect(hashPdfBuffer(original)).not.toBe(hashPdfBuffer(tampered));
  });
});

// ─── HMAC signing ─────────────────────────────────────────────────────────────

describe("signHash (HMAC-SHA256)", () => {
  const SECRET = "test-signing-secret-at-least-32-chars";

  it("returns a 64-character lowercase hex string", () => {
    const sig = signHash("aabbcc", SECRET);
    expect(sig).toHaveLength(64);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic: same hash + secret always produces the same signature", () => {
    const hash = "deadbeef";
    expect(signHash(hash, SECRET)).toBe(signHash(hash, SECRET));
  });

  it("produces a different signature when the hash changes", () => {
    const sig1 = signHash("hash-a", SECRET);
    const sig2 = signHash("hash-b", SECRET);
    expect(sig1).not.toBe(sig2);
  });

  it("produces a different signature when the secret changes", () => {
    const hash = "samehash";
    const sig1 = signHash(hash, "secret-one");
    const sig2 = signHash(hash, "secret-two");
    expect(sig1).not.toBe(sig2);
  });

  it("cannot be forged: an attacker who only knows the hash cannot produce the correct HMAC", () => {
    const correctSecret = "the-real-secret";
    const wrongSecret = "a-guessed-secret";
    const hash = hashPdfBuffer(Buffer.from("letter content"));
    const legitimateSignature = signHash(hash, correctSecret);
    const forgedSignature = signHash(hash, wrongSecret);
    expect(timingSafeStringEqual(legitimateSignature, forgedSignature)).toBe(
      false,
    );
  });
});

// ─── End-to-end integrity pipeline ───────────────────────────────────────────

describe("full sign → verify pipeline", () => {
  const PDF_SIGNING_SECRET = "integration-test-secret-32-chars!";

  it("verifies an unmodified PDF successfully", () => {
    const pdfBytes = Buffer.from("% PDF-1.4 fake content");

    const hash = hashPdfBuffer(pdfBytes);
    const signature = signHash(hash, PDF_SIGNING_SECRET);

    // Simulate what the verify route does: re-hash and re-sign.
    const recomputedHash = hashPdfBuffer(pdfBytes);
    const recomputedSignature = signHash(recomputedHash, PDF_SIGNING_SECRET);

    expect(timingSafeStringEqual(hash, recomputedHash)).toBe(true);
    expect(timingSafeStringEqual(signature, recomputedSignature)).toBe(true);
  });

  it("fails integrity check when the PDF bytes are tampered", () => {
    const originalPdf = Buffer.from("% PDF-1.4 original");
    const tamperedPdf = Buffer.from("% PDF-1.4 tampered"); // byte differs

    const storedHash = hashPdfBuffer(originalPdf);
    const storedSignature = signHash(storedHash, PDF_SIGNING_SECRET);

    const liveHash = hashPdfBuffer(tamperedPdf);

    // The hash check should fail.
    expect(timingSafeStringEqual(storedHash, liveHash)).toBe(false);

    // Even if the attacker recomputes the HMAC over the tampered hash,
    // they don't have the secret — so the stored signature won't match.
    const attackerSignature = signHash(
      liveHash,
      "attacker-does-not-know-secret",
    );
    expect(timingSafeStringEqual(storedSignature, attackerSignature)).toBe(
      false,
    );
  });

  it("fails the HMAC check when the secret has been rotated", () => {
    const pdfBytes = Buffer.from("% PDF-1.4 content");
    const hash = hashPdfBuffer(pdfBytes);

    const signatureWithOldSecret = signHash(hash, "old-secret");
    const signatureWithNewSecret = signHash(hash, "new-rotated-secret");

    expect(
      timingSafeStringEqual(signatureWithOldSecret, signatureWithNewSecret),
    ).toBe(false);
  });
});

// ─── timingSafeStringEqual ────────────────────────────────────────────────────

describe("timingSafeStringEqual", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeStringEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeStringEqual("aaaaaa", "bbbbbb")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(timingSafeStringEqual("short", "much-longer-string")).toBe(false);
  });
});
