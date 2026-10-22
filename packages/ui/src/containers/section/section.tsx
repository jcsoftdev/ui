"use client";

import {
  Children,
  type ComponentPropsWithoutRef,
  createContext,
  isValidElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

/** Heading depth: how many titled sections enclose this point. A titleless wrapper adds nothing. */
const SectionDepth = createContext(0);

interface SectionParts {
  depth: number;
  titleId: string;
  classNames: ClassNames<SectionPart> | undefined;
  padded: boolean;
  registerTitle: (present: boolean) => void;
}

const SectionPartsContext = createContext<SectionParts | null>(null);

function useSectionParts(part: string): SectionParts {
  const parts = useContext(SectionPartsContext);
  if (!parts) throw new Error(`Section.${part} must be rendered inside a Section`);
  return parts;
}

type SectionHeadingTag = "h2" | "h3" | "h4" | "h5" | "h6";
const headingForDepth: SectionHeadingTag[] = ["h2", "h3", "h4", "h5", "h6"];

export type SectionPart =
  | "root"
  | "header"
  | "heading"
  | "title"
  | "count"
  | "description"
  | "actions"
  | "body";

export interface SectionProps extends Omit<ComponentPropsWithoutRef<"section">, "title"> {
  as?: "section" | "div" | "article";
  title?: ReactNode;
  /** Outlined count next to the title (a record total, say). */
  count?: ReactNode;
  description?: ReactNode;
  /** Slot at the end of the header row; takes the full row under 560px of the section's own width. */
  actions?: ReactNode;
  /** Heading element of the title. Defaults to `h2`, one level deeper per nested section. */
  titleAs?: SectionHeadingTag;
  /** Hairline above the section. */
  divider?: boolean;
  /** Vertical padding around the body. Defaults to `true`; `false` leaves the body edge to edge. */
  padded?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SectionPart>;
}

function isPart(node: ReactNode): boolean {
  return (
    isValidElement(node) &&
    [
      SectionHeader,
      SectionTitle,
      SectionCount,
      SectionDescription,
      SectionActions,
      SectionBody,
    ].includes(node.type as never)
  );
}

const ignoreTitle = () => {};

function hasTitlePart(nodes: ReactNode): boolean {
  return Children.toArray(nodes).some((node) => {
    if (!isValidElement<{ children?: ReactNode }>(node)) return false;
    if (node.type === SectionTitle) return true;
    return node.type === SectionHeader && hasTitlePart(node.props.children);
  });
}

/**
 * A titled block of a page: a header row (title, count, description, actions) and a body.
 * It never pads the inline edges (the page layout owns the gutter), and sections nest without
 * stacking: each titled level steps its heading down and its vertical spacing tighter, while a
 * titleless wrapper takes no level at all. Named by its title when it has one.
 *
 * Two ways to fill it, which mix: the props (`title`, `count`, `description`, `actions`, with the
 * children as the body) or the parts `Section.Header`, `Section.Title`, `Section.Count`,
 * `Section.Description`, `Section.Actions` and `Section.Body`. As soon as a part is a direct
 * child, the children are rendered as written and the body is wherever you place `Section.Body`.
 */
export function Section({
  as = "section",
  title,
  count,
  description,
  actions,
  titleAs,
  divider = false,
  padded = true,
  className,
  classNames,
  children,
  ...props
}: SectionProps) {
  const outerDepth = useContext(SectionDepth);
  const titleId = useId();
  const [registered, setRegistered] = useState(false);
  const Tag = as;
  const composed = Children.toArray(children).some(isPart);
  const hasTitle = title !== undefined || (composed && (registered || hasTitlePart(children)));
  const hasHeader =
    title !== undefined ||
    count !== undefined ||
    description !== undefined ||
    actions !== undefined;
  const named = hasTitle && as !== "div";

  return (
    <SectionDepth.Provider value={outerDepth + (hasTitle ? 1 : 0)}>
      <SectionPartsContext.Provider
        value={{
          depth: outerDepth,
          titleId,
          classNames,
          padded,
          registerTitle: composed ? setRegistered : ignoreTitle,
        }}
      >
        <Tag
          {...props}
          data-depth={outerDepth}
          aria-labelledby={named && props["aria-label"] === undefined ? titleId : undefined}
          className={cn(
            "@container/section min-w-0",
            divider && "border-t-divider",
            classNames?.root,
            className,
          )}
        >
          {hasHeader ? (
            <SectionHeader>
              {title !== undefined ? <SectionTitle as={titleAs}>{title}</SectionTitle> : null}
              {count !== undefined ? <SectionCount>{count}</SectionCount> : null}
              {description !== undefined ? (
                <SectionDescription>{description}</SectionDescription>
              ) : null}
              {actions !== undefined ? <SectionActions>{actions}</SectionActions> : null}
            </SectionHeader>
          ) : null}
          {composed ? children : <SectionBody>{children}</SectionBody>}
        </Tag>
      </SectionPartsContext.Provider>
    </SectionDepth.Provider>
  );
}

export interface SectionHeaderProps extends ComponentPropsWithoutRef<"div"> {}

/** Header row of a composed `Section`: title, count and description wrap, actions go to the end. */
export function SectionHeader({ className, ...props }: SectionHeaderProps) {
  const { depth, classNames } = useSectionParts("Header");
  return (
    <div
      {...props}
      className={cn(
        "flex flex-wrap items-center gap-x-2.5 gap-y-1.5",
        depth > 0 ? "pt-2 pb-1.5" : "pt-3.5 pb-2.5",
        classNames?.header,
        className,
      )}
    />
  );
}

export interface SectionTitleProps extends ComponentPropsWithoutRef<"h2"> {
  /** Heading element. Defaults to `h2`, one level deeper per enclosing titled section. */
  as?: SectionHeadingTag | undefined;
}

/** Heading of a composed `Section`; it names the section and takes the level its depth implies. */
export function SectionTitle({ as, className, ...props }: SectionTitleProps) {
  const { depth, titleId, classNames, registerTitle } = useSectionParts("Title");
  useEffect(() => {
    registerTitle(true);
    return () => registerTitle(false);
  }, [registerTitle]);
  const Heading = as ?? headingForDepth[Math.min(depth, headingForDepth.length - 1)] ?? "h2";
  return (
    <Heading
      id={titleId}
      {...props}
      className={cn(
        "m-0 min-w-0 font-semibold text-ink",
        depth > 0 ? "text-control" : "text-body",
        classNames?.title,
        classNames?.heading,
        className,
      )}
    />
  );
}

export interface SectionCountProps extends ComponentPropsWithoutRef<"span"> {}

/** Outlined count next to the title. */
export function SectionCount({ className, ...props }: SectionCountProps) {
  const { classNames } = useSectionParts("Count");
  return (
    <span
      {...props}
      className={cn(
        "rounded-pill border-divider px-1.75 text-count text-ink-3 tabular-nums",
        classNames?.count,
        className,
      )}
    />
  );
}

export interface SectionDescriptionProps extends ComponentPropsWithoutRef<"p"> {}

export function SectionDescription({ className, ...props }: SectionDescriptionProps) {
  const { classNames } = useSectionParts("Description");
  return (
    <p
      {...props}
      className={cn("m-0 min-w-0 text-meta text-ink-3", classNames?.description, className)}
    />
  );
}

export interface SectionActionsProps extends ComponentPropsWithoutRef<"div"> {}

/** Slot at the end of the header; takes the full row under 560px of the section's own width. */
export function SectionActions({ className, ...props }: SectionActionsProps) {
  const { classNames } = useSectionParts("Actions");
  return (
    <div
      {...props}
      className={cn(
        "ml-auto flex flex-wrap items-center gap-2 @max-[560px]/section:ml-0 @max-[560px]/section:w-full",
        classNames?.actions,
        className,
      )}
    />
  );
}

export interface SectionBodyProps extends ComponentPropsWithoutRef<"div"> {
  /** Vertical padding. Defaults to the section's `padded`. */
  padded?: boolean | undefined;
}

export function SectionBody({ padded, className, ...props }: SectionBodyProps) {
  const { depth, classNames, padded: rootPadded } = useSectionParts("Body");
  const pad = padded ?? rootPadded;
  return (
    <div
      {...props}
      className={cn("min-w-0", pad && (depth > 0 ? "py-2" : "py-4"), classNames?.body, className)}
    />
  );
}

Section.Header = SectionHeader;
Section.Title = SectionTitle;
Section.Count = SectionCount;
Section.Description = SectionDescription;
Section.Actions = SectionActions;
Section.Body = SectionBody;
