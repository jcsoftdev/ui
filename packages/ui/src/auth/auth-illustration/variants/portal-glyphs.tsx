import type { ReactNode } from "react";

/**
 * The three portal glyphs (a book, a house and a graduation cap) on a 100px square. They paint with
 * `--glyph-a` (fill), `--glyph-b` (outline), `--glyph-c` (detail) and `--glyph-line` (accent line).
 */
export const PORTAL_GLYPHS: readonly ReactNode[] = [
  <g key="book">
    <path
      className="ui-auth-g ui-auth-ga"
      d="M18 30 Q34 23 50 32 Q66 23 82 30 V74 Q66 67 50 76 Q34 67 18 74Z"
    />
    <path
      className="ui-auth-g ui-auth-gline"
      d="M50 32V76"
      style={{ stroke: "var(--glyph-line)" }}
    />
  </g>,
  <g key="house">
    <path className="ui-auth-g ui-auth-ga" d="M50 20 L84 48 H75 V78 H25 V48 H16Z" />
    <rect className="ui-auth-g ui-auth-gc" x="42" y="56" width="16" height="22" />
  </g>,
  <g key="cap">
    <path className="ui-auth-g ui-auth-ga" d="M50 24 L90 44 L50 64 L10 44Z" />
    <path
      className="ui-auth-g ui-auth-gline"
      d="M28 55 V70 Q50 84 72 70 V55"
      style={{ stroke: "var(--glyph-line)", strokeWidth: 5 }}
    />
    <path className="ui-auth-g ui-auth-gline" d="M88 46 V72" />
  </g>,
];
