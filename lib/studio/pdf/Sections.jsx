import { Text, View } from "@react-pdf/renderer";
import { formatMoney, lineTotal } from "../calc";
import { C, F } from "./theme";
import { Accent, Body, Box, Feature, InfoIcon, Label, Rule, SectionHead, Tag, display } from "./primitives";

const unitStyle = { fontFamily: F.body, fontSize: 10, fontWeight: 300, color: C.champagne, letterSpacing: 0.3 };

export function Meta({ items }) {
  return (
    <View
      wrap={false}
      style={{ flexDirection: "row", marginTop: 22, paddingVertical: 12, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.line }}
    >
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.line }}>
          <Label color={C.champagne}>{it.label}</Label>
          <Text style={{ fontFamily: F.body, fontSize: 9.5, fontWeight: 300, color: C.text, marginTop: 5 }}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

function PriceLine({ amount, currency, unit, size }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      <Text style={display(size, { lineHeight: 1.18, letterSpacing: 0.8 })}>{amount}</Text>
      {unit ? <Text style={{ ...unitStyle, marginLeft: 8, marginBottom: size * 0.16 }}>{unit}</Text> : null}
    </View>
  );
}

export function Plans({ plans, currency }) {
  const n = plans.length || 1;
  return (
    <View wrap={false} style={{ marginTop: 22 }}>
      <View style={{ flexDirection: "row" }}>
        {plans.map((p, i) => (
          <Box key={p.id} style={{ flex: 1, backgroundColor: C.panel, padding: n === 3 ? 14 : 16, marginLeft: i ? 14 : 0 }}>
            <Tag>{p.name || `Plan ${i + 1}`}</Tag>
            <View style={{ marginTop: 14 }}>
              <PriceLine amount={formatMoney(p.price, currency).replace(/^(\S+) /, "$1")} unit={p.unit} size={n === 3 ? 30 : 38} />
            </View>
            <Accent width={64} style={{ marginTop: 8, marginBottom: 12 }} />
            {p.description ? <Body style={{ fontSize: 8.5, color: C.grey, marginBottom: 12 }}>{p.description}</Body> : null}
            {p.features.map((f, k) => (
              <Feature key={k} size={n === 3 ? 8.2 : 9}>{f}</Feature>
            ))}
          </Box>
        ))}
      </View>
    </View>
  );
}

