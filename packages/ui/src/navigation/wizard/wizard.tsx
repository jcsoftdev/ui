"use client";

import {
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "../../atoms/button/button.js";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { Stepper } from "../stepper/stepper.js";
import { clampIndex, evaluateGates, formatStepOf, isAdvanceKey, type WizardGate } from "./model.js";

export type { WizardGate } from "./model.js";

export interface WizardStep {
  id: string;
  label: string;
  content: ReactNode;
  /**
   * Blocks "Next" for this step: `false` disables the button, a function runs when Next is
   * pressed (it may be async; `false` or a throw keeps the step).
   */
  canAdvance?: WizardGate;
}

export type WizardPart =
  | "root"
  | "stepper"
  | "heading"
  | "content"
  | "error"
  | "footer"
  | "back"
  | "next";

export interface WizardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "defaultValue" | "onChange"> {
  steps: readonly WizardStep[];
  /** Controlled current step id. */
  value?: string | undefined;
  /** Initial step id when uncontrolled (defaults to the first step). */
  defaultValue?: string | undefined;
  onValueChange?: ((stepId: string) => void) | undefined;
  /**
   * Runs before moving forward from a step, after that step's `canAdvance`. Return `false` (or
   * a promise of `false`) to stay. While it is pending the buttons show a busy state and a
   * second press is ignored.
   */
  onBeforeNext?: ((step: WizardStep, index: number) => boolean | Promise<boolean>) | undefined;
  /** Called by the last step's finish button; may return a promise (pending state, no double run). */
  onComplete?: (() => void | Promise<void>) | undefined;
  /** Overrides the localized labels. */
  backLabel?: string | undefined;
  nextLabel?: string | undefined;
  finishLabel?: string | undefined;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<WizardPart>;
}

/**
 * Multi-step flow on top of `Stepper`: the current step's content, then Back / Next / Finish.
 * Moving forward runs the step's `canAdvance` and `onBeforeNext`; the step heading takes focus
 * on every change so keyboard and screen-reader users land on the new step. Enter inside a
 * single-line input advances. Under 420px of its own width the step title becomes visible and
 * the buttons stack.
 */
export function Wizard({
  steps,
  value: valueProp,
  defaultValue,
  onValueChange,
  onBeforeNext,
  onComplete,
  backLabel,
  nextLabel,
  finishLabel,
  className,
  classNames,
  ...props
}: WizardProps) {
  const strings = useUiStrings();
  const [stepId, setStepId] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue ?? steps[0]?.id ?? "",
    onChange: onValueChange,
  });
  const found = steps.findIndex((step) => step.id === stepId);
  const index = clampIndex(found, steps.length);
  const current = steps[index];
  const isLast = index === steps.length - 1;

  const [pending, setPending] = useState<"next" | "finish" | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownIndex = useRef(index);

  useEffect(() => {
    if (shownIndex.current === index) return;
    shownIndex.current = index;
    headingRef.current?.focus();
  });

  if (!current) return null;

  const guarded = async (kind: "next" | "finish", run: () => Promise<void> | void) => {
    if (busy.current) return;
    busy.current = true;
    setPending(kind);
    setFailed(false);
    try {
      await run();
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const goTo = (target: number) => {
    const next = steps[clampIndex(target, steps.length)];
    if (next) setStepId(next.id);
  };

  const advance = () =>
    guarded(isLast ? "finish" : "next", async () => {
      const gates = await evaluateGates([
        current.canAdvance,
        onBeforeNext ? () => onBeforeNext(current, index) : undefined,
      ]);
      if (gates.failed) setFailed(true);
      if (!gates.ok) return;
      if (isLast) {
        try {
          await onComplete?.();
        } catch {
          setFailed(true);
        }
        return;
      }
      goTo(index + 1);
    });

  const blocked = current.canAdvance === false;
  const label = formatStepOf(strings.stepOf, {
    current: index + 1,
    total: steps.length,
    label: current.label,
  });

  return (
    <div
      {...props}
      data-pending={pending ?? undefined}
      className={cn("@container/wizard flex min-w-0 flex-col gap-3", classNames?.root, className)}
    >
      <Stepper
        aria-label={strings.steps}
        steps={steps.map(({ id, label: stepLabel }) => ({ id, label: stepLabel }))}
        currentStepId={current.id}
        className={classNames?.stepper}
      />
      <h2
        ref={headingRef}
        tabIndex={-1}
        className={cn(
          "m-0 text-body font-semibold text-ink outline-none @max-[420px]/wizard:not-sr-only sr-only",
          classNames?.heading,
        )}
      >
        {label}
      </h2>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Enter in a text input advances, like a form; the buttons stay the accessible path */}
      <div
        className={cn("min-w-0", classNames?.content)}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (isAdvanceKey(event)) {
            event.preventDefault();
            if (!blocked) void advance();
          }
        }}
      >
        {current.content}
      </div>
      {failed ? (
        <p role="alert" className={cn("m-0 text-danger text-meta", classNames?.error)}>
          {strings.actionFailed}
        </p>
      ) : null}
      <div
        className={cn(
          "flex items-center justify-between gap-2 @max-[420px]/wizard:flex-col-reverse @max-[420px]/wizard:items-stretch",
          classNames?.footer,
        )}
      >
        <Button
          variant="secondary"
          disabled={index === 0 || pending !== null}
          onClick={() => goTo(index - 1)}
          className={classNames?.back}
        >
          {backLabel ?? strings.back}
        </Button>
        <Button
          variant="primary"
          loading={pending !== null}
          loadingLabel={strings.processing}
          disabled={blocked}
          onClick={() => void advance()}
          className={classNames?.next}
        >
          {isLast ? (finishLabel ?? strings.finish) : (nextLabel ?? strings.next)}
        </Button>
      </div>
    </div>
  );
}
