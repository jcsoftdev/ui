import { Button } from "@jcsoftdev/ui/atoms";
import { DataGrid, FloorPlan, type FloorPlanItem } from "@jcsoftdev/ui/containers";
import { type IntentBridge, IntentBridgeProvider } from "@jcsoftdev/ui/intent";
import type { ReactElement } from "react";

interface Order {
  id: string;
  table: string;
}

const orders: Order[] = [{ id: "o-1", table: "T1" }];

const items: FloorPlanItem[] = [
  {
    id: "t1",
    x: 1,
    y: 1,
    width: 2,
    height: 2,
    shape: "round",
    seats: 4,
    label: "T1",
    intent: "table-open",
  },
];

const bridge: IntentBridge = {
  registerTarget(ref, element, expectation) {
    console.info(ref.intent, ref.key, element.tagName, expectation.role, expectation.requireName);
    return () => undefined;
  },
};

export function IntentExample(): ReactElement {
  return (
    <IntentBridgeProvider bridge={bridge}>
      <Button intent="order-save">Save</Button>
      <DataGrid
        data={orders}
        columns={[{ id: "table", header: "Table", accessor: (row) => row.table }]}
        aria-label="Orders"
        getRowId={(row) => row.id}
        rowIntent="order-row"
      />
      <FloorPlan width={8} height={6} items={items} />
    </IntentBridgeProvider>
  );
}
