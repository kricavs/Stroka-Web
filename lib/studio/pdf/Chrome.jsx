import { Image, Text, View } from "@react-pdf/renderer";
/* eslint-disable jsx-a11y/alt-text -- react-pdf Image is not an <img> */
import { STUDIO_BRAND as B } from "../config";
import { C, F, PAGE } from "./theme";
import { Label, Rule } from "./primitives";

// Black cover band (first page only, in flow, bleeding to the page edges).
export function Cover({ budget, logoSrc, number, typeLabel }) {
  const logoH = 36;
  return (
    <View
      style={{
        backgroundColor: C.ink,
        marginTop: -PAGE.top,
        marginHorizontal: -PAGE.margin,
        paddingHorizontal: PAGE.margin,
        paddingTop: 32,
        paddingBottom: 32,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Image src={logoSrc} style={{ height: logoH, width: (logoH * B.logoWidth) / B.logoHeight }} />
        <View style={{ alignItems: "flex-end" }}>
          <Label color={C.champagne}>Presupuesto</Label>
          <Text style={{ fontFamily: F.display, fontWeight: 500, fontSize: 15, letterSpacing: 2, color: "#fff", marginTop: 4 }}>
            {number}
          </Text>
        </View>
      </View>
      <View style={{ height: 0.5, backgroundColor: "#3a3a3d", marginTop: 26, marginBottom: 20 }} />
      <Label color={C.champagne}>{typeLabel}</Label>
      <Text
        style={{
          fontFamily: F.display,
          fontWeight: 700,
          fontSize: 46,
          lineHeight: 1,
          letterSpacing: 1,
          color: "#fff",
          marginTop: 10,
        }}
      >
        {(budget.projectName || "Proyecto").toUpperCase()}
      </Text>
    </View>
  );
}

// Slim running header on pages 2+.
export function RunningHeader({ number }) {
  return (
    <View
      fixed
      style={{ position: "absolute", top: 26, left: PAGE.margin, right: PAGE.margin }}
      render={({ pageNumber }) =>
        pageNumber > 1 ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 7 }}>
              <Text style={{ fontFamily: F.display, fontWeight: 600, fontSize: 9, letterSpacing: 3, color: C.ink }}>
                {B.wordmark}
              </Text>
              <Label>{number}</Label>
            </View>
            <Rule />
          </>
        ) : null
      }
    />
  );
}

// Institutional footer, every page.
export function Footer() {
  const contact = [B.email, B.phone, B.website, B.instagram, B.location].filter(Boolean);
  return (
    <View
      fixed
      style={{ position: "absolute", bottom: 26, left: PAGE.margin, right: PAGE.margin }}
    >
      <Rule color={C.ink} style={{ marginBottom: 9 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={{ fontFamily: F.display, fontWeight: 700, fontSize: 11, letterSpacing: 3.5, color: C.ink }}>
            {B.wordmark}
          </Text>
          <Label style={{ marginTop: 3 }}>{B.tagline}</Label>
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: 300 }}>
          <Text style={{ fontFamily: F.body, fontSize: 7, color: C.text, letterSpacing: 0.4 }}>
            {contact.join("   ·   ")}
          </Text>
          <Text
            style={{ fontFamily: F.body, fontSize: 6.5, color: C.grey, letterSpacing: 1.5, marginTop: 4 }}
            render={({ pageNumber, totalPages }) =>
              `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
            }
          />
        </View>
      </View>
    </View>
  );
}