function Totals({ b, wide = false }) {
  const hasDiscount = b.discountAmount > 0;
  if (wide) {
    // Full-width price strip (simple proposals): compact, stays with its content.
    return (
      <Box wrap={false} style={{ marginTop: 14, backgroundColor: C.panel, paddingVertical: 14, paddingHorizontal: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ width: 230 }}>
          <Tag>Total</Tag>
          {hasDiscount && (
            <View style={{ marginTop: 10 }}>
              <Row label="Subtotal" value={formatMoney(b.subtotal, b.currency)} />
              <Row label={b.discount.kind === "percent" ? `Descuento ${b.discount.value}%` : "Descuento"} value={`– ${formatMoney(b.discountAmount, b.currency)}`} accent />
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <PriceLine amount={formatMoney(b.total, b.currency).replace(/^(\S+) /, "$1")} unit={b.currency} size={40} />
          <Accent width={64} style={{ marginTop: 6 }} />
        </View>
      </Box>
    );
  }
  return (
    <View wrap={false} style={{ marginTop: 20, flexDirection: "row", justifyContent: "flex-end" }}>
      <Box style={{ width: 280, backgroundColor: C.panel, padding: 16 }}>
        {hasDiscount && (
          <>
            <Row label="Subtotal" value={formatMoney(b.subtotal, b.currency)} />
            <Row
              label={b.discount.kind === "percent" ? `Descuento ${b.discount.value}%` : "Descuento"}
              value={`– ${formatMoney(b.discountAmount, b.currency)}`}
              accent
            />
            <Rule color={C.border} style={{ marginVertical: 12 }} />
          </>
        )}
        <Tag>Total</Tag>
        <View style={{ marginTop: 10 }}>
          <PriceLine amount={formatMoney(b.total, b.currency).replace(/^(\S+) /, "$1")} unit={b.currency} size={36} />
        </View>
        <Accent width={64} style={{ marginTop: 10 }} />
      </Box>
    </View>
  );
}

function Row({ label, value, accent }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
      <Label color={accent ? C.champagne : C.grey}>{label}</Label>
      <Text style={{ fontFamily: F.body, fontSize: 9, fontWeight: 300, color: C.text }}>{value}</Text>
    </View>
  );
}

export function Simple({ b }) {
  const s = b.simple;
  const hasD = s.deliverables.length > 0;
  return (
    <View style={{ marginTop: 28 }}>
      <Text minPresenceAhead={80} style={display(26, { letterSpacing: 0.6 })}>{(s.title || "").toUpperCase()}</Text>
      {s.description ? <Body style={{ marginTop: 10, maxWidth: 400 }}>{s.description}</Body> : null}
      {(hasD || s.scope) && (
        <View wrap={false} style={{ flexDirection: "row", marginTop: 14 }}>
          {hasD && (
            <Box style={{ flex: 1, backgroundColor: C.panel, padding: 18 }}>
              <Tag style={{ marginBottom: 14 }}>Entregables</Tag>
              {s.deliverables.map((d, i) => <Feature key={i}>{d}</Feature>)}
            </Box>
          )}
          {s.scope ? (
            <Box style={{ flex: 1, backgroundColor: C.panel, padding: 18, marginLeft: hasD ? 14 : 0 }}>
              <Tag style={{ marginBottom: 14 }}>Alcance</Tag>
              <Body style={{ fontSize: 9 }}>{s.scope}</Body>
            </Box>
          ) : null}
        </View>
      )}
      <Totals b={b} wide />
    </View>
  );
}

export function Detailed({ b }) {
  return (
    <View>
      <View minPresenceAhead={120}><SectionHead>Servicios</SectionHead></View>
      {b.items.map((it, i) => (
        <View
          key={it.id}
          wrap={false}
          style={{ flexDirection: "row", paddingVertical: 15, borderTopWidth: 0.5, borderTopColor: C.line }}
        >
          <Text style={{ fontFamily: F.body, fontSize: 8, fontWeight: 500, letterSpacing: 1.4, color: C.champagne, width: 30, paddingTop: 4 }}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={display(15, { letterSpacing: 0.5 })}>{(it.description || "").toUpperCase()}</Text>
            {it.detail ? <Body style={{ marginTop: 5, fontSize: 8.5, color: C.grey }}>{it.detail}</Body> : null}
          </View>
          <View style={{ width: 130, alignItems: "flex-end" }}>
            <Text style={display(19, { letterSpacing: 0.6 })}>{formatMoney(lineTotal(it), b.currency)}</Text>
            <Label style={{ marginTop: 4 }}>{`${it.quantity} × ${formatMoney(it.unitPrice, b.currency)}`}</Label>
          </View>
        </View>
      ))}
      <Rule color={C.border} />
      <Totals b={b} />
    </View>
  );
}

export function TextBlock({ title, text }) {
  if (!text) return null;
  return (
    // short blocks never split (no orphaned heading); long ones may flow across pages
    <View wrap={text.length > 600}>
      <SectionHead>{title}</SectionHead>
      <Body>{text}</Body>
    </View>
  );
}

// Boxed note with info icon (first line white, the rest secondary grey).
export function NoteBox({ text }) {
  if (!text) return null;
  const [first, ...rest] = text.split("\n");
  return (
    <Box wrap={false} style={{ marginTop: 20, flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 18 }}>
      <InfoIcon size={22} />
      <View style={{ width: 0.5, alignSelf: "stretch", backgroundColor: C.border, marginHorizontal: 16 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.body, fontSize: 8.5, fontWeight: 600, letterSpacing: 0.8, color: C.champagne, marginBottom: 4 }}>NOTA</Text>
        <Text style={{ fontFamily: F.body, fontSize: 9, fontWeight: 300, lineHeight: 1.5, color: C.text }}>{first}</Text>
        {rest.length > 0 && (
          <Text style={{ fontFamily: F.body, fontSize: 8.5, fontWeight: 300, lineHeight: 1.5, color: C.grey, marginTop: 2 }}>
            {rest.join("\n")}
          </Text>
        )}
      </View>
    </Box>
  );
}
