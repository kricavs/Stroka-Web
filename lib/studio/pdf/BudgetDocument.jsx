import { Document, Page, View } from "@react-pdf/renderer";
import { STUDIO_BRAND as B, PROPOSAL_TYPES } from "../config";
import { addDays, formatDate } from "../calc";
import { C, F, PAGE } from "./theme";
import { Footer, Cover, RunningHeader } from "./Chrome";
import { Client, Detailed, Meta, Plans, Simple, TextBlock } from "./Sections";

// Single template used by BOTH the live preview and the PDF export.
// internalNote is intentionally never rendered.
export default function BudgetDocument({ budget: b, logoSrc }) {
  const number = b.number || "PENDIENTE";
  const typeLabel = PROPOSAL_TYPES.find((t) => t.value === b.type)?.label || "";
  const validUntil = b.date && b.validDays ? formatDate(addDays(b.date, b.validDays)) : "";

  return (
    <Document
      title={`Presupuesto ${number} — ${b.clientName || ""}`.trim()}
      author={B.name}
      creator={B.name}
      subject={b.projectName}
    >
      <Page
        size="A4"
        style={{
          backgroundColor: C.paper,
          paddingTop: PAGE.top,
          paddingBottom: PAGE.bottom,
          paddingHorizontal: PAGE.margin,
          fontFamily: F.body,
        }}
      >
        <RunningHeader number={number} />
        <Cover budget={b} logoSrc={logoSrc} number={number} typeLabel={typeLabel} />
        <Meta
          items={[
            { label: "Fecha", value: formatDate(b.date) },
            { label: "Válido hasta", value: validUntil },
            { label: "Moneda", value: b.currency },
          ]}
        />
        <Client name={b.clientName} />
        {b.type === "plans" && <Plans plans={b.plans} currency={b.currency} />}
        {b.type === "simple" && <Simple b={b} />}
        {b.type === "detailed" && <Detailed b={b} />}
        <TextBlock title="Forma de pago" text={b.paymentTerms} />
        <TextBlock title="Condiciones" text={b.conditions} />
        <TextBlock title="Nota" text={b.clientNote} />
        <View style={{ height: 1 }} />
        <Footer />
      </Page>
    </Document>
  );
}
