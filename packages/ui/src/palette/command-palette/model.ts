export interface SubmitQueryInput {
  key: string;
  isComposing: boolean;
  highlighted: string;
  search: string;
}

export function shouldSubmitQuery({
  key,
  isComposing,
  highlighted,
  search,
}: SubmitQueryInput): boolean {
  return key === "Enter" && !isComposing && highlighted === "" && search.trim() !== "";
}
