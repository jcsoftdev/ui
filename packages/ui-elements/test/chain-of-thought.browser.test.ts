import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import {
  defineChainOfThought,
  type ThoughtStep,
} from "../src/chain-of-thought/chain-of-thought.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineChainOfThought();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const STEPS: ThoughtStep[] = [
  { id: "a", label: "Read the request", status: "done", detail: "Two services" },
  { id: "b", label: "Query the calendar", status: "active" },
  { id: "c", label: "Write the answer", status: "pending" },
];

function make(attrs = "") {
  const host = mount(`<ui-chain-of-thought ${attrs}></ui-chain-of-thought>`);
  const element = host.querySelector("ui-chain-of-thought") as HTMLElement & {
    steps: ThoughtStep[];
  };
  element.steps = STEPS;
  const trigger = element.querySelector("button") as HTMLButtonElement;
  const panel = element.querySelector("[role=region]") as HTMLElement;
  return { element, trigger, panel };
}

describe("ui-chain-of-thought", () => {
  it("is a disclosure: aria-expanded, aria-controls and a region labelled by the button", async () => {
    const { trigger, panel } = make('heading="Thinking"');
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.getAttribute("aria-labelledby")).toBe(trigger.id);
    expect(panel.inert).toBe(true);
    const closed = await ax("button", "Thinking…");
    expect(closed?.properties.expanded).toBe(false);
    expect(await ax("region", "Thinking…")).toBeUndefined();

    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(panel.inert).toBe(false);
    expect((await ax("button", "Thinking…"))?.properties.expanded).toBe(true);
    expect(await ax("region", "Thinking…")).toBeTruthy();
  });

  it("toggles from the keyboard and announces open and close", async () => {
    const { element, trigger } = make();
    const events: string[] = [];
    element.addEventListener("open", () => events.push("open"));
    element.addEventListener("close", () => events.push("close"));
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    expect(element.hasAttribute("open")).toBe(true);
    await userEvent.keyboard(" ");
    expect(element.hasAttribute("open")).toBe(false);
    expect(events).toEqual(["open", "close"]);
  });

  it("follows the open attribute from outside", () => {
    const { element, trigger, panel } = make("open");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    element.removeAttribute("open");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(panel.inert).toBe(true);
  });

  it("names each step's status for screen readers and renders text, never markup", async () => {
    const { element, trigger } = make("open");
    element.steps = [
      { label: "Safe <img src=x onerror=alert(1)>", detail: "<b>bold</b>", status: "active" },
    ];
    await userEvent.click(trigger);
    await userEvent.click(trigger);
    const item = element.querySelector("li") as HTMLElement;
    expect(item.textContent).toContain("In progress: Safe <img src=x onerror=alert(1)>");
    expect(element.querySelector("img, b")).toBeNull();
    expect(element.getAttribute("aria-busy")).toBe("true");
  });

  it("reads steps from the JSON attribute and ignores malformed JSON", () => {
    const host = mount(
      `<ui-chain-of-thought steps='[{"label":"One"},{"label":"Two","status":"pending"}]'></ui-chain-of-thought>`,
    );
    const element = host.firstElementChild as HTMLElement;
    expect(element.querySelectorAll("li").length).toBe(2);
    expect(element.querySelector("li")?.getAttribute("data-status")).toBe("done");
    element.setAttribute("steps", "not json");
    expect(element.querySelectorAll("li").length).toBe(0);
  });
});
