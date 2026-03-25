/**
 * @jest-environment node
 *
 * Smoke tests for PDF rendering via @react-pdf/renderer.
 *
 * Why `@jest-environment node`?
 * @react-pdf/renderer runs a Node.js-native PDF engine (based on pdfkit).
 * It does not use the browser DOM at all, so there is no value in using jsdom
 * here — the Node environment is lighter and matches production behaviour.
 *
 * What is "smoke testing" a PDF?
 * We are NOT checking that the PDF looks correct visually — that is subjective
 * and is best verified by a human reviewer. Instead, these tests check that:
 *
 *   1. The renderer does not throw for valid inputs.
 *   2. The output is a non-empty Buffer.
 *   3. The buffer starts with the PDF magic bytes (%PDF-), confirming that a
 *      structurally valid PDF document was produced.
 *   4. The renderer behaves predictably on edge-case inputs (empty body,
 *      null images, very long letter text).
 *   5. The same inputs always produce a non-empty result (stability check).
 *
 * These tests will catch regressions such as:
 *   - A dependency upgrade that breaks the renderer API.
 *   - A template change that introduces an invalid React-PDF element.
 *   - A crash when optional props (logo, signature) are omitted.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { LetterDocument } from "@/lib/pdf/letter-template";
import type { LetterDocumentProps } from "@/lib/pdf/letter-template";
import { EMPTY_RECOMMENDER_FORM } from "@/lib/faculty-profile";

// ─── Shared test fixtures ─────────────────────────────────────────────────────

const baseProps: LetterDocumentProps = {
  recommender: {
    ...EMPTY_RECOMMENDER_FORM,
    prefix: "Dr.",
    firstName: "Alice",
    lastName: "Johnson",
    organization: "MIT",
    department: "Computer Science",
    title: "Professor",
    signOff: "Sincerely,",
    email: "alice@mit.edu",
    phone: "617-555-0100",
    country: "United States",
    street: "77 Massachusetts Ave",
    city: "Cambridge",
    state: "MA",
    postalCode: "02139",
  },
  letterBody:
    "It is my distinct pleasure to recommend Jane Doe for admission to your program.\n\n" +
    "Jane has demonstrated exceptional skill in her coursework and research.\n\n" +
    "I highly recommend her without reservation.",
  logoDataUri: null,
  signatureDataUri: null,
  date: "March 16, 2026",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

async function renderLetter(props: LetterDocumentProps): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(
      LetterDocument,
      props,
    ) as unknown as React.ReactElement<DocumentProps>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("LetterDocument PDF rendering", () => {
  it("renders a non-empty buffer for a complete recommender payload", async () => {
    const buf = await renderLetter(baseProps);
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces a valid PDF (starts with %PDF- magic bytes)", async () => {
    const buf = await renderLetter(baseProps);
    const header = buf.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("does not throw when logo and signature are both null", async () => {
    const props: LetterDocumentProps = {
      ...baseProps,
      logoDataUri: null,
      signatureDataUri: null,
    };
    await expect(renderLetter(props)).resolves.toBeInstanceOf(Buffer);
  });

  it("does not throw when the letter body is an empty string", async () => {
    const props: LetterDocumentProps = { ...baseProps, letterBody: "" };
    await expect(renderLetter(props)).resolves.toBeInstanceOf(Buffer);
  });

  it("does not throw when all recommender fields are empty strings", async () => {
    const props: LetterDocumentProps = {
      ...baseProps,
      recommender: { ...EMPTY_RECOMMENDER_FORM },
    };
    await expect(renderLetter(props)).resolves.toBeInstanceOf(Buffer);
  });

  it("handles a very long letter body without throwing", async () => {
    const longBody = Array.from(
      { length: 50 },
      (_, i) =>
        `Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. ` +
        "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    ).join("\n\n");

    const props: LetterDocumentProps = { ...baseProps, letterBody: longBody };
    const buf = await renderLetter(props);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("produces consistent output size for the same input (stability check)", async () => {
    // Two renders of the same document should produce buffers of equal length.
    // Exact byte-for-byte identity is NOT guaranteed by @react-pdf/renderer
    // (it may embed timestamps or metadata), but the size should be stable.
    const buf1 = await renderLetter(baseProps);
    const buf2 = await renderLetter(baseProps);
    // Allow ±512 bytes for any metadata that may differ between renders.
    expect(Math.abs(buf1.length - buf2.length)).toBeLessThan(512);
  });
});
