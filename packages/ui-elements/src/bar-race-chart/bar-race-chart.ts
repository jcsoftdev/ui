import {
  type RaceFrame,
  type RaceItem,
  raceItems,
  visibleMax,
} from "@jcsoftdev/ui-core/chart/race";
import { adoptStyles, type DefineOptions, defineElement, emit, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  join,
  svg,
} from "../internal/chart-base.js";
import css from "./bar-race-chart.css.js";

export type { RaceFrame } from "@jcsoftdev/ui-core/chart/race";

export interface BarRaceEntity {
  id: string;
  name: string;
  /** CSS color or token; defaults to the palette slot of the entity. */
  color?: string;
}

const ROW_GAP = 0.22;
const TOP = 4;
const RIGHT = 64;
const NAME_SIZE = 12;
const PLAY = "M8 5.5v13l11-6.5z";
const PAUSE = "M7 5v14M17 5v14";

const num = (value: string | null, fallback: number): number => {
  const n = Number(value);
  return value !== null && value !== "" && Number.isFinite(n) && n > 0 ? n : fallback;
};

type Bar = SVGGElement;

/**
 * `<ui-bar-race-chart>`: horizontal bars that grow, shrink and swap places as time moves through
 * `frames`, with play/pause, a moment slider and the frame label. Only the top `topn` bars race.
 * Under reduced motion (or `animate="off"`) it starts paused and steps from frame to frame.
 *
 * Properties: `entities` (`{ id, name, color? }[]`, ids must be unique), `frames` (`{ label, values }[]`, `values[i]`
 * belongs to `entities[i]`), `frame` (integer; setting it pauses), `position` (fractional),
 * `playing` (read only); methods `play()`, `pause()`, `toggle()`, `step(delta)`.
 * Attributes: `topn` (6), `frame-duration` (ms between two frames, 1400), `autoplay="off"`,
 * `loop="off"`, `play-label`, `pause-label`, `moment-label`, `category-label` (header of the screen-reader table), plus the chart attributes.
 * Events: `race-frame` (`{ index, label }` when the shown frame changes), `race-playing`
 * (`{ playing }`). The host carries `data-frame` and `data-playing`, so a test or a screenshot can
 * wait for a settled state: call `pause()`, or wait for `data-frame`.
 *
 * Keyboard: Tab reaches the play button, the moment slider and the bars. On the slider the arrows,
 * Home and End step a whole frame; on a bar the arrows walk the ranks, and PageUp/PageDown step
 * frames. Focusing a bar pauses the race so it holds still. The race also pauses while the chart is
 * offscreen or the tab is hidden, and resumes by itself.
 */
