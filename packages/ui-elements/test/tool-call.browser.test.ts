import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineCodeBlock } from "../src/code-block/code-block.ts";
import { defineToolCall } from "../src/tool-call/tool-call.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineToolCall();
});

afterEach(() => {
  document.body.innerHTML = "";
});

type ToolCallElement = HTMLElement & { args: unknown; result: unknown };

function make(attrs: string) {
  const host = mount(`<ui-tool-call ${attrs}></ui-tool-call>`);
  return host.firstElementChild as ToolCallElement;
}

describe("ui-tool-call", () => {
  it("is a disclosure whose button carries the tool name and status", async () => {
    const element = make('name="find_slots" status="done" duration="1.2 s"');
    const trigger = element.querySelector("button") as HTMLButtonElement;
    const panel = element.querySelector("[role=region]") as HTMLElement;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    expect(panel.inert).toBe(true);
    expect(await ax("button", "find_slots Done · 1.2 s")).toBeTruthy();
    await userEvent.click(trigger);
    expect((await ax("button", "find_slots Done · 1.2 s"))?.properties.expanded).toBe(true);
    expect(await ax("region", "find_slots Done · 1.2 s")).toBeTruthy();
  });

  it("shows arguments and result as labelled formatted JSON, objects through the property", () => {
    const element = make('name="find_slots" status="done" open');
    element.args = { day: "2026-10-13", barber: 3 };
    element.result = '{"slots":["10:00"]}';
    const sections = [...element.querySelectorAll("section")];
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual(["Arguments", "Result"]);
    expect(sections[0]?.querySelector("code")?.textContent).toBe(
      JSON.stringify({ day: "2026-10-13", barber: 3 }, null, 2),
    );
    expect(sections[1]?.querySelector("code")?.textContent).toBe('{"slots":["10:00"]}');
  });

  it("shows the error as an alert only for status error", () => {
    const element = make('name="x" status="error" error="Timed out"');
    expect(element.querySelector("[role=alert]")?.textContent).toBe("Timed out");
    element.setAttribute("status", "done");
    expect(element.querySelector("[role=alert]")).toBeNull();
  });

  it("never turns arguments into markup", () => {
    const element = make('name="x" status="done" open');
    element.args = '<img src=x onerror="window.__xss=1"><script>window.__xss=1</script>';
    element.result = { html: "<svg onload=window.__xss=1>" };
    expect(element.querySelector("img, script, svg:not([data-ui-part=chevron])")).toBeNull();
    expect(element.textContent).toContain("<img src=x");
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("uses a defined code-block under the same prefix, and a plain pre otherwise", () => {
    const plain = make('name="x" open');
    plain.args = { a: 1 };
    expect(plain.querySelector("pre")).toBeTruthy();
    expect(plain.querySelector("ui-code-block")).toBeNull();

    defineCodeBlock();
    const rich = make('name="x" open');
    rich.args = { a: 1 };
    const block = rich.querySelector("ui-code-block");
    expect(block?.getAttribute("language")).toBe("json");
    expect(block?.getAttribute("code")).toBe(JSON.stringify({ a: 1 }, null, 2));
  });

  it("treats inherited property names as an unknown status", () => {
    const element = make('name="x" status="constructor"');
    expect(element.dataset.status).toBe("pending");
    expect(element.textContent).toContain("Waiting");
  });

  it("labels sections as groups, not region landmarks", async () => {
    const element = make('name="x" status="done" open');
    element.args = { a: 1 };
    element.result = { b: 2 };
    expect(element.querySelectorAll("[role=group]").length).toBe(2);
    expect(element.querySelectorAll("section[role=group]").length).toBe(2);
    expect(await ax("region", "Arguments")).toBeUndefined();
    expect(await ax("group", "Arguments")).toBeTruthy();
  });
});
