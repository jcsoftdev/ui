import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import {
  format,
  ICONS,
  isRtl,
  nearestIndex,
  prefersReducedMotion,
  stepIndex,
} from "../internal/e11.js";
import css from "./carousel.css.js";

const LABELS = {
  "hint-label": "use the arrow keys to change slide",
  "previous-label": "Previous slide",
  "next-label": "Next slide",
  "pause-label": "Pause automatic slide show",
  "play-label": "Start automatic slide show",
  "dot-label": "Go to slide {n}",
  "slide-label": "{n} of {count}",
} as const;

const part = (name: string, tag = "div") => {
  const element = document.createElement(tag);
  element.dataset.uiPart = name;
  return element;
};

/**
 * `<ui-carousel>`: a scroll-snap carousel following the WAI-ARIA carousel pattern. Its children are
 * the slides; native scrolling and swipe work with no script, and previous/next buttons, dots, the
 * arrow keys (Home/End) and optional auto-rotation are layered on top. The track is the single tab
 * stop. Slides per view follow the carousel's own width (1, 2 from 32rem, 3 from 48rem).
 *
 * Attributes: `label` (accessible name), `loop`, `autoplay` (interval in ms; empty = 5000; never
 * runs under `prefers-reduced-motion`, while hovered or focused, or after the pause button),
 * `no-dots`, `no-arrows`, and the text overrides `hint-label`, `previous-label`, `next-label`,
 * `pause-label`, `play-label`, `dot-label` (`{n}`) and `slide-label` (`{n}`, `{count}`).
 * Events: `change` with `{ index }` when the visible slide changes. Members: `index`, `count`,
 * `goTo(i)`, `next()`, `previous()`. Right-to-left is detected from the computed `direction`.
 */
export class UiCarousel extends ElementBase {
  static observedAttributes = [
    "label",
    "loop",
    "autoplay",
    "no-dots",
    "no-arrows",
    ...Object.keys(LABELS),
  ];
  #track = part("track");
  #controls = part("controls");
  #index = 0;
  #hovered = false;
  #focused = false;
  #userPaused = false;
  #timer: ReturnType<typeof setInterval> | undefined;
  #frame = 0;
  #travelling = false;
  #settle: ReturnType<typeof setTimeout> | undefined;
  #motion: MediaQueryList | undefined;
  #hostObserver: MutationObserver | undefined;
  #trackObserver: MutationObserver | undefined;
  #pause: HTMLButtonElement | undefined;
  #previous: HTMLButtonElement | undefined;
  #next: HTMLButtonElement | undefined;
  #dots: HTMLButtonElement[] = [];
  #built = "";