export class UiBarRaceChart extends ChartElement {
  static override retain = true;
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "topn",
    "frame-duration",
    "play-label",
    "pause-label",
    "moment-label",
    "category-label",
  ];

  #entities: readonly BarRaceEntity[] = [];
  #frames: readonly RaceFrame[] = [];
  #position = 0;
  #index = 0;
  #playing = false;
  #started = false;
  #visible = true;
  #raf = 0;
  #stamp: number | null = null;
  #stop: AbortController | undefined;
  #observer: IntersectionObserver | undefined;
  #caption: SVGTextElement | undefined;
  #bars: SVGGElement | undefined;
  #widest = 56;
  #still = false;

  readonly #controls = document.createElement("div");
  readonly #button: HTMLButtonElement;
  readonly #icon: SVGPathElement;
  readonly #slider: HTMLInputElement;
  readonly #text: HTMLElement;

  constructor() {
    super();
    this.#controls.dataset.uiPart = "controls";
    this.#controls.innerHTML =
      '<button type="button" data-ui-part="play"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<input type="range" min="0" step="0.01" data-ui-part="moment">' +
      '<span data-ui-part="caption" aria-hidden="true"></span>';
    this.#button = this.#controls.querySelector("button") as HTMLButtonElement;
    this.#icon = this.#controls.querySelector("path") as SVGPathElement;
    this.#slider = this.#controls.querySelector("input") as HTMLInputElement;
    this.#text = this.#controls.querySelector("span") as HTMLElement;
  }

  get entities(): readonly BarRaceEntity[] {
    return this.#entities;
  }
  set entities(value: readonly BarRaceEntity[]) {
    this.#entities = value;
    let widest = 0;
    const ids = new Set<string>();
    for (const entity of value) {
      widest = Math.max(widest, entity.name.length * NAME_SIZE * 0.58);
      ids.add(entity.id);
    }
    if (ids.size !== value.length)
      console.warn(
        "ui-bar-race-chart: entity ids must be unique; bars with a repeated id are not drawn.",
      );
    this.#widest = widest;
    this.#changed();
  }
  get frames(): readonly RaceFrame[] {
    return this.#frames;
  }
  set frames(value: readonly RaceFrame[]) {
    this.#frames = value;
    this.#position = Math.min(this.#position, this.#last);
    this.#changed();
  }
  /** The frames cut or padded to one value per entity, so a ragged frame cannot reach the maths. */
  #view: readonly RaceFrame[] = [];

  /** Whether the race is running (it still counts as playing while paused offscreen or in a hidden tab). */
  get playing(): boolean {
    return this.#playing;
  }
  /** The frame shown, as an integer. Setting it pauses the race and jumps there. */
  get frame(): number {
    return this.#index;
  }
  set frame(value: number) {
    this.pause();
    this.position = Math.round(value);
  }
  /** Fractional position between frames (2.5 is half way from frame 2 to 3). Does not change play state. */
  get position(): number {
    return this.#position;
  }
  set position(value: number) {
    this.#move(Math.min(this.#last, Math.max(0, Number.isFinite(value) ? value : 0)));
  }

  play(): void {
    if (this.#position >= this.#last) this.#move(0);
    this.#setPlaying(true);
  }
  pause(): void {
    this.#setPlaying(false);
  }
  toggle(): void {
    if (this.#playing) this.pause();
    else this.play();
  }
  /** Pauses and moves `delta` whole frames from the one shown (negative goes back), stopping at the ends. */
  step(delta = 1): void {
    this.frame = Math.min(this.#last, Math.max(0, Math.round(this.#position) + delta));
  }

  /** Reduced motion or `animate="off"`: the bars jump from frame to frame instead of gliding. */
  get #calm(): boolean {
    return this.#still || this.getAttribute("animate") === "off";
  }
  get #last(): number {
    return Math.max(0, this.#frames.length - 1);
  }
  get #limit(): number {
    return Math.max(
      1,
      Math.min(Math.floor(num(this.getAttribute("topn"), 6)), this.#entities.length),
    );
  }

  protected override isEmpty(): boolean {
    return this.#entities.length === 0 || this.#frames.length === 0;
  }

  override connectedCallback(): void {
    this.dataset.ui = "bar-race-chart";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
    this.append(this.#controls);
    const stop = new AbortController();
    this.#stop = stop;
    const { signal } = stop;
    this.#button.addEventListener("click", () => this.toggle(), { signal });
    this.#slider.addEventListener(
      "input",
      () => {
        const value = Number(this.#slider.value);
        this.pause();
        this.position = value;
      },
      { signal },
    );
    this.#slider.addEventListener("keydown", (event) => this.#slideKey(event), { signal });
    this.addEventListener("focusin", (event) => this.#focus(event), { signal });
    // Capture: the base maps PageUp/PageDown to its own roving moves and would take them first.
    this.addEventListener("keydown", (event) => this.#pageKey(event), { signal, capture: true });
    document.addEventListener("visibilitychange", () => this.#sync(), { signal });
    const quiet = matchMedia("(prefers-reduced-motion: reduce)");
    this.#still = quiet.matches;
    quiet.addEventListener(
      "change",
      (event) => {
        this.#still = event.matches;
        if (event.matches) this.pause();
        this.requestDraw("transient");
      },
      { signal },
    );
    if (typeof IntersectionObserver === "function") {
      this.#observer = new IntersectionObserver((entries) => {
        this.#visible = entries[entries.length - 1]?.isIntersecting ?? true;
        this.#sync();
      });
      this.#observer.observe(this);
    }
    if (!this.#started) {
      this.#started = true;
      this.#playing = this.getAttribute("autoplay") !== "off";
    }
    // Reduced motion (also on a reconnect) never plays on its own.
    if (this.#calm) this.#playing = false;
    this.#syncControls();
    this.#sync();
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#stamp = null;
    this.#stop?.abort();
    this.#observer?.disconnect();
    this.#observer = undefined;
    this.#controls.remove();
    super.disconnectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (this.isConnected) this.#syncControls();
  }

  // ---- playback -------------------------------------------------------------------------------

  #changed(): void {
    this.#view = this.#frames.map((frame) => ({
      label: frame.label,
      values: this.#entities.map((_, i) => frame.values[i] ?? 0),
    }));
    this.#syncIndex();
    this.#syncControls();
    this.requestDraw();
    this.#sync();
  }

  #setPlaying(value: boolean): void {
    if (this.#playing === value) return;
    this.#playing = value;
    this.#syncControls();
    emit(this, "race-playing", { playing: value });
    this.#sync();
  }

  /** Runs the animation loop only while the race is playing, on screen, in a visible tab. */
  #sync(): void {
    const run =
      this.#playing &&
      this.#last > 0 &&
      this.#visible &&
      this.isConnected &&
      document.visibilityState !== "hidden";
    if (run && !this.#raf) {
      this.#stamp = null;
      this.#raf = requestAnimationFrame(this.#tick);
    } else if (!run && this.#raf) {
      cancelAnimationFrame(this.#raf);
      this.#raf = 0;
      this.#stamp = null;
    }
  }

  readonly #tick = (now: number): void => {
    this.#raf = 0;
    const last = this.#last;
    const duration = num(this.getAttribute("frame-duration"), 1400);
    const previous = this.#stamp ?? now;
    this.#stamp = now;
    let next = this.#position + (now - previous) / duration;
    let ended = false;
    if (next >= last) {
      if (this.getAttribute("loop") === "off") {
        next = last;
        ended = true;
      } else next -= last;
    }
    this.#move(next);
    if (ended) this.#setPlaying(false);
    else if (this.#playing) this.#raf = requestAnimationFrame(this.#tick);
  };

  #move(position: number): void {
    this.#position = position;
    const before = this.#index;
    this.#syncIndex();
    // Under reduced motion the bars step, so a tween between two frames is not worth a redraw.
    if (!this.#calm || before !== this.#index) this.requestDraw("transient");
    if (before !== this.#index)
      emit(this, "race-frame", { index: this.#index, label: this.#frames[this.#index]?.label });
  }

  #syncIndex(): void {
    this.#index = Math.min(this.#last, Math.round(this.#position));
    this.dataset.frame = `${this.#index}`;
  }

  // ---- controls and keyboard -------------------------------------------------------------------

  #frameLabel(): string {
    return this.#frames[this.#index]?.label ?? "";
  }

  #syncControls(): void {
    this.#controls.hidden = this.isEmpty() || this.hasAttribute("loading");
    this.toggleAttribute("data-playing", this.#playing);
    this.#button.setAttribute(
      "aria-label",
      this.#playing
        ? (this.getAttribute("pause-label") ?? "Pause")
        : (this.getAttribute("play-label") ?? "Play"),
    );
    this.#icon.setAttribute("d", this.#playing ? PAUSE : PLAY);
    this.#icon.setAttribute("fill", this.#playing ? "none" : "currentColor");
    this.#icon.setAttribute("stroke-width", this.#playing ? "3.4" : "1.5");
    this.#slider.setAttribute("aria-label", this.getAttribute("moment-label") ?? "Moment");
    this.#slider.max = `${this.#last}`;
    this.#slider.disabled = this.#last === 0;
    this.#showMoment();
  }

  #showMoment(): void {
    const value = `${Math.min(this.#position, this.#last)}`;
    if (this.#slider.value !== value) this.#slider.value = value;
    const caption = this.#frameLabel();
    this.#slider.setAttribute("aria-valuetext", caption);
    if (this.#text.textContent !== caption) this.#text.textContent = caption;
  }

  #slideKey(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const rtl = getComputedStyle(this).direction === "rtl" ? -1 : 1;
    const { key } = event;
    const by =
      key === "ArrowRight"
        ? rtl
        : key === "ArrowLeft"
          ? -rtl
          : key === "ArrowUp" || key === "PageUp"
            ? 1
            : key === "ArrowDown" || key === "PageDown"
              ? -1
              : 0;
    if (key === "Home") this.frame = 0;
    else if (key === "End") this.frame = this.#last;
    else if (by) this.step(by);
    else return;
    event.preventDefault();
  }

  /** PageUp and PageDown on a bar step the frames; the arrows stay with the ranks. */
  #pageKey(event: KeyboardEvent): void {
    if (event.defaultPrevented || event.target === this.#slider || event.altKey) return;
    if (!this.drawing.contains(event.target as Node)) return;
    if (event.key !== "PageUp" && event.key !== "PageDown") return;
    event.preventDefault();
    this.step(event.key === "PageUp" ? 1 : -1);
  }

  /** A bar that takes keyboard focus holds still: ranks would otherwise move under the reader. */
  #focus(event: FocusEvent): void {
    if (this.drawing.contains(event.target as Node) && this.#playing) this.pause();
  }

  // ---- drawing -------------------------------------------------------------------------------

  protected override draw({
    svg: root,
    width,
    height,
    format,
    color,
    phase,
    motion,
  }: DrawContext): DrawResult {
    const entities = this.#entities;
    const limit = this.#limit;
    const shown = motion ? this.#position : Math.round(this.#position);
    const items = raceItems(this.#view, shown);
    const max = visibleMax(items, limit) || 1;
    const left = Math.min(width * 0.34, Math.max(56, this.#widest + 12));
    const innerWidth = Math.max(20, width - left - RIGHT);
    const rowHeight = Math.max(14, (height - 8) / limit);
    const barHeight = rowHeight * (1 - ROW_GAP);
    const caption = this.#frameLabel();
    this.#showMoment();

    if (phase === "enter" || !this.#bars?.isConnected) {
      this.#caption = svg("text", {
        "text-anchor": "end",
        "aria-hidden": "true",
        "pointer-events": "none",
        "data-ui-part": "frame-label",
        style:
          "font-size:40px;font-weight:800;font-variant-numeric:tabular-nums;fill:var(--ink-3);fill-opacity:.22",
      });
      this.#bars = svg("g", { "data-ui-part": "bars" });
      root.replaceChildren(this.#caption, this.#bars);
    }
    const label = this.#caption as SVGTextElement;
    label.setAttribute("x", `${width - 2}`);
    label.setAttribute("y", `${height - 6}`);
    if (label.textContent !== caption) label.textContent = caption;
    const group = this.#bars as SVGGElement;
    group.setAttribute("transform", `translate(${left},${TOP})`);

    const drawn = items.filter((item) => item.rank < limit + 1).sort((a, b) => a.rank - b.rank);
    const geometry = (item: RaceItem) => ({
      y: item.rank * rowHeight + (rowHeight - barHeight) / 2,
      length: Math.max(2, (item.value / max) * innerWidth),
    });
    const elements = join<RaceItem, Bar>(
      group,
      drawn,
      (item) => (entities[item.index] as BarRaceEntity).id,
      (item) => {
        const entity = entities[item.index] as BarRaceEntity;
        return svg(
          "g",
          { "data-entity": entity.id },
          svg("rect", { rx: 0 }),
          svg("text", {
            x: -10,
            "text-anchor": "end",
            dy: "0.34em",
            style: "font-size:12px;font-weight:600;fill:var(--ink-2)",
          }),
          svg("text", {
            dy: "0.34em",
            style:
              "font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;fill:var(--ink-2)",
          }),
        );
      },
      (el, item) => {
        const entity = entities[item.index] as BarRaceEntity;
        const { y, length } = geometry(item);
        const [rect, name, value] = el.children as unknown as [
          SVGRectElement,
          SVGTextElement,
          SVGTextElement,
        ];
        el.setAttribute("transform", `translate(0,${y})`);
        el.style.opacity = `${Math.min(1, Math.max(0, limit - item.rank))}`;
        rect.setAttribute("width", `${length}`);
        rect.setAttribute("height", `${barHeight}`);
        rect.setAttribute("rx", `${Math.min(6, barHeight / 2)}`);
        rect.style.fill = entity.color ?? color(item.index);
        name.setAttribute("y", `${barHeight / 2}`);
        if (name.textContent !== entity.name) name.textContent = entity.name;
        value.setAttribute("x", `${length + 8}`);
        value.setAttribute("y", `${barHeight / 2}`);
        value.textContent = format(item.value);
      },
    );
    const racing = drawn.slice(0, limit);
    elements.forEach((el, i) => {
      const hidden = i >= limit;
      el.toggleAttribute("aria-hidden", hidden);
      // A bar that dropped out of the top is no longer a mark: shed what the base gave it.
      if (hidden) for (const name of ["role", "tabindex", "aria-label"]) el.removeAttribute(name);
    });

    // TODO(#108): key the marks by entity id once the base takes per-mark identity keys, so a pin and
    // the keyboard focus follow the bar instead of its rank slot when ranks change.
    const marks: ChartMark[] = racing.map((item, i) => ({
      el: elements[i] as Bar,
      label: `${(entities[item.index] as BarRaceEntity).name}: ${format(item.value)}, #${i + 1}`,
    }));
    const leader = racing[0] && (entities[racing[0].index] as BarRaceEntity).name;
    const view = this.#view;
    const shownFrame = this.#index;
    const title = this.getAttribute("label") ?? "";
    const description = this.getAttribute("description");
    return {
      summary: leader ? `${caption}. #1 ${leader}` : caption,
      marks,
      maxHoverRows: 1,
      hit: (_x, y) => {
        const row = (y - TOP) / rowHeight;
        if (row < 0 || row > limit || racing.length === 0) return -1;
        let best = 0;
        for (let i = 1; i < racing.length; i++)
          if (
            Math.abs((racing[i] as RaceItem).rank + 0.5 - row) <
            Math.abs((racing[best] as RaceItem).rank + 0.5 - row)
          )
            best = i;
        return best;
      },
      hover: (index) => {
        const item = racing[index];
        if (!item) return null;
        const entity = entities[item.index] as BarRaceEntity;
        const { y, length } = geometry(item);
        return {
          title: entity.name,
          rows: [
            {
              id: entity.id,
              name: caption,
              // The value of the frame the row is named after, not the one in between.
              value: format(view[shownFrame]?.values[item.index] ?? 0),
              color: entity.color ?? color(item.index),
              note: `#${index + 1}`,
            },
          ],
          x: left + length,
          y: TOP + y + barHeight / 2,
        };
      },
      snapshot: () => ({
        title: description ? `${title}. ${description}` : title,
        categoryHeader: this.getAttribute("category-label") ?? "Category",
        categories: entities.map((entity) => entity.name),
        series: view.map((frame, i) => ({
          id: `${i}-${frame.label}`,
          name: frame.label,
          color: color(0),
          values: frame.values,
          text: frame.values.map((v) => format(v)),
        })),
        legend: [],
      }),
    };
  }
}

/** Registers `<ui-bar-race-chart>` (or `<prefix>-bar-race-chart`) and returns the tag. */
export function defineBarRaceChart(options?: DefineOptions): string {
  return defineElement("bar-race-chart", UiBarRaceChart, options);
}
