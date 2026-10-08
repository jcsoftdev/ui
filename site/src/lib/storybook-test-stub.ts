// Stand-in for `storybook/test` so story files can be imported without Storybook.
// `fn()` returns a no-op handler; the other helpers exist only so play functions can be imported.
export const fn = (): (() => void) => () => {};
export const expect = () => ({});
export const userEvent = {};
export const within = () => ({});
export const waitFor = async () => {};
