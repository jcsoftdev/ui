import type {
  IntentDataAttributes,
  IntentExpectationInput,
  IntentProps,
  IntentSemanticExpectation,
  IntentTargetRef,
  RoleSource,
} from "./types.js";

export const INTENT_ATTRIBUTE = "data-intent";
export const INTENT_KEY_ATTRIBUTE = "data-intent-key";
export const INTENT_HIGHLIGHT_ATTRIBUTE = "data-intent-highlight";
export const INTENT_CHANGED_ATTRIBUTE = "data-intent-changed";
export const ROW_ID_ATTRIBUTE = "data-row-id";
export const COLUMN_ID_ATTRIBUTE = "data-col-id";

const INPUT_ROLES: Readonly<Record<string, string>> = {
  checkbox: "checkbox",
  radio: "radio",
  range: "slider",
  number: "spinbutton",
  search: "searchbox",
  button: "button",
  submit: "button",
  reset: "button",
};

const TAG_ROLES: Readonly<Record<string, string>> = {
  button: "button",
  textarea: "textbox",
  tr: "row",
  td: "cell",
  th: "columnheader",
  table: "table",
  article: "article",
  form: "form",
  dialog: "dialog",
  li: "listitem",
  nav: "navigation",
  section: "region",
};

const GENERIC_ROLE = "generic";

const isNonEmpty = (value: string | undefined): value is string =>
  value !== undefined && value !== "";

export function intentAttributes(props: IntentProps): IntentDataAttributes {
  if (!isNonEmpty(props.intent)) return {};
  if (!isNonEmpty(props.intentKey)) return { [INTENT_ATTRIBUTE]: props.intent };
  return { [INTENT_ATTRIBUTE]: props.intent, [INTENT_KEY_ATTRIBUTE]: props.intentKey };
}

export function intentTargetRef(props: IntentProps): IntentTargetRef | undefined {
  if (!isNonEmpty(props.intent)) return undefined;
  if (!isNonEmpty(props.intentKey)) return { intent: props.intent };
  return { intent: props.intent, key: props.intentKey };
}

const selectRole = (source: RoleSource): string => {
  const size = Number(source.getAttribute("size"));
  return source.getAttribute("multiple") !== null || size > 1 ? "listbox" : "combobox";
};

const inputRole = (source: RoleSource): string =>
  INPUT_ROLES[(source.getAttribute("type") ?? "").toLowerCase()] ?? "textbox";

export function implicitRoleOf(source: RoleSource): string {
  const tag = source.tagName.toLowerCase();
  if (tag === "a" || tag === "area") {
    return source.getAttribute("href") === null ? GENERIC_ROLE : "link";
  }
  if (tag === "input") return inputRole(source);
  if (tag === "select") return selectRole(source);
  return TAG_ROLES[tag] ?? GENERIC_ROLE;
}

const nonEmptyOrUndefined = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value.trim() === "" ? undefined : value.trim();

const firstRoleToken = (value: string | null): string | undefined =>
  nonEmptyOrUndefined(value?.split(/\s+/)[0]);

export function resolveExpectation(
  input: IntentExpectationInput | undefined,
  source: RoleSource,
): IntentSemanticExpectation {
  return {
    role:
      nonEmptyOrUndefined(input?.role) ??
      firstRoleToken(source.getAttribute("role")) ??
      implicitRoleOf(source),
    requireName: input?.requireName ?? true,
  };
}
