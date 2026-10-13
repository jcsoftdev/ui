/** Stroke-icon bodies (24px grid) used by the status atoms; same glyphs as the React kit. */
const GLYPHS = {
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  success: '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  danger: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  up: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  down: '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
  flat: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** Markup of a decorative stroke icon sized by CSS (`[part=icon]`). */
export const glyph = (name: GlyphName, strokeWidth = 2): string =>
  `<svg part="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`;
