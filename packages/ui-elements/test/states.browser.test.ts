import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineEmptyState } from "../src/empty-state/empty-state.ts";
import { defineErrorState } from "../src/error-state/error-state.ts";
import { defineForbiddenState } from "../src/forbidden-state/forbidden-state.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineEmptyState();
  defineErrorState();
  defineForbiddenState();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const text = (host: Element, part: string) =>
  host.shadowRoot?.querySelector<HTMLElement>(`[part=${part}]`);

describe("ui-empty-state", () => {
  it("renders the heading and description and hides empty slots", async () => {
    const host = mount(
      '<ui-empty-state heading="No invoices" description="Create one."></ui-empty-state>',
    ).firstElementChild as HTMLElement;
    await frame();
    expect(text(host, "title")?.textContent).toBe("No invoices");
    expect(text(host, "description")?.hidden).toBe(false);
    expect(text(host, "icon")?.hidden).toBe(true);
    expect(text(host, "actions")?.hidden).toBe(true);
  });

  it("shows the icon and action slots once filled, the icon hidden from the AX tree", async () => {
    const host = mount(
      '<ui-empty-state heading="Nothing"><svg slot="icon" width="16" height="16"></svg><button>Add</button></ui-empty-state>',
    ).firstElementChild as HTMLElement;
    await frame();
    expect(text(host, "icon")?.hidden).toBe(false);
    expect(text(host, "icon")?.getAttribute("aria-hidden")).toBe("true");
    expect(text(host, "actions")?.hidden).toBe(false);
    expect(await ax("button", "Add")).toBeTruthy();
  });

  it("grows its padding from 360px up", () => {
    const pad = (width: number) => {
      const host = mount(`<ui-empty-state heading="x" style="width:${width}px"></ui-empty-state>`)
        .firstElementChild as HTMLElement;
      return getComputedStyle(text(host, "root") as HTMLElement).paddingInlineStart;
    };
    expect(pad(300)).toBe("16px");
    expect(pad(400)).toBe("24px");
  });
});

describe("ui-error-state", () => {
  it("is an alert with the fallback headline", async () => {
    mount("<ui-error-state></ui-error-state>");
    expect(await ax("alert")).toBeTruthy();
    expect(document.querySelector("ui-error-state")?.shadowRoot?.textContent).toContain(
      "Something went wrong. Try again.",
    );
  });

  it("orders heading, message and description like the React kit", () => {
    const detail = (html: string) => {
      const host = mount(html).firstElementChild as HTMLElement;
      return [
        text(host, "title")?.textContent,
        text(host, "detail")?.textContent ?? "",
        text(host, "detail")?.hidden,
      ];
    };
    expect(detail('<ui-error-state message="Boom"></ui-error-state>')).toEqual(["Boom", "", true]);
    expect(detail('<ui-error-state heading="Failed" message="Boom"></ui-error-state>')).toEqual([
      "Failed",
      "Boom",
      false,
    ]);
    expect(
      detail('<ui-error-state heading="Failed" message="Boom" description="Why"></ui-error-state>'),
    ).toEqual(["Failed", "Why", false]);
  });

  it("shows the correlation id and emits retry from the button", async () => {
    const host = mount(
      '<ui-error-state heading="Failed" correlation-id="abc-1" retryable retry-label="Again"></ui-error-state>',
    ).firstElementChild as HTMLElement;
    expect(text(host, "correlation")?.textContent).toBe("ID: abc-1");
    let retries = 0;
    host.addEventListener("retry", () => retries++);
    expect(await ax("button", "Again")).toBeTruthy();
    host.shadowRoot?.querySelector("button")?.click();
    expect(retries).toBe(1);
  });

  it("has no retry button unless retryable", () => {
    const host = mount('<ui-error-state heading="Failed"></ui-error-state>')
      .firstElementChild as HTMLElement;
    expect(host.shadowRoot?.querySelector("button")?.hidden).toBe(true);
  });
});

describe("ui-forbidden-state", () => {
  it("is an alert with the heading and reason", async () => {
    const host = mount(
      '<ui-forbidden-state heading="No access" reason="Admins only"></ui-forbidden-state>',
    ).firstElementChild as HTMLElement;
    expect(await ax("alert")).toBeTruthy();
    expect(host.shadowRoot?.textContent).toContain("No access");
    expect(text(host, "description")?.textContent).toBe("Admins only");
  });
});

describe("custom prefix", () => {
  it("registers under another prefix", () => {
    expect(defineEmptyState({ prefix: "acme" })).toBe("acme-empty-state");
    expect(defineErrorState({ prefix: "acme" })).toBe("acme-error-state");
    expect(defineForbiddenState({ prefix: "acme" })).toBe("acme-forbidden-state");
  });
});
