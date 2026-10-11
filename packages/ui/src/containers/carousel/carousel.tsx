"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { nearestIndex, stepIndex } from "./model.js";

export type CarouselPart =
  | "root"
  | "track"
  | "slide"
  | "controls"
  | "previous"
  | "next"
  | "playPause"
  | "dots"
  | "dot";

export interface CarouselProps extends Omit<ComponentPropsWithoutRef<"section">, "children"> {
  children: ReactNode;
  /** Accessible name of the carousel. */
  label: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<CarouselPart>;
  /** Classes for each slide's width. Default: 1 per view, 2 from 32rem, 3 from 48rem. Prefer `classNames.slide` to add classes without replacing this default. */
  slideClassName?: string;
  /** Wrap around at the ends. */
  loop?: boolean;
  /** Opt-in autoplay: interval in ms (true = 5000). Never runs under `prefers-reduced-motion`. */
  autoplay?: boolean | number;
  showDots?: boolean;
  showArrows?: boolean;
}

const iconButton =
  "pressable inline-flex size-control-sm shrink-0 cursor-pointer items-center justify-center rounded-button border-control bg-surface-control text-ink-2 hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Scroll-snap carousel. Native scrolling and swipe work with no JS; buttons, dots, arrow keys
 * and optional autoplay are layered on top. Slides per view follow the container width.
 */
export function Carousel({
  children,
  label,
  slideClassName = "basis-full @lg/carousel:basis-1/2 @3xl/carousel:basis-1/3",
  loop = false,
  autoplay = false,
  showDots = true,
  showArrows = true,
  className,
  classNames,
  ...props
}: CarouselProps) {
  const slides = Children.toArray(children);
  const count = slides.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  const offsets = useCallback(() => {
    const track = trackRef.current;
    if (!track) return [];
    return Array.from(track.querySelectorAll<HTMLElement>("[data-slide]")).map(
      (el) => el.offsetLeft - track.offsetLeft,
    );
  }, []);

  const syncIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    setIndex(atEnd && track.scrollLeft > 0 ? count - 1 : nearestIndex(track.scrollLeft, offsets()));
  }, [count, offsets]);

  const goTo = useCallback(
    (target: number) => {
      const track = trackRef.current;
      const left = offsets()[target];
      if (!track || left === undefined) return;
      track.scrollTo({ left, behavior: reduced ? "auto" : "smooth" });
    },
    [offsets, reduced],
  );

  const step = useCallback(
    (direction: 1 | -1) => goTo(stepIndex(index, count, direction, loop)),
    [goTo, index, count, loop],
  );

  const interval = typeof autoplay === "number" ? autoplay : autoplay ? 5000 : 0;
  const playing = interval > 0 && !reduced && !userPaused && !hovered && !focused;

  useEffect(() => {
    if (!playing || count < 2) return;
    const timer = window.setInterval(() => step(1), interval);
    return () => window.clearInterval(timer);
  }, [playing, interval, step, count]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goTo(count - 1);
    }
  };

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={label}
      className={cn(
        "@container/carousel flex min-w-0 flex-col gap-density",
        classNames?.root,
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    >
      <section
        ref={trackRef}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region must be keyboard reachable
        tabIndex={0}
        aria-live={interval > 0 ? "off" : "polite"}
        aria-label={`${label}: usa las flechas para cambiar de diapositiva`}
        onScroll={syncIndex}
        onKeyDown={onKeyDown}
        className={cn(
          "relative flex snap-x snap-mandatory gap-density overflow-x-auto scroll-smooth rounded-card outline-none [scrollbar-width:none] focus-visible:focus-ring motion-reduce:scroll-auto [&::-webkit-scrollbar]:hidden",
          classNames?.track,
        )}
      >
        {slides.map((slide, i) => (
          // biome-ignore lint/a11y/useSemanticElements: slide of a carousel, not a form group
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: slides are positional
            key={i}
            data-slide=""
            role="group"
            aria-roledescription="diapositiva"
            aria-label={`${i + 1} de ${count}`}
            className={cn("min-w-0 shrink-0 snap-start", slideClassName, classNames?.slide)}
          >
            {slide}
          </div>
        ))}
      </section>

      {count > 1 && (showArrows || showDots || interval > 0) ? (
        <div className={cn("flex items-center justify-between gap-density", classNames?.controls)}>
          <div className="flex items-center gap-density-sm">
            {showArrows ? (
              <button
                type="button"
                aria-label="Diapositiva anterior"
                disabled={!loop && index === 0}
                onClick={() => step(-1)}
                className={cn(iconButton, classNames?.previous)}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
            ) : null}
            {interval > 0 ? (
              <button
                type="button"
                aria-label={
                  userPaused ? "Reanudar reproducción automática" : "Pausar reproducción automática"
                }
                aria-pressed={userPaused}
                onClick={() => setUserPaused((paused) => !paused)}
                className={cn(iconButton, classNames?.playPause)}
              >
                {userPaused ? (
                  <Play className="size-4" aria-hidden="true" />
                ) : (
                  <Pause className="size-4" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
          {showDots ? (
            <div
              className={cn(
                "flex min-w-0 flex-wrap items-center justify-center gap-1.5",
                classNames?.dots,
              )}
            >
              {slides.map((_, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: positional dots
                  key={i}
                  type="button"
                  aria-label={`Ir a la diapositiva ${i + 1}`}
                  aria-current={i === index ? "true" : undefined}
                  onClick={() => goTo(i)}
                  className={cn(
                    "h-2 cursor-pointer rounded-badge transition-all duration-(--motion-duration) ease-style focus-visible:focus-ring",
                    i === index ? "w-5 bg-accent" : "w-2 bg-line-strong hover:bg-ink-3",
                    classNames?.dot,
                  )}
                />
              ))}
            </div>
          ) : null}
          {showArrows ? (
            <button
              type="button"
              aria-label="Diapositiva siguiente"
              disabled={!loop && index >= count - 1}
              onClick={() => step(1)}
              className={cn(iconButton, classNames?.next)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
