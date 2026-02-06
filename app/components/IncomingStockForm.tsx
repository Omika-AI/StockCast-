import { useState } from "react";
import {
  Card,
  FormLayout,
  TextField,
  Button,
  IndexTable,
  Text,
  InlineStack,
  BlockStack,
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";

interface IncomingStockEntry {
  id: string;
  quantity: number;
  expectedDate: string;
  note: string | null;
}

interface IncomingStockFormProps {
  productId: string;
  entries: IncomingStockEntry[];
}

export function IncomingStockForm({
  productId,
  entries,
}: IncomingStockFormProps) {
  const fetcher = useFetcher();
  const [quantity, setQuantity] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    if (!quantity || !expectedDate) return;
    fetcher.submit(
      {
        intent: "addIncomingStock",
        productId,
        quantity,
        expectedDate,
        note,
      },
      { method: "post" }
    );
    setQuantity("");
    setExpectedDate("");
    setNote("");
  };

  const handleDelete = (entryId: string) => {
    fetcher.submit(
      {
        intent: "deleteIncomingStock",
        entryId,
      },
      { method: "post" }
    );
  };

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingMd">
          Incoming Stock
        </Text>

        {entries.length > 0 && (
          <IndexTable
            itemCount={entries.length}
            headings={[
              { title: "Date" },
              { title: "Quantity", alignment: "end" },
              { title: "Note" },
              { title: "" },
            ]}
            selectable={false}
          >
            {entries.map((entry, index) => (
              <IndexTable.Row id={entry.id} key={entry.id} position={index}>
                <IndexTable.Cell>
                  {new Date(entry.expectedDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" alignment="end" numeric>
                    {entry.quantity.toLocaleString()}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{entry.note || "-"}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Button
                    variant="plain"
                    tone="critical"
                    onClick={() => handleDelete(entry.id)}
                  >
                    Remove
                  </Button>
                </IndexTable.Cell>
              </IndexTable.Row>
            ))}
          </IndexTable>
        )}

        <FormLayout>
          <FormLayout.Group condensed>
            <TextField
              label="Quantity"
              type="number"
              value={quantity}
              onChange={setQuantity}
              autoComplete="off"
            />
            <TextField
              label="Expected Date"
              type="date"
              value={expectedDate}
              onChange={setExpectedDate}
              autoComplete="off"
            />
            <TextField
              label="Note (optional)"
              value={note}
              onChange={setNote}
              autoComplete="off"
              placeholder="e.g. PO #1234"
            />
          </FormLayout.Group>
          <InlineStack align="end">
            <Button onClick={handleSubmit} variant="primary">
              Add Delivery
            </Button>
          </InlineStack>
        </FormLayout>
      </BlockStack>
    </Card>
  );
}
