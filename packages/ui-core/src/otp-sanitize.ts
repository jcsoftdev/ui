export type OtpCharset = "numeric" | "alphanumeric" | "any";

const ALLOWED: Record<OtpCharset, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[a-z0-9]/i,
  any: /\S/,
};

/** Keeps the characters the charset allows, in order, up to `length` (all of them when omitted). */
export function sanitizeOtp(
  text: string,
  charset: OtpCharset = "numeric",
  length = Infinity,
): string {
  const allowed = ALLOWED[charset];
  let out = "";
  for (const char of text) {
    if (out.length >= length) break;
    if (allowed.test(char)) out += char;
  }
  return out;
}
