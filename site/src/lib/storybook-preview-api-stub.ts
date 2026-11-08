// Stand-in for `storybook/preview-api` so story files can be imported without Storybook.
// `useArgs` returns empty args and a no-op updater; it only matters inside the Storybook canvas.
export const useArgs = (): [Record<string, unknown>, (next: Record<string, unknown>) => void] => [
  {},
  () => {},
];
