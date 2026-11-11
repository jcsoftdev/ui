import { createRef } from "react";
import { CopyField } from "./copy-field/index.js";
import { Field } from "./field/index.js";
import { Fieldset } from "./fieldset/index.js";
import { Form } from "./form/index.js";
import { FormFooter } from "./form-footer/index.js";
import { FormGrid, FormGridItem } from "./form-grid/index.js";
import { FormSection } from "./form-section/index.js";
import { InlineSelect } from "./inline-select/index.js";
import { Label } from "./label/index.js";
import { NativeSelect } from "./native-select/index.js";
import { Select } from "./select/index.js";
import { Textarea } from "./textarea/index.js";
import { TimeInput } from "./time-input/index.js";

const intent = { intent: "probe", intentKey: "k1" };

export const refProps = (
  <>
    <CopyField ref={createRef<HTMLDivElement>()} {...intent} label="Link" value="x" />
    <Field ref={createRef<HTMLDivElement>()} label="Name">
      <input />
    </Field>
    <Fieldset ref={createRef<HTMLFieldSetElement>()} legend="Group" />
    <Form ref={createRef<HTMLFormElement>()} {...intent} />
    <FormFooter ref={createRef<HTMLDivElement>()} />
    <FormGrid ref={createRef<HTMLDivElement>()} />
    <FormGridItem ref={createRef<HTMLDivElement>()} />
    <FormSection ref={createRef<HTMLElement>()} title="Section">
      x
    </FormSection>
    <InlineSelect ref={createRef<HTMLSelectElement>()} {...intent} options={[]} />
    <Label ref={createRef<HTMLLabelElement>()} />
    <NativeSelect ref={createRef<HTMLSelectElement>()} {...intent} />
    <Select ref={createRef<HTMLSelectElement>()} {...intent} />
    <Textarea ref={createRef<HTMLTextAreaElement>()} {...intent} />
    <TimeInput ref={createRef<HTMLInputElement>()} {...intent} />
  </>
);
