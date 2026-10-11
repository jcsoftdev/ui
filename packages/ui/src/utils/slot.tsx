import {
  Children,
  cloneElement,
  Fragment,
  type HTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";

type AnyProps = Record<string, unknown>;

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

function setRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") ref(value);
  else if (ref) (ref as { current: T | null }).current = value;
}

export function composeRefs<T>(...refs: Array<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups: Array<() => void> = [];
    for (const ref of refs) {
      const result = typeof ref === "function" ? (ref as RefCallback<T>)(node) : undefined;
      if (typeof ref !== "function") setRef(ref, node);
      else if (typeof result === "function") cleanups.push(result as () => void);
      else cleanups.push(() => setRef(ref, null));
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
  };
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...childProps };
  for (const name of Object.keys(childProps)) {
    const slotValue = slotProps[name];
    const childValue = childProps[name];
    if (/^on[A-Z]/.test(name)) {
      if (typeof slotValue === "function" && typeof childValue === "function") {
        merged[name] = (...args: unknown[]) => {
          const result = childValue(...args);
          slotValue(...args);
          return result;
        };
      } else if (slotValue) {
        merged[name] = slotValue;
      }
    } else if (name === "style") {
      merged[name] = { ...(slotValue as object), ...(childValue as object) };
    } else if (name === "className") {
      merged[name] = [slotValue, childValue].filter(Boolean).join(" ");
    } else if (name === "aria-describedby") {
      const ids = new Set<string>();
      for (const value of [childValue, slotValue]) {
        if (typeof value !== "string") continue;
        for (const id of value.trim().split(/\s+/)) if (id) ids.add(id);
      }
      merged[name] = ids.size > 0 ? [...ids].join(" ") : undefined;
    }
  }
  return { ...slotProps, ...merged };
}

/**
 * Renders its single child element with the Slot's own props merged in: handlers run
 * child first, then slot; `className` is concatenated; `style` merges with the child
 * winning; `aria-describedby` ids are unioned; refs are composed.
 */
export function Slot({ children, ref, ...slotProps }: SlotProps) {
  if (Children.count(children) !== 1 || !isValidElement(children)) {
    if (children || children === 0) {
      throw new Error(
        "Slot failed to slot onto its children. Expected a single React element child.",
      );
    }
    return children ?? null;
  }
  const child = children as ReactElement<AnyProps & { ref?: Ref<HTMLElement> }>;
  const merged = mergeProps(slotProps, child.props);
  if (child.type !== Fragment) {
    merged.ref = ref ? composeRefs(ref, child.props.ref) : child.props.ref;
  }
  return cloneElement(child, merged);
}
