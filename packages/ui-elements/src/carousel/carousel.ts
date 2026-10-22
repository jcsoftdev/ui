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
 * stop. Slides per view follow the carousel's own width (1, 2 from 32rem, 3 from 48rem); the dots,
 * stepping and `index` count snap points (positions the track can rest on), so the last slides
 * stay reachable with more than one slide per view. Slides out of view are `inert`; the slide
 * change is announced from a visually hidden status node.
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
  #status = part("status");
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
  #resize: ResizeObserver | undefined;
  #pause = this.#button("pause", ICONS.pause);
  #previous: HTMLButtonElement | undefined;
  #next: HTMLButtonElement | undefined;
  #dots: HTMLButtonElement[] = [];
  #built = "";
  #snapList: number[] = [0];
  #snapSlide: number[] = [0];

  constructor() {
    super();
    this.#status.setAttribute("role", "status");
    this.#pause.addEventListener("click", () => {
      this.#userPaused = !this.#userPaused;
      this.#sync();
      this.#syncTimer();
    });
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
      else if (event.key === "End") this.#key(event, () => this.goTo(this.snapCount - 1));
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

  /** Number of slides. */
  get count(): number {
    return this.#slides().length;
  }
  /** Number of positions the track can rest on (fewer than `count` with several slides per view). */
  get snapCount(): number {
    return this.#snapList.length;
  }
  /** Current snap point. */
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
    // The rotation control comes first in tab order, before the slides (APG).
    this.prepend(this.#pause, this.#track);
    this.append(this.#controls, this.#status);
    this.#adopt();
    this.#hostObserver = new MutationObserver(() => this.#adopt());
    this.#hostObserver.observe(this, { childList: true });
    this.#trackObserver = new MutationObserver(() => this.#render());
    this.#trackObserver.observe(this.#track, { childList: true });
    this.#resize = new ResizeObserver(() => this.#render());
    this.#resize.observe(this.#track);
    this.#motion = matchMedia("(prefers-reduced-motion: reduce)");
    this.#motion.addEventListener("change", this.#onMotion);
    this.#render();
  }

  disconnectedCallback(): void {
    this.#hostObserver?.disconnect();
    this.#trackObserver?.disconnect();
    this.#resize?.disconnect();
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
    const left = this.#snapList[target];
    if (left === undefined) return;
    const track = this.#track;
    const delta = left - Math.abs(track.scrollLeft);
    this.#travelling = delta !== 0;
    if (this.#travelling) this.#arm(600);
    const sign = isRtl(track) ? -1 : 1;
    track.scrollTo({ left: sign * left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    this.#setIndex(target);
  }

  next(): void {
    this.goTo(stepIndex(this.#index, this.snapCount, 1, this.hasAttribute("loop")));
  }

  previous(): void {
    this.goTo(stepIndex(this.#index, this.snapCount, -1, this.hasAttribute("loop")));
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
      if (
        child !== this.#track &&
        child !== this.#controls &&
        child !== this.#pause &&
        child !== this.#status
      )
        this.#track.append(child);
    }
  }

  readonly #onMotion = (): void => {
    this.#sync();
    this.#syncTimer();
  };

  get #interval(): number {
    const value = this.getAttribute("autoplay");
    if (value === null) return 0;
    const ms = Number(value);
    return ms > 0 ? ms : 5000;
  }

  /** Snap points from the slide offsets, clamped to the scrollable range and deduplicated. */
  #measure(): void {
    const track = this.#track;
    const slides = this.#slides();
    const rtl = isRtl(track);
    const t = track.getBoundingClientRect();
    const pos = Math.abs(track.scrollLeft);
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    const snaps: number[] = [];
    const owners: number[] = [];
    slides.forEach((slide, i) => {
      const s = slide.getBoundingClientRect();
      const offset = rtl ? t.right - s.right + pos : s.left - t.left + pos;
      const snap = Math.round(Math.min(max, Math.max(0, offset)));
      if (!snaps.some((x) => Math.abs(x - snap) <= 1)) {
        snaps.push(snap);
        owners.push(i);
      }
    });
    this.#snapList = snaps.length > 0 ? snaps : [0];
    this.#snapSlide = owners.length > 0 ? owners : [0];
  }

  #syncTimer(): void {
    clearInterval(this.#timer);
    this.#timer = undefined;
    const interval = this.#interval;
    const loop = this.hasAttribute("loop");
    const playing =
      interval > 0 &&
      this.snapCount > 1 &&
      !prefersReducedMotion() &&
      !this.#userPaused &&
      !this.#hovered &&
      !this.#focused &&
      (loop || this.#index < this.snapCount - 1);
    if (playing) {
      this.#timer = setInterval(() => {
        // Without loop the show ends on the last slide.
        if (!loop && this.#index >= this.snapCount - 1) this.#syncTimer();
        else this.next();
      }, interval);
    }
    const live = playing ? "off" : "polite";
    this.#track.setAttribute("aria-live", live);
    this.#status.setAttribute("aria-live", live);
    this.toggleAttribute("data-playing", playing);
  }

  #syncIndex(): void {
    this.#measure();
    const pos = Math.abs(this.#track.scrollLeft);
    this.#setIndex(nearestIndex(pos, this.#snapList));
    this.#syncVisible();
  }

  #setIndex(index: number): void {
    if (index === this.#index) return;
    this.#index = index;
    this.#sync();
    const slide = this.#snapSlide[index] ?? index;
    this.#status.textContent = format(this.#text("slide-label"), {
      n: slide + 1,
      count: this.count,
    });
    emit(this, "change", { index });
    this.#syncTimer();
  }

  /** Slides out of view are inert (not focusable, hidden from assistive technology). */
  #syncVisible(): void {
    const t = this.#track.getBoundingClientRect();
    const many = this.snapCount > 1 && t.width > 0;
    for (const slide of this.#slides()) {
      const s = slide.getBoundingClientRect();
      const overlap = Math.min(s.right, t.right) - Math.max(s.left, t.left);
      slide.inert = many && overlap < s.width / 2;
    }
  }

  #render(): void {
    const label = this.getAttribute("label");
    if (label) this.setAttribute("aria-label", label);
    else this.removeAttribute("aria-label");
    const slides = this.#slides();
    const count = slides.length;
    for (const slide of slides) slide.dataset.uiSlide = "";
    this.#measure();
    this.#index = Math.min(this.#index, this.snapCount - 1);
    this.#track.setAttribute(
      "aria-label",
      `${label ?? ""}${label ? ": " : ""}${this.#text("hint-label")}`,
    );
    slides.forEach((slide, i) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "slide");
      slide.setAttribute("aria-label", format(this.#text("slide-label"), { n: i + 1, count }));
    });
    this.#buildControls();
    this.#sync();
    this.#syncVisible();
    this.#syncTimer();
  }

  #button(name: string, icon: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.uiPart = name;
    button.innerHTML = icon;
    return button;
  }

  #buildControls(): void {
    const snaps = this.snapCount;
    const arrows = !this.hasAttribute("no-arrows");
    const dots = !this.hasAttribute("no-dots");
    const signature = `${snaps}|${arrows}|${dots}`;
    if (signature === this.#built) return;
    this.#built = signature;
    this.#controls.replaceChildren();
    this.#controls.hidden = snaps < 2 || !(arrows || dots);
    this.#previous = this.#next = undefined;
    this.#dots = [];
    if (this.#controls.hidden) return;
    if (arrows) {
      this.#previous = this.#button("previous", ICONS.chevron);
      this.#previous.addEventListener("click", () => this.previous());
      this.#controls.append(this.#previous);
    }
    if (dots) {
      const row = part("dots");
      for (let i = 0; i < snaps; i += 1) {
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
    const snaps = this.snapCount;
    const loop = this.hasAttribute("loop");
    if (this.#previous) {
      this.#previous.setAttribute("aria-label", this.#text("previous-label"));
      this.#previous.disabled = !loop && this.#index <= 0;
    }
    if (this.#next) {
      this.#next.setAttribute("aria-label", this.#text("next-label"));
      this.#next.disabled = !loop && this.#index >= snaps - 1;
    }
    // Nothing rotates under reduced motion or with one position, so the control would do nothing.
    this.#pause.hidden = this.#interval === 0 || snaps < 2 || prefersReducedMotion();
    this.#pause.setAttribute(
      "aria-label",
      this.#text(this.#userPaused ? "play-label" : "pause-label"),
    );
    this.#pause.setAttribute("aria-pressed", String(this.#userPaused));
    this.#pause.innerHTML = this.#userPaused ? ICONS.play : ICONS.pause;
    this.#dots.forEach((dot, i) => {
      dot.setAttribute("aria-label", format(this.#text("dot-label"), { n: i + 1 }));
      if (i === this.#index) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    const first = this.#snapSlide[this.#index] ?? 0;
    this.#slides().forEach((slide, i) => {
      slide.toggleAttribute("data-active", i === first);
    });
  }
}

/** Registers `<ui-carousel>` (or `<prefix>-carousel`) and returns the tag. */
export function defineCarousel(options?: DefineOptions): string {
  return defineElement("carousel", UiCarousel, options);
}
