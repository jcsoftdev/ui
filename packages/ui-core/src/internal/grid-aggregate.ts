import type { CellValue } from "../grid/model.js";
import { isEmptyValue, rawKey, toNumber } from "./grid-values.js";

export type AggregateKind =
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count"
  | "countDistinct"
  | "first"
  | "last";

/** A custom aggregate receives every value of the group, in row order. */
export type AggregateFn = (values: readonly CellValue[]) => CellValue;
export type Aggregator = AggregateKind | AggregateFn;

/**
 * Streaming aggregate: `add` every value, read `result`. Numeric kinds read numeric-like values
 * (dates count by time) and give `null` when there is none; `count` counts non-empty values;
 * `first` / `last` give the first / last non-empty value.
 */
export class Accumulator {
  private n = 0;
  private sum = 0;
  private min = Number.POSITIVE_INFINITY;
  private max = Number.NEGATIVE_INFINITY;
  private first: CellValue = null;
  private last: CellValue = null;
  private distinct: Set<unknown> | undefined;
  private values: CellValue[] | undefined;

  constructor(private readonly aggregator: Aggregator) {
    if (typeof aggregator === "function") this.values = [];
  }

  add(value: CellValue): void {
    const kind = this.aggregator;
    if (typeof kind === "function") {
      (this.values as CellValue[]).push(value);
      return;
    }
    if (kind === "count") {
      if (!isEmptyValue(value)) this.n += 1;
    } else if (kind === "countDistinct") {
      if (!isEmptyValue(value)) {
        this.distinct ??= new Set();
        this.distinct.add(rawKey(value));
      }
    } else if (kind === "first" || kind === "last") {
      if (!isEmptyValue(value)) {
        if (this.n === 0) this.first = value;
        this.last = value;
        this.n += 1;
      }
    } else {
      const x = toNumber(value);
      if (x === null) return;
      this.n += 1;
      this.sum += x;
      if (x < this.min) this.min = x;
      if (x > this.max) this.max = x;
    }
  }

  result(): CellValue {
    const kind = this.aggregator;
    if (typeof kind === "function") return kind(this.values as CellValue[]);
    switch (kind) {
      case "count":
        return this.n;
      case "countDistinct":
        return this.distinct?.size ?? 0;
      case "first":
        return this.n === 0 ? null : this.first;
      case "last":
        return this.n === 0 ? null : this.last;
      case "sum":
        return this.n === 0 ? null : this.sum;
      case "avg":
        return this.n === 0 ? null : this.sum / this.n;
      case "min":
        return this.n === 0 ? null : this.min;
      case "max":
        return this.n === 0 ? null : this.max;
    }
  }
}

/** Aggregates an array of values in one go. */
export function aggregate(values: readonly CellValue[], aggregator: Aggregator): CellValue {
  const acc = new Accumulator(aggregator);
  for (let i = 0; i < values.length; i += 1) acc.add(values[i]);
  return acc.result();
}
