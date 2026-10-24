import { renderToString } from "react-dom/server";
import { UiStringsProvider } from "../../src/i18n/index.js";
import {
  CountUp,
  CrossFade,
  Presence,
  Reveal,
  Stagger,
  useHighlightRow,
} from "../../src/motion/index.js";

function Rows({ ids }: { ids: string[] }) {
  const { rowProps } = useHighlightRow(ids);
  return (
    <table>
      <tbody>
        {ids.map((id) => (
          <tr key={id} {...rowProps(id)}>
            <td>{id}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const html = {
  reveal: () =>
    renderToString(
      <Reveal delay={80} inView>
        Welcome back
      </Reveal>,
    ),
  stagger: () =>
    renderToString(
      <Stagger as="ul">
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </Stagger>,
    ),
  crossFade: () =>
    renderToString(
      <CrossFade contentKey="detail-7">
        <p>Detail seven</p>
      </CrossFade>,
    ),
  presenceHidden: () =>
    renderToString(
      <Presence present={false}>
        <p>Hidden note</p>
      </Presence>,
    ),
  countUpFormatter: () => renderToString(<CountUp value={1234.5} formatter={usd} from={0} />),
  countUpLocale: () =>
    renderToString(
      <UiStringsProvider locale="en">
        <CountUp value={12345} />
      </UiStringsProvider>,
    ),
  rows: () => renderToString(<Rows ids={["a", "b"]} />),
};
