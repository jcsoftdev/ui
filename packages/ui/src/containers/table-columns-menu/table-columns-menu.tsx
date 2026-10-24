"use client";

import { Checkbox } from "../../atoms/checkbox/checkbox.js";
import { useUiStrings } from "../../i18n/index.js";
import { Columns3 } from "../../icons/index.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";

export interface TableColumnOption {
  id: string;
  label: string;
}

export interface TableColumnsMenuProps {
  columns: readonly TableColumnOption[];
  /** Ids of the hidden columns; pass the same list to `Table` as `hiddenColumns`. */
  hiddenColumns: readonly string[];
  onHiddenColumnsChange: (hidden: string[]) => void;
  /** Trigger text. Defaults to the localized "Columns". */
  label?: string;
}

/** Popover with a checkbox per column. The last visible column cannot be hidden. */
export function TableColumnsMenu({
  columns,
  hiddenColumns,
  onHiddenColumnsChange,
  label,
}: TableColumnsMenuProps) {
  const strings = useUiStrings();
  const name = label ?? strings.columns;
  const visible = columns.filter((column) => !hiddenColumns.includes(column.id));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-control-sm items-center gap-1.5 rounded-control bg-surface-control px-2.5 text-fs-125 text-ink shadow-control hover:bg-surface-2 focus-visible:focus-ring [&_svg]:size-4"
        >
          <Columns3 aria-hidden="true" />
          {name}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={name}>
        <ul className="m-0 grid list-none gap-1 p-0">
          {columns.map((column) => {
            const shown = !hiddenColumns.includes(column.id);
            return (
              <li key={column.id} className="px-1.5 py-1">
                <Checkbox
                  label={column.label}
                  checked={shown}
                  disabled={shown && visible.length === 1}
                  onCheckedChange={() =>
                    onHiddenColumnsChange(
                      shown
                        ? [...hiddenColumns, column.id]
                        : hiddenColumns.filter((id) => id !== column.id),
                    )
                  }
                />
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
