import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineRating, roundRating, starFill, type UiRating } from "../src/rating/rating.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineRating();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const stars = (rating: UiRating) => [
  ...rating.shadowRoot!.querySelectorAll<HTMLElement>("[part=star]"),
];
/** A press on a star at a fraction of its physical width. */
function press(star: HTMLElement, fraction: number) {
  const rect = star.getBoundingClientRect();
  const init = {
    clientX: rect.left + rect.width * fraction,
    clientY: rect.top + rect.height / 2,
    pointerId: 5,
    pointerType: "mouse",
    bubbles: true,
    composed: true,
  };
  star.dispatchEvent(new PointerEvent("pointermove", init));
  star.dispatchEvent(new PointerEvent("pointerup", init));
}

describe("rating maths (React parity)", () => {
  it("rounds to the precision and fills stars by thirds of a unit", () => {
    expect(roundRating(3.3, 5, 0.5)).toBe(3.5);
    expect(roundRating(3.3, 5)).toBe(3);
    expect(roundRating(9, 5)).toBe(5);
    expect(roundRating(Number.NaN, 5)).toBe(0);
    expect([0, 1, 2, 3].map((i) => starFill(i, 1.5))).toEqual([1, 0.5, 0, 0]);
  });
});

describe("ui-rating", () => {
  it("is one slider with a single tab stop; read-only is an image with its value", async () => {
    mount(`<ui-rating aria-label="Quality" value="3"></ui-rating>
      <ui-rating aria-label="Service" value="4" readonly></ui-rating>`);
    await frame();
    const slider = await ax("slider", "Quality");
    expect(slider?.properties).toMatchObject({ valuemin: 0, valuemax: 5 });
    expect(slider?.value).toBe(3);
    expect(await ax("image", "Service: 4 of 5")).toBeTruthy();
    expect(await ax("slider", "Service")).toBeUndefined();
  });

  it("changes with the keys and fires input and change", async () => {
    const host = mount(`<ui-rating aria-label="Quality" value="2" precision="0.5"></ui-rating>`);
    const rating = host.querySelector<UiRating>("ui-rating")!;
    const change = vi.fn();
    rating.addEventListener("change", change);
    rating.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(rating.value).toBe("2.5");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(rating.value).toBe("1.5");
    await userEvent.keyboard("{End}");
    expect(rating.value).toBe("5");
    await userEvent.keyboard("{ArrowUp}");
    expect(change).toHaveBeenCalledTimes(4);
    await userEvent.keyboard("{Home}");
    expect(rating.value).toBe("0");
  });

  it("sets from the pointer, takes half stars, and clears on the current value", () => {
    const host = mount(`<ui-rating aria-label="Quality" precision="0.5"></ui-rating>`);
    const rating = host.querySelector<UiRating>("ui-rating")!;
    press(stars(rating)[2]!, 0.9);
    expect(rating.value).toBe("3");
    press(stars(rating)[3]!, 0.2);
    expect(rating.value).toBe("3.5");
    press(stars(rating)[3]!, 0.2);
    expect(rating.value).toBe("0");
    stars(rating)[3]!.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
    rating
      .shadowRoot!.querySelector("[part=stars]")!
      .dispatchEvent(new PointerEvent("pointerleave"));
    const fills = [...rating.shadowRoot!.querySelectorAll<HTMLElement>("[part=fill]")];
    expect(fills.map((fill) => fill.style.inlineSize)).toEqual(Array(5).fill("0%"));
  });

  it("mirrors keys and star halves in RTL", async () => {
    const host = mount(
      `<div dir="rtl"><ui-rating aria-label="Quality" precision="0.5"></ui-rating></div>`,
    );
    const rating = host.querySelector<UiRating>("ui-rating")!;
    rating.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(rating.value).toBe("0.5");
    press(stars(rating)[1]!, 0.8);
    expect(rating.value).toBe("1.5");
  });

  it("ignores input when read-only or disabled; submits, resets, required", () => {
    const host = mount(`<form><fieldset>
      <ui-rating name="score" value="2" required></ui-rating>
      <ui-rating name="ro" value="4" readonly></ui-rating></fieldset></form>`);
    const form = host.querySelector("form")!;
    const [score, ro] = host.querySelectorAll<UiRating>("ui-rating") as unknown as UiRating[];
    expect(new FormData(form).get("score")).toBe("2");
    press(stars(ro!)[0]!, 0.9);
    expect(ro!.value).toBe("4");
    press(stars(score!)[2]!, 0.9);
    press(stars(score!)[2]!, 0.9);
    expect(score!.value).toBe("0");
    expect(score!.validity.valueMissing).toBe(true);
    form.reset();
    expect(score!.value).toBe("2");
    host.querySelector("fieldset")!.disabled = true;
    press(stars(score!)[4]!, 0.9);
    expect(score!.value).toBe("2");
    expect(new FormData(form).has("score")).toBe(false);
  });
});
