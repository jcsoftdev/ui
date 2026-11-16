export function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}
