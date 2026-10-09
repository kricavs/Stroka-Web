import { Document, Page, View } from "@react-pdf/renderer";
import { STUDIO_BRAND as B, PROPOSAL_TYPES } from "../config";
import { addDays, formatDate } from "../calc";
import { C, F, PAGE } from "./theme";
import { Cover, Footer, RunningHeader, SideText } from "./Chrome";
import { DensityContext, pick } from "./density";
import { Detailed, Meta, NoteBox, Plans, Simple, TextBlock } from "./Sections";

// Single template used by BOTH the live preview and the PDF export.
// internalNote is intentionally never rendered.
export default function BudgetDocument({ budget: b, logoSrc, compact = false, onPages, breakBefore = null }) {
  const number = b.number || "PENDIENTE";
  const typeLabel = PROPOSAL_TYPES.find((t) => t.value === b.type)?.label || "";
  const validUntil = b.date && b.validDays ? formatDate(addDays(b.date, b.validDays)) : "";
  const intro = (b.intro || "").trim();

  return (
    <DensityContext.Provider value={compact}>
    <Document
      title={`Presupuesto ${number} — ${b.clientName || ""}`.trim()}
      author={B.name}
      creator={B.name}
      subject={b.projectName}
    >
      <Page
        size="A4"
        style={{
          backgroundColor: C.ink,
          color: C.text,
          paddingTop: pick(compact, PAGE.top, PAGE.top - 6),
          paddingBottom: pick(compact, PAGE.bottom, PAGE.bottom - 6),
          paddingHorizontal: PAGE.margin,
          fontFamily: F.body,
        }}
      >
        <RunningHeader number={number} logoSrc={logoSrc} />
        <SideText number={number} />
        <Cover budget={b} logoSrc={logoSrc} typeLabel={typeLabel} intro={intro} />
        <Meta
          items={[
            { label: "Presupuesto", value: number },
            { label: "Fecha", value: formatDate(b.date) },
            { label: "Válido hasta", value: validUntil },
            { label: "Moneda", value: b.currency },
          ]}
        />
        {b.type === "plans" && <Plans plans={b.plans} currency={b.currency} />}
        {b.type === "simple" && <Simple b={b} />}
        {b.type === "detailed" && <Detailed b={b} breakBefore={breakBefore} />}
        <TextBlock title="Forma de pago" text={b.paymentTerms} forceBreak={breakBefore === "pago"} />
        {/* short conditions travel with the note, so a page never holds only a note */}
        <View wrap={(b.conditions || "").length > 600} break={breakBefore === "condiciones"}>
          <TextBlock title="Condiciones" text={b.conditions} />
          <NoteBox text={b.clientNote} />
        </View>
        <Footer onPages={onPages} />
      </Page>
    </Document>
    </DensityContext.Provider>
  );
}
