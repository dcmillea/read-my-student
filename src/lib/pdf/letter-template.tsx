/**
 * React-PDF letter template.
 *
 * Renders a formal recommendation letter with letterhead logo, address block,
 * body text, sign-off, and handwritten signature image.
 *
 * All images must be supplied as base64 data URIs so the renderer never needs
 * to make outbound HTTP requests at PDF-build time.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image as PdfImage,
  StyleSheet,
} from "@react-pdf/renderer";
import type { RecommenderForm } from "@/lib/faculty-profile";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LetterDocumentProps = {
  /** Snapshot of the recommender form at the time of finalization */
  recommender: Partial<RecommenderForm>;
  /** Plain-text body of the letter (paragraphs separated by newlines) */
  letterBody: string;
  /** Base64 data URI for the letterhead logo, or null if none */
  logoDataUri: string | null;
  /** Base64 data URI for the signature PNG, or null if none */
  signatureDataUri: string | null;
  /** Formatted date string shown near the top of the letter */
  date: string;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#1a472a";
const GRAY_TEXT = "#555555";
const BODY_TEXT = "#222222";
const DIVIDER = "#cccccc";

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 64,
    paddingRight: 64,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: BODY_TEXT,
    lineHeight: 1.6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logo: {
    width: 80,
    height: 44,
    objectFit: "contain",
    marginRight: 10,
  },
  department: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: GREEN,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  addressLine: {
    fontSize: 9,
    color: GRAY_TEXT,
    lineHeight: 1.5,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: DIVIDER,
    marginTop: 10,
    marginBottom: 14,
  },
  date: {
    fontSize: 10,
    color: GRAY_TEXT,
    marginBottom: 16,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.75,
    marginBottom: 8,
    color: BODY_TEXT,
  },
  closing: {
    marginTop: 28,
  },
  signOff: {
    fontSize: 10,
    color: BODY_TEXT,
    marginBottom: 6,
  },
  signatureImage: {
    width: 130,
    height: 52,
    objectFit: "contain",
    marginBottom: 4,
  },
  signerName: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: BODY_TEXT,
  },
  signerMeta: {
    fontSize: 9,
    color: GRAY_TEXT,
    marginTop: 1,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export function LetterDocument({
  recommender,
  letterBody,
  logoDataUri,
  signatureDataUri,
  date,
}: LetterDocumentProps) {
  const fullName = [
    recommender.prefix,
    recommender.firstName,
    recommender.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  // Build address lines, skipping blank parts
  const cityStateLine = [recommender.city, recommender.state]
    .filter(Boolean)
    .join(", ")
    .concat(recommender.postalCode ? ` ${recommender.postalCode}` : "");

  const addressLines = [
    recommender.street,
    cityStateLine || null,
    recommender.country,
  ].filter((l): l is string => Boolean(l));

  // Split body text into paragraphs on one or more blank lines
  const paragraphs = letterBody
    .split(/\n{2,}|\r\n{2,}/)
    .flatMap((chunk) => chunk.split(/\n|\r\n/))
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document>
      <Page size='LETTER' style={styles.page}>
        {/* ── Letterhead ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoDataUri && (
              <PdfImage style={styles.logo} src={logoDataUri} />
            )}
            <View>
              {recommender.department ? (
                <Text style={styles.department}>
                  {recommender.department}
                </Text>
              ) : null}
              {fullName ? (
                <Text style={styles.signerName}>{fullName}</Text>
              ) : null}
              {recommender.title ? (
                <Text style={styles.signerMeta}>{recommender.title}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.headerRight}>
            {addressLines.map((line, i) => (
              <Text key={i} style={styles.addressLine}>
                {line}
              </Text>
            ))}
            {/* Date in header right for visual balance */}
            <Text style={styles.date}>{date}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Letter body ── */}
        {paragraphs.map((para, i) => (
          <Text key={i} style={styles.paragraph}>
            {para}
          </Text>
        ))}

        {/* ── Closing block ── */}
        <View style={styles.closing}>
          <Text style={styles.signOff}>
            {recommender.signOff || "Sincerely,"}
          </Text>
          {signatureDataUri && (
            <PdfImage
              style={styles.signatureImage}
              src={signatureDataUri}
            />
          )}
          {fullName ? (
            <Text style={styles.signerName}>{fullName}</Text>
          ) : null}
          {recommender.title ? (
            <Text style={styles.signerMeta}>{recommender.title}</Text>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}
