// A small CSS minifier for the component stylesheets. Comments are dropped; whitespace is squeezed
// everywhere except inside quoted strings and `url()`, which are kept byte for byte.
const TOKENS =
  /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|url\(\s*(?:"(?:[^"\\\n]|\\[\s\S])*"|'(?:[^'\\\n]|\\[\s\S])*'|[^)]*)\s*\)/gi;
const MARK = "\u0000";

export const minify = (css) => {
  const kept = [];
  const masked = css.replace(TOKENS, (token) => {
    if (token.startsWith("/*")) return "";
    kept.push(token);
    return `${MARK}${kept.length - 1}${MARK}`;
  });
  return masked
    .replace(/\s+/g, " ")
    .replace(/\s*([{};])\s*/g, "$1")
    .replace(/,\s+/g, ",")
    .replace(/([\w-]):\s+/g, "$1:")
    .replace(/;}/g, "}")
    .trim()
    .replace(new RegExp(`${MARK}(\\d+)${MARK}`, "g"), (_, i) => kept[Number(i)]);
};