  constructor() {
    super();
    this.addEventListener("mouseenter", () => {
      this.#hovered = true;
      this.#syncTimer();
    });
    this.addEventListener("mouseleave", () => {
      this.#hovered = false;
      this.#syncTimer();
    });
    this.addEventListener("focusin", () => {
      this.#focused = true;
      this.#syncTimer();
    });
    this.addEventListener("focusout", (event) => {
      if (!this.contains(event.relatedTarget as Node | null)) {
        this.#focused = false;
        this.#syncTimer();
      }
    });
    this.#track.addEventListener("scroll", () => {
      cancelAnimationFrame(this.#frame);
      if (this.#travelling) {
        // A programmatic scroll is under way: the index is already its target. Re-read it once
        // the track stops moving, so a half-way frame never flickers the dots.
        this.#arm(120);
        return;
      }
      this.#frame = requestAnimationFrame(() => this.#syncIndex());
    });
    this.#track.addEventListener("scrollend", () => {
      if (this.#travelling) this.#land();
    });
    this.#track.addEventListener("keydown", (event) => {
      const forward = isRtl(this) ? "ArrowLeft" : "ArrowRight";
      const backward = isRtl(this) ? "ArrowRight" : "ArrowLeft";
      if (event.key === forward) this.#key(event, () => this.next());
      else if (event.key === backward) this.#key(event, () => this.previous());
      else if (event.key === "Home") this.#key(event, () => this.goTo(0));
      else if (event.key === "End") this.#key(event, () => this.goTo(this.count - 1));
    });
  }

  /** Gives a programmatic scroll `ms` to show a first frame before the index is re-read. */
  #arm(ms: number): void {
    clearTimeout(this.#settle);
    this.#settle = setTimeout(() => this.#land(), ms);
  }

  #land(): void {
    clearTimeout(this.#settle);
    this.#travelling = false;
    this.#syncIndex();
  }

  get count(): number {
    return this.#slides().length;
  }
  get index(): number {
    return this.#index;
  }
  set index(value: number) {
    this.goTo(value);
  }

  connectedCallback(): void {
    this.dataset.ui = "carousel";
    adoptStyles(rootOf(this), css);
    this.setAttribute("role", "region");
    this.setAttribute("aria-roledescription", "carousel");
    this.#track.tabIndex = 0;
    this.#track.setAttribute("role", "group");
    this.prepend(this.#track);
    this.append(this.#controls);
    this.#adopt();
    this.#hostObserver = new MutationObserver(() => this.#adopt());
    this.#hostObserver.observe(this, { childList: true });
    this.#trackObserver = new MutationObserver(() => this.#render());
    this.#trackObserver.observe(this.#track, { childList: true });
    this.#motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.#motion.addEventListener("change", this.#onMotion);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#hostObserver?.disconnect();
    this.#trackObserver?.disconnect();
    this.#motion?.removeEventListener("change", this.#onMotion);
    cancelAnimationFrame(this.#frame);
    clearTimeout(this.#settle);
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#render();
  }

  goTo(target: number): void {
    const slide = this.#slides()[target];
    if (!slide) return;
    const track = this.#track;
    const rtl = isRtl(track);
    const t = track.getBoundingClientRect();
    const s = slide.getBoundingClientRect();
    const delta = rtl ? s.right - t.right : s.left - t.left;
    this.#travelling = delta !== 0;
    if (this.#travelling) this.#arm(600);
    track.scrollBy({ left: delta, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    this.#setIndex(target);
  }

  next(): void {
    this.goTo(stepIndex(this.#index, this.count, 1, this.hasAttribute("loop")));
  }

  previous(): void {
    this.goTo(stepIndex(this.#index, this.count, -1, this.hasAttribute("loop")));
  }

  #text(name: keyof typeof LABELS): string {
    return this.getAttribute(name) ?? LABELS[name];
  }

  #key(event: KeyboardEvent, action: () => void): void {
    event.preventDefault();
    action();
  }

  #slides(): HTMLElement[] {
    return [...this.#track.children] as HTMLElement[];
  }

  /** Slides authored after connecting land in the host; the track owns them. */
  #adopt(): void {
    for (const child of [...this.children]) {
      if (child !== this.#track && child !== this.#controls) this.#track.append(child);
    }
  }

  readonly #onMotion = (): void => this.#syncTimer();

  get #interval(): number {
    const value = this.getAttribute("autoplay");
    if (value === null) return 0;
    const ms = Number(value);
    return ms > 0 ? ms : 5000;
  }

  #syncTimer(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
    const interval = this.#interval;
    const playing =
      interval > 0 &&
      this.count > 1 &&
      !prefersReducedMotion() &&
      !this.#userPaused &&
      !this.#hovered &&
      !this.#focused;
    if (playing) this.#timer = setInterval(() => this.next(), interval);
    this.#track.setAttribute("aria-live", interval > 0 ? "off" : "polite");
    this.toggleAttribute("data-playing", playing);
  }

  #syncIndex(): void {
    const track = this.#track;
    const slides = this.#slides();
    if (slides.length === 0) return;
    const rtl = isRtl(track);
    const t = track.getBoundingClientRect();
    const atEnd =
      Math.abs(track.scrollLeft) > 0 &&
      Math.abs(track.scrollLeft) + track.clientWidth >= track.scrollWidth - 2;
    const offsets = slides.map((slide) => {
      const s = slide.getBoundingClientRect();
      return rtl ? t.right - s.right : s.left - t.left;
    });
    this.#setIndex(atEnd ? slides.length - 1 : nearestIndex(0, offsets));
  }

  #setIndex(index: number): void {
    if (index === this.#index) return;
    this.#index = index;
    this.#sync();
    emit(this, "change", { index });
  }

  #render(): void {
    const label = this.getAttribute("label");
    if (label) this.setAttribute("aria-label", label);
    else this.removeAttribute("aria-label");
    const slides = this.#slides();
    const count = slides.length;
    this.#index = Math.min(this.#index, Math.max(0, count - 1));
    this.#track.setAttribute(
      "aria-label",
      `${label ?? ""}${label ? ": " : ""}${this.#text("hint-label")}`,
    );
    slides.forEach((slide, i) => {
      slide.dataset.uiSlide = "";
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", format(this.#text("slide-label"), { n: i + 1, count }));
    });
    this.#buildControls(count);
    this.#sync();
    this.#syncTimer();
  }

  #button(name: string, icon: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.uiPart = name;
    button.innerHTML = icon;
    return button;
  }

  #buildControls(count: number): void {
    const arrows = !this.hasAttribute("no-arrows");
    const dots = !this.hasAttribute("no-dots");
    const auto = this.#interval > 0;
    const signature = `${count}|${arrows}|${dots}|${auto}`;
    if (signature === this.#built) return;
    this.#built = signature;
    this.#controls.replaceChildren();
    this.#controls.hidden = count < 2 || !(arrows || dots || auto);
    this.#pause = this.#previous = this.#next = undefined;
    this.#dots = [];
    if (this.#controls.hidden) return;
    const start = part("group");
    if (auto) {
      this.#pause = this.#button("pause", ICONS.pause);
      this.#pause.addEventListener("click", () => {
        this.#userPaused = !this.#userPaused;
        this.#sync();
        this.#syncTimer();
      });
      start.append(this.#pause);
    }
    if (arrows) {
      this.#previous = this.#button("previous", ICONS.chevron);
      this.#previous.addEventListener("click", () => this.previous());
      start.append(this.#previous);
    }
    this.#controls.append(start);
    if (dots) {
      const row = part("dots");
      for (let i = 0; i < count; i += 1) {
        const dot = this.#button("dot", "");
        dot.addEventListener("click", () => this.goTo(i));
        this.#dots.push(dot);
        row.append(dot);
      }
      this.#controls.append(row);
    }
    if (arrows) {
      this.#next = this.#button("next", ICONS.chevron);
      this.#next.addEventListener("click", () => this.next());
      this.#controls.append(this.#next);
    }
  }

  #sync(): void {
    const count = this.count;
    const loop = this.hasAttribute("loop");
    if (this.#previous) {
      this.#previous.setAttribute("aria-label", this.#text("previous-label"));
      this.#previous.disabled = !loop && this.#index <= 0;
    }
    if (this.#next) {
      this.#next.setAttribute("aria-label", this.#text("next-label"));
      this.#next.disabled = !loop && this.#index >= count - 1;
    }
    if (this.#pause) {
      this.#pause.setAttribute(
        "aria-label",
        this.#text(this.#userPaused ? "play-label" : "pause-label"),
      );
      this.#pause.setAttribute("aria-pressed", String(this.#userPaused));
      this.#pause.innerHTML = this.#userPaused ? ICONS.play : ICONS.pause;
    }
    this.#dots.forEach((dot, i) => {
      dot.setAttribute("aria-label", format(this.#text("dot-label"), { n: i + 1 }));
      if (i === this.#index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    this.#slides().forEach((slide, i) => {
      slide.toggleAttribute("data-active", i === this.#index);
    });
  }
}

/** Registers `<ui-carousel>` (or `<prefix>-carousel`) and returns the tag. */
export function defineCarousel(options?: DefineOptions): string {
  return defineElement("carousel", UiCarousel, options);
}
