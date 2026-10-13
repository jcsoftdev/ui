export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * First day of the week: `week-starts-on="0".."6"` (7 also means Sunday), or `auto` for the
 * locale's own week (`Intl.Locale` week info). Defaults to 1 (Monday), like the React kit.
 */
export function weekStartOf(host: Element, locale: string | undefined): WeekStart {
  const value = host.getAttribute("week-starts-on");
  if (value === "auto") {
    try {
      const intl = new Intl.Locale(locale ?? navigator.language) as Intl.Locale & {
        getWeekInfo?: () => { firstDay: number };
        weekInfo?: { firstDay: number };
      };
      const first = (intl.getWeekInfo?.() ?? intl.weekInfo)?.firstDay;
      if (first) return (first % 7) as WeekStart;
    } catch {
      /* unknown locale: fall through to Monday */
    }
    return 1;
  }
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number >= 0 && number <= 7
    ? ((number % 7) as WeekStart)
    : 1;
}
