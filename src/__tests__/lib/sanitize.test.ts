/**
 * @jest-environment node
 *
 * Unit tests for HTML sanitization and Lexical JSON validation.
 *
 * Why `@jest-environment node`?
 * sanitize.ts creates its own private JSDOM window internally so DOMPurify can
 * run server-side. It does NOT rely on Jest's simulated browser DOM, which
 * means the `node` environment is correct here — it avoids conflicts between
 * two concurrent JSDOM instances and ensures `TextDecoder` (a Node built-in
 * since v16) is in scope for jsdom's transitive dependencies.
 *
 * sanitizeLetterHtml wraps DOMPurify with an allow-list tailored to the tags
 * Lexical's HTML serialiser produces. These tests verify that the allow-list
 * is working correctly and that XSS vectors are stripped before HTML is ever
 * stored or rendered.
 *
 * validateLexicalJson is a structural guard that rejects editor-state objects
 * that contain unexpected or unknown node types.
 */

import { sanitizeLetterHtml, validateLexicalJson } from "@/lib/sanitize";

// ─── sanitizeLetterHtml ───────────────────────────────────────────────────────

describe("sanitizeLetterHtml", () => {
  it("passes through allowed inline formatting tags", () => {
    const input = "<p>Hello <strong>world</strong> and <em>everyone</em>.</p>";
    const output = sanitizeLetterHtml(input);
    expect(output).toContain("<strong>world</strong>");
    expect(output).toContain("<em>everyone</em>");
  });

  it("passes through allowed block elements", () => {
    const input = "<ul><li>Item one</li><li>Item two</li></ul>";
    const output = sanitizeLetterHtml(input);
    expect(output).toContain("<ul>");
    expect(output).toContain("<li>Item one</li>");
  });

  it("strips <script> tags entirely", () => {
    const input = '<p>Safe text</p><script>alert("xss")</script>';
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("<script>");
    expect(output).not.toContain("alert");
  });

  it("strips <img> tags (not in the allow-list)", () => {
    const input = '<p>text</p><img src="https://evil.com/pixel.png" />';
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("<img");
  });

  it("strips <a> tags (link injection vector)", () => {
    const input = '<a href="javascript:void(0)">click me</a>';
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("<a");
  });

  it("strips onclick and other event handler attributes", () => {
    const input = "<p onclick=\"alert('xss')\">paragraph</p>";
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("onclick");
    expect(output).toContain("<p>");
  });

  it("strips data-* attributes", () => {
    const input = '<p data-secret="value">text</p>';
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("data-secret");
  });

  it("returns an empty string for an empty input", () => {
    expect(sanitizeLetterHtml("")).toBe("");
  });

  it("preserves plain text content", () => {
    const input = "<p>Just plain text here.</p>";
    const output = sanitizeLetterHtml(input);
    expect(output).toContain("Just plain text here.");
  });

  it("strips <iframe> tags", () => {
    const input = '<p>visible</p><iframe src="https://evil.com" />';
    const output = sanitizeLetterHtml(input);
    expect(output).not.toContain("<iframe");
  });
});

// ─── validateLexicalJson ─────────────────────────────────────────────────────

describe("validateLexicalJson", () => {
  /** Minimal valid Lexical editor state with a single paragraph. */
  const validState = {
    root: {
      type: "root",
      children: [{ type: "paragraph", children: [] }],
    },
  };

  it("accepts a well-formed Lexical editor state", () => {
    expect(validateLexicalJson(validState)).toBe(true);
  });

  it("accepts an editor state with multiple known node types", () => {
    const state = {
      root: {
        type: "root",
        children: [
          { type: "paragraph" },
          { type: "heading" },
          { type: "list" },
          { type: "quote" },
        ],
      },
    };
    expect(validateLexicalJson(state)).toBe(true);
  });

  it("rejects null", () => {
    expect(validateLexicalJson(null)).toBe(false);
  });

  it("rejects a plain string", () => {
    expect(validateLexicalJson("{}")).toBe(false);
  });

  it("rejects an object without a root key", () => {
    expect(validateLexicalJson({ nodes: [] })).toBe(false);
  });

  it("rejects a root node with the wrong type field", () => {
    const state = {
      root: { type: "document", children: [] },
    };
    expect(validateLexicalJson(state)).toBe(false);
  });

  it("rejects when root.children is not an array", () => {
    const state = {
      root: { type: "root", children: "should be array" },
    };
    expect(validateLexicalJson(state)).toBe(false);
  });

  it("rejects an unknown child node type", () => {
    const state = {
      root: {
        type: "root",
        children: [{ type: "unknown_custom_node" }],
      },
    };
    expect(validateLexicalJson(state)).toBe(false);
  });

  it("rejects an array at the top level", () => {
    expect(validateLexicalJson([validState])).toBe(false);
  });
});
