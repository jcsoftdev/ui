import { renderToStaticMarkup } from "react-dom/server";
import {
  Table,
  TableBody,
  TableCell,
  type TableProps,
  TableRow,
} from "../../src/containers/table/table.js";

export const html = {
  table: (props: Partial<TableProps> = {}) =>
    renderToStaticMarkup(
      <Table aria-label="Rows" {...props}>
        <TableBody>
          <TableRow>
            <TableCell>Ana</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    ),
};
