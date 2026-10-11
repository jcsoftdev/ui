/**
 * Per-part class overrides for a multi-part component.
 *
 * Every styled component that renders more than one styled element accepts
 * `classNames={{ root, <part>, ... }}` next to the usual `className` (which
 * always targets the root). Values are merged with `cn`, so consumer classes win
 * over the kit's own on conflicting utilities.
 */
export type ClassNames<Part extends string> = Partial<Record<Part, string>>;
