import { Image, Text, View } from "@react-pdf/renderer";
/* eslint-disable jsx-a11y/alt-text -- react-pdf Image is not an <img> */
import { STUDIO_BRAND as B } from "../config";
import { C, F, PAGE, titleSize } from "./theme";
import { Accent, Body, Label, Rule, display } from "./primitives";

const logoDims = (h) => ({ height: h, width: (h * B.logoWidth) / B.logoHeight });

// First-page header: logo, champagne eyebrow, huge condensed title, client.
export function Cover({ budget, logoSrc, typeLabel, intro }) {
  const title = (budget.projectName || "Proyecto").toUpperCase();
  return (
    <View style={{ marginTop: -40 }}>
      <Image src={logoSrc} style={logoDims(34)} />
      <Text
        style={{ fontFamily: F.body, fontSize: 11, fontWeight: 300, letterSpacing: 2.2, color: C.champagne, marginTop: 38 }}
      >
        {typeLabel.toUpperCase()}
      </Text>
      <Text style={display(titleSize(title), { lineHeight: 1.04, letterSpacing: 0.4, marginTop: 10 })}>{title}</Text>
      <Text
        style={{ fontFamily: F.body, fontSize: 13, fontWeight: 300, letterSpacing: 3.4, color: C.champagne, marginTop: 26 }}
      >
        {(budget.clientName || "Cliente").toUpperCase()}
      </Text>
      <Accent width={34} style={{ marginTop: 9 }} />
      {intro ? <Body style={{ marginTop: 16, fontSize: 9.5, maxWidth: 360 }}>{intro}</Body> : null}
    </View>
  );
}

// Vertical institutional line on the right edge of page 1 (as in the reference).
export function SideText({ number }) {
  const text = `${B.tagline}  ·  ${number}`.toUpperCase();
  return (
    <View
      fixed
      style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0 }}
      render={({ pageNumber }) =>
        pageNumber === 1 ? (
          <Text
            style={{
              position: "absolute",
              left: -24,
              top: 430,
              width: 330,
              textAlign: "left",
              fontFamily: F.body,
              fontSize: 5.8,
              fontWeight: 400,
              letterSpacing: 1.9,
              color: C.text,
              transform: "rotate(-90deg)",
              transformOrigin: "left center",
            }}
          >
            {text}
          </Text>
        ) : null
      }
    />
  );
}

// Slim running header on pages 2+.
export function RunningHeader({ number, logoSrc }) {
  return (
    <View
      fixed
      style={{ position: "absolute", top: 28, left: PAGE.margin, right: PAGE.margin }}
      render={({ pageNumber }) =>
        pageNumber > 1 ? (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
              <Image src={logoSrc} style={logoDims(15)} />
              <Label color={C.champagne}>{number}</Label>
            </View>
            <Rule />
          </>
        ) : null
      }
    />
  );
}

// Institutional footer on every page.
export function Footer() {
  const contact = [B.email, B.phone, B.website, B.instagram, B.location].filter(Boolean);
  return (
    <View fixed style={{ position: "absolute", bottom: 28, left: PAGE.margin, right: PAGE.margin }}>
      <Rule style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View>
            <Text style={{ fontFamily: F.body, fontSize: 11, fontWeight: 300, letterSpacing: 4.2, color: C.text }}>
              {B.wordmark}
            </Text>
            <Text style={{ fontFamily: F.body, fontSize: 6.8, fontWeight: 300, color: C.champagne, marginTop: 3 }}>
              {B.tagline}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", maxWidth: 270 }}>
          <Text style={{ fontFamily: F.body, fontSize: 6.8, fontWeight: 300, color: C.grey, letterSpacing: 0.3 }}>
            {contact.join("   ·   ")}
          </Text>
          <Text
            style={{ fontFamily: F.body, fontSize: 6.5, color: C.champagne, letterSpacing: 1.6, marginTop: 5 }}
            render={({ pageNumber, totalPages }) =>
              `${String(pageNumber).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`
            }
          />
        </View>
      </View>
    </View>
  );
}
