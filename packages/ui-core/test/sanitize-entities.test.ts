import { afterEach, describe, expect, it, vi } from "vitest";

// The module caches its decoder, so every test loads a fresh copy.
const load = async () => {
  vi.resetModules();
  return (await import("../src/sanitize-html.ts")).sanitizeHtml;
};

const g = globalThis as { document?: unknown };

/** A document whose textarea decodes `&Colon;` and optionally throws, like Trusted Types would. */
function fakeDocument(throws: boolean) {
  const calls: string[] = [];
  g.document = {
    createElement: () => {
      let value = "";
      return {
        set innerHTML(v: string) {
          calls.push(v);
          if (throws) throw new TypeError("This document requires 'TrustedHTML' assignment.");
          value = v === "&Colon;" ? "∷" : v;
        },
        get value() {
          return value;
        },
      };
    },
  };
  return calls;
}

afterEach(() => {
  g.document = undefined;
});

describe("named entity decoding", () => {
  it("leaves the entity undecoded and escaped when innerHTML throws (Trusted Types)", async () => {
    fakeDocument(true);
    const sanitizeHtml = await load();
    expect(sanitizeHtml("<p>caf&eacute; &amp; x</p>")).toBe("<p>caf&amp;eacute; &amp; x</p>");
  });

  it("looks names up case-sensitively: &Colon; is not &colon;", async () => {
    const calls = fakeDocument(false);
    const sanitizeHtml = await load();
    expect(sanitizeHtml("<p>a&colon;b a&Colon;b</p>")).toBe("<p>a:b a∷b</p>");
    expect(calls).toEqual(["&Colon;"]);
  });

  it("applies only the small table without a DOM", async () => {
    const sanitizeHtml = await load();
    expect(sanitizeHtml("<p>&AMP; &Colon; &eacute;</p>")).toBe(
      "<p>&amp; &amp;Colon; &amp;eacute;</p>",
    );
  });
});
