/** Value validators used by the class group table (`class-groups.ts`). */
export type Validator = (value: string) => boolean;

const arbitraryValueRegex = /^\[(?:(\w[\w-]*):)?(.+)\]$/i;
const arbitraryVariableRegex = /^\((?:(\w[\w-]*):)?(.+)\)$/i;
const fractionRegex = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/;
const tshirtUnitRegex = /^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/;
const lengthUnitRegex =
  /\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/;
const colorFunctionRegex = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix|color|light-dark)\(.+\)$/;
const shadowRegex = /^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/;
const imageRegex =
  /^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/;

export const isAny: Validator = () => true;
const isNever: Validator = () => false;
export const isFraction: Validator = (v) => fractionRegex.test(v);
export const isNumber: Validator = (v) => !!v && !Number.isNaN(Number(v));
export const isInteger: Validator = (v) => !!v && Number.isInteger(Number(v));
export const isPercent: Validator = (v) => v.endsWith("%") && isNumber(v.slice(0, -1));
export const isTshirtSize: Validator = (v) => tshirtUnitRegex.test(v);
export const isArbitraryValue: Validator = (v) => arbitraryValueRegex.test(v);
export const isArbitraryVariable: Validator = (v) => arbitraryVariableRegex.test(v);
export const isAnyNonArbitrary: Validator = (v) => !isArbitraryValue(v) && !isArbitraryVariable(v);

// `color-function(... 0% ...)` contains percentages that would otherwise read as lengths.
const isLengthOnly: Validator = (v) => lengthUnitRegex.test(v) && !colorFunctionRegex.test(v);
const isShadow: Validator = (v) => shadowRegex.test(v);
const isImage: Validator = (v) => imageRegex.test(v);

export const isNamedContainerQuery: Validator = (v) =>
  v.startsWith("@container") &&
  ((v[10] === "/" && v[11] !== undefined) ||
    (v[11] === "s" && v[16] !== undefined && v.startsWith("-size/", 10)) ||
    (v[11] === "n" && v[18] !== undefined && v.startsWith("-normal/", 10)));

/** `[label:value]` is checked by label; an unlabelled `[value]` by its content. */
function arbitrary(labels: string[], test: Validator): Validator {
  return (v) => {
    const m = arbitraryValueRegex.exec(v);
    if (!m) return false;
    return m[1] ? labels.includes(m[1]) : test(m[2]);
  };
}

/** `(--var)` is checked by label; an unlabelled variable matches only when `bare` is set. */
function variable(labels: string[], bare = false): Validator {
  return (v) => {
    const m = arbitraryVariableRegex.exec(v);
    if (!m) return false;
    return m[1] ? labels.includes(m[1]) : bare;
  };
}

export const isArbitrarySize = arbitrary(["length", "size", "bg-size"], isNever);
export const isArbitraryLength = arbitrary(["length"], isLengthOnly);
export const isArbitraryNumber = arbitrary(["number"], isNumber);
export const isArbitraryWeight = arbitrary(["number", "weight"], isAny);
export const isArbitraryFamilyName = arbitrary(["family-name"], isNever);
export const isArbitraryPosition = arbitrary(["position", "percentage"], isNever);
export const isArbitraryImage = arbitrary(["image", "url"], isImage);
export const isArbitraryShadow = arbitrary(["shadow"], isShadow);
export const isArbitraryVariableLength = variable(["length"]);
export const isArbitraryVariableFamilyName = variable(["family-name"]);
export const isArbitraryVariablePosition = variable(["position", "percentage"]);
export const isArbitraryVariableSize = variable(["length", "size", "bg-size"]);
export const isArbitraryVariableImage = variable(["image", "url"]);
export const isArbitraryVariableShadow = variable(["shadow"], true);
export const isArbitraryVariableWeight = variable(["number", "weight"], true);
