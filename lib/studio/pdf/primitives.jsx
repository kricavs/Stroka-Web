import { Circle, Path, Svg, Text, View } from "@react-pdf/renderer";
import { C, F } from "./theme";

export const display = (size, extra) => ({
  fontFamily: F.display,
  fontWeight: 400,
  fontSize: size,
  color: C.text,
  ...extra,
});

// Small uppercase label with wide tracking.
export function Label({ children, color = C.grey, style }) {
  return (
    <Text
      style={{ fontFamily: F.body, fontSize: 6.5, fontWeight: 500, letterSpacing: 1.8, color, ...style }}
    >
      {String(children).toUpperCase()}
    </Text>
  );
}

// Filled champagne tag (PLAN INICIAL, TOTAL...).
export function Tag({ children, style }) {
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: C.champagne, paddingVertical: 2.5, paddingHorizontal: 7, ...style }}>
      <Text style={{ fontFamily: F.body, fontSize: 7, fontWeight: 600, letterSpacing: 0.9, color: C.onChampagne }}>
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

export function Rule({ color = C.line, style }) {
  return <View style={{ height: 0.5, backgroundColor: color, ...style }} />;
}

// Short champagne underline used under prices/client name.
export function Accent({ width = 36, style }) {
  return <View style={{ width, height: 0.75, backgroundColor: C.champagne, ...style }} />;
}

export function Box({ children, style, ...rest }) {
  return (
    <View style={{ borderWidth: 0.75, borderColor: C.border, ...style }} {...rest}>
      {children}
    </View>
  );
}

export function CheckIcon({ size = 9 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 10 10">
      <Circle cx="5" cy="5" r="4.4" stroke={C.champagne} strokeWidth="0.6" fill="none" />
      <Path d="M2.9 5.1 L4.4 6.5 L7.1 3.6" stroke={C.champagne} strokeWidth="0.7" fill="none" />
    </Svg>
  );
}

export function InfoIcon({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Circle cx="10" cy="10" r="9" stroke={C.champagne} strokeWidth="0.8" fill="none" />
      <Circle cx="10" cy="5.8" r="0.9" fill={C.champagne} />
      <Path d="M10 8.6 L10 14.6" stroke={C.champagne} strokeWidth="1.1" fill="none" />
    </Svg>
  );
}

// Supports **bold** highlights inside a line (as in the reference).
export function Rich({ children, style, bold = C.text }) {
  const parts = String(children).split(/\*\*(.+?)\*\*/g);
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        i % 2 ? (
          <Text key={i} style={{ fontWeight: 600, color: bold }}>{p}</Text>
        ) : (
          p
        )
      )}
    </Text>
  );
}

export function Body({ children, style }) {
  return (
    <Text
      orphans={2}
      widows={2}
      style={{ fontFamily: F.body, fontSize: 9, fontWeight: 300, lineHeight: 1.65, color: C.text, ...style }}
    >
      {children}
    </Text>
  );
}

export function Feature({ children, size = 9 }) {
  return (
    <View wrap={false} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 6 }}>
      <View style={{ width: 16, paddingTop: 1 }}><CheckIcon size={size + 1} /></View>
      <Rich style={{ flex: 1, fontFamily: F.body, fontSize: size, fontWeight: 300, lineHeight: 1.45, color: C.text }}>
        {children}
      </Rich>
    </View>
  );
}

// Section heading: champagne tag-less label + hairline, kept with what follows.
export function SectionHead({ children }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 30, marginBottom: 16 }}>
      <Label color={C.champagne} style={{ fontSize: 7, fontWeight: 600, letterSpacing: 2.4 }}>{children}</Label>
      <Rule style={{ flex: 1, marginLeft: 12 }} />
    </View>
  );
}
