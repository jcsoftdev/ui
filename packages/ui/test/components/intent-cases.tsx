import { renderToStaticMarkup } from "react-dom/server";
import { intentAttributes } from "../../src/intent/attributes.js";

export {
  implicitRoleOf,
  intentAttributes,
  intentTargetRef,
  resolveExpectation,
} from "../../src/intent/attributes.js";

export const html = {
  withIntent: (props) => renderToStaticMarkup(<button type="button" {...intentAttributes(props)} />),
};
