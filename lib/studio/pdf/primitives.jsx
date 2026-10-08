import { Text, View } from "@react-pdf/renderer";
import { C, F } from "./theme";

// Tiny uppercase label with wide tracking.
export function Label({ children, color = C.grey, style }) {
  return (
    <Text
      style={{
        fontFamily: F.body,
        fontSize: 6.5,
        fontWeight: 500,
        letterSpacing: 1.8,
        color,
        ...style,
      }}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

export function Rule({ color = C.line, style }) {
  return <View style={{ height: 0.5, backgroundColor: color, ...style }} />;
}

// Section heading: label + hairline, kept with what follows.
export function SectionHead({ children }) {
  return (
    <View
      minPresenceAhead={60}
      style={{ flexDirection: "row", alignItems: "center", marginTop: 30, marginBottom: 14 }}
    >
      <View style={{ width: 5, height: 5, backgroundColor: C.champagne, marginRight: 8 }} />
      <Label color={C.ink}>{children}</Label>
      <Rule style={{ flex: 1, marginLeft: 10 }} />
    </View>
  );
}

export function Body({ children, style }) {
  return (
    <Text
      orphans={2}
      widows={2}
      style={{
        fontFamily: F.body,
        fontSize: 9,
        fontWeight: 400,
        lineHeight: 1.6,
        color: C.text,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

export function Dash({ children }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", marginBottom: 5 }}>
      <Text style={{ fontFamily: F.body, fontSize: 9, color: C.champagne, width: 12 }}>—</Text>
      <Body style={{ flex: 1 }}>{children}</Body>
    </View>
  );
}
