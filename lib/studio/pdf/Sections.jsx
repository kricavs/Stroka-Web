import { Text, View } from "@react-pdf/renderer";
import { formatMoney, lineTotal } from "../calc";
import { C, F } from "./theme";
import { Body, Dash, Label, Rule, SectionHead } from "./primitives";

const display = (size, weight = 700, color = C.ink, extra) => ({
  fontFamily: F.display,
  fontWeight: weight,
  fontSize: size,
  color,
  ...extra,
});

export function Meta({ items }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: C.line }}>
      {items.map((it, i) => (
        <View key={it.label} style={{ flex: 1, paddingLeft: i ? 12 : 0, borderLeftWidth: i ? 0.5 : 0, borderLeftColor: C.line }}>
          <Label>{it.label}</Label>
          <Text style={{ fontFamily: F.body, fontSize: 9.5, fontWeight: 500, color: C.ink, marginTop: 5 }}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Client({ name }) {
  return (
    <View wrap={false} style={{ marginTop: 26 }}>
      <Label>Preparado para</Label>
      <Text style={display(26, 600, C.ink, { letterSpacing: 0.5, marginTop: 5 })}>{(name || "Cliente").toUpperCase()}</Text>
    </View>
  );
}

export function Plans({ plans, currency }) {
  const n = plans.length || 1;
  return (
    <View wrap={false}>
      <SectionHead>Alternativas</SectionHead>
      <View style={{ flexDirection: "row", borderWidth: 0.75, borderColor: C.ink }}>
        {plans.map((p, i) => (
          <View
            key={p.id}
            style={{
              flex: 1,
              borderLeftWidth: i ? 0.75 : 0,
              borderLeftColor: C.ink,
              padding: n === 3 ? 14 : 18,
            }}
          >
            <Label color={C.champagne}>{String(i + 1).padStart(2, "0")}</Label>
            <Text style={display(n === 3 ? 22 : 26, 700, C.ink, { letterSpacing: 0.6, marginTop: 6 })}>
              {(p.name || "Plan").toUpperCase()}
            </Text>
            {p.description ? <Body style={{ marginTop: 6, fontSize: 8 }}>{p.description}</Body> : null}
            <Rule style={{ marginVertical: 14 }} />
            <Text style={display(n === 3 ? 28 : 34, 600, C.ink, { lineHeight: 1 })}>{formatMoney(p.price, currency)}</Text>
            {p.unit ? <Label style={{ marginTop: 5 }}>{p.unit}</Label> : null}
            <Rule style={{ marginVertical: 14 }} />
            {p.features.map((f, k) => (
              <View key={k} style={{ flexDirection: "row", marginBottom: 6 }}>
                <Text style={{ fontFamily: F.body, fontSize: 8, color: C.champagne, width: 11 }}>—</Text>
                <Body style={{ flex: 1, fontSize: 8.5 }}>{f}</Body>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Totals({ b }) {
  const hasDiscount = b.discountAmount > 0;
  return (
    <View wrap={false} style={{ marginTop: 22, alignItems: "flex-end" }}>
      <View style={{ width: 250 }}>
        {hasDiscount && (
          <>
            <Row label="Subtotal" value={formatMoney(b.subtotal, b.currency)} />
            <Row
              label={b.discount.kind === "percent" ? `Descuento ${b.discount.value}%` : "Descuento"}
              value={`– ${formatMoney(b.discountAmount, b.currency)}`}
            />
            <Rule color={C.ink} style={{ marginVertical: 10 }} />
          </>
        )}
        <Label color={C.champagne}>Total</Label>
        <Text style={display(40, 700, C.ink, { lineHeight: 1, marginTop: 4, textAlign: "right" })}>
          {formatMoney(b.total, b.currency)}
        </Text>
        <Label style={{ textAlign: "right", marginTop: 5 }}>{b.currency}</Label>
      </View>
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
      <Label>{label}</Label>
      <Text style={{ fontFamily: F.body, fontSize: 9, color: C.text }}>{value}</Text>
    </View>
  );
}

export function Simple({ b }) {
  const s = b.simple;
  return (
    <View>
      <SectionHead>Propuesta</SectionHead>
      <Text style={display(24, 600, C.ink, { letterSpacing: 0.5 })}>{(s.title || "").toUpperCase()}</Text>
      {s.description ? <Body style={{ marginTop: 8 }}>{s.description}</Body> : null}
      {(s.deliverables.length > 0 || s.scope) && (
        <View wrap={false} style={{ flexDirection: "row", marginTop: 22 }}>
          {s.deliverables.length > 0 && (
            <View style={{ flex: 1, paddingRight: 16 }}>
              <Label color={C.ink} style={{ marginBottom: 9 }}>Entregables</Label>
              {s.deliverables.map((d, i) => <Dash key={i}>{d}</Dash>)}
            </View>
          )}
          {s.scope ? (
            <View style={{ flex: 1, paddingLeft: s.deliverables.length ? 16 : 0, borderLeftWidth: s.deliverables.length ? 0.5 : 0, borderLeftColor: C.line }}>
              <Label color={C.ink} style={{ marginBottom: 9 }}>Alcance</Label>
              <Body>{s.scope}</Body>
            </View>
          ) : null}
        </View>
      )}
      <Totals b={b} />
    </View>
  );
}

export function Detailed({ b }) {
  return (
    <View>
      <SectionHead>Servicios</SectionHead>
      {b.items.map((it, i) => (
        <View
          key={it.id}
          wrap={false}
          style={{ flexDirection: "row", paddingVertical: 13, borderTopWidth: i ? 0.5 : 0, borderTopColor: C.line }}
        >
          <Text style={display(11, 500, C.champagne, { width: 30, letterSpacing: 1, paddingTop: 2 })}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <View style={{ flex: 1, paddingRight: 14 }}>
            <Text style={display(15, 600, C.ink, { letterSpacing: 0.6 })}>{(it.description || "").toUpperCase()}</Text>
            {it.detail ? <Body style={{ marginTop: 4, fontSize: 8.5, color: C.grey }}>{it.detail}</Body> : null}
          </View>
          <View style={{ width: 130, alignItems: "flex-end" }}>
            <Text style={display(16, 600, C.ink)}>{formatMoney(lineTotal(it), b.currency)}</Text>
            <Label style={{ marginTop: 3 }}>
              {`${it.quantity} × ${formatMoney(it.unitPrice, b.currency)}`}
            </Label>
          </View>
        </View>
      ))}
      <Rule color={C.ink} style={{ marginTop: 2 }} />
      <Totals b={b} />
    </View>
  );
}

export function TextBlock({ title, text }) {
  if (!text) return null;
  return (
    <View>
      <SectionHead>{title}</SectionHead>
      <Body>{text}</Body>
    </View>
  );
}
