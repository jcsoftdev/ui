/** The lazy time-axis stack, behind its own module so a failed fetch can be exercised in tests. */
export const importTimeAxis = () => import("@jcsoftdev/ui-core/chart/category-axis-time");
