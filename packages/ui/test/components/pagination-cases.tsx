import { renderToStaticMarkup } from "react-dom/server";
import { CursorPagination } from "../../src/containers/pagination/cursor-pagination.js";
import { Pagination } from "../../src/containers/pagination/pagination.js";
import { UiStringsProvider } from "../../src/i18n/index.js";

export const html = {
  pages: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(<Pagination variant="pages" total={134} pageSize={25} {...props} />),
  pagesEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <Pagination variant="pages" total={134} pageSize={25} defaultPage={2} />
      </UiStringsProvider>,
    ),
  defaultSingle: () => renderToStaticMarkup(<Pagination total={5} />),
  cursor: (props: Record<string, unknown> = {}) =>
    renderToStaticMarkup(
      <CursorPagination
        page={2}
        count={25}
        hasNext
        onPrevious={() => {}}
        onNext={() => {}}
        {...props}
      />,
    ),
  cursorEs: () =>
    renderToStaticMarkup(
      <UiStringsProvider locale="es">
        <CursorPagination page={3} count={4} hasNext={false} onPrevious={() => {}} onNext={() => {}} />
      </UiStringsProvider>,
    ),
};
