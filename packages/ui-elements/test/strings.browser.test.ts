import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStrings,
  coreStrings,
  loadStrings,
  localeOf,
  provideStrings,
  resolveString,
  setStrings,
  watchStrings,
} from "../src/strings/strings.ts";
import { mount } from "./setup.ts";

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.lang = "";
  clearStrings();
});

const tree = () => {
  const host = mount(
    `<section lang="es-PE"><div id="outer"><span id="leaf" bold-label="Strong"></span></div></section>`,
  );
  return {
    leaf: host.querySelector("#leaf") as HTMLElement,
    outer: host.querySelector("#outer") as HTMLElement,
  };
};

describe("strings registry", () => {
  it("resolves attribute, then provider, then lang registry (region then base), then fallback", () => {
    const { leaf, outer } = tree();
    expect(localeOf(leaf)).toBe("es-pe");
    expect(resolveString(leaf, "x.bold", "Bold")).toBe("Bold");
    setStrings("es", { "x.bold": "Negrita" });
    expect(resolveString(leaf, "x.bold", "Bold")).toBe("Negrita");
    setStrings("es-PE", { "x.bold": "Negrita PE" });
    expect(resolveString(leaf, "x.bold", "Bold")).toBe("Negrita PE");
    const stop = provideStrings(outer, { "x.bold": "Provided" });
    expect(resolveString(leaf, "x.bold", "Bold")).toBe("Provided");
    expect(resolveString(leaf, "x.bold", "Bold", "bold-label")).toBe("Strong");
    stop();
    expect(resolveString(leaf, "x.bold", "Bold")).toBe("Negrita PE");
  });

  it("falls back to the English core pack, then the key", () => {
    const el = mount("<i></i>").firstElementChild as HTMLElement;
    expect(resolveString(el, "retry")).toBe(coreStrings.retry);
    expect(resolveString(el, "nope.key")).toBe("nope.key");
  });

  it("loads the Spanish pack lazily and notifies watchers", async () => {
    const { leaf } = tree();
    const seen = vi.fn();
    const stop = watchStrings(seen);
    expect(resolveString(leaf, "retry")).toBe("Retry");
    await loadStrings("es");
    expect(seen).toHaveBeenCalled();
    expect(resolveString(leaf, "retry")).toBe("Reintentar");
    expect(resolveString(leaf, "richText.bold", "Bold")).toBe("Negrita");
    stop();
  });
});
