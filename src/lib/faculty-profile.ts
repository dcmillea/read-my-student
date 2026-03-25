/**
 * Types and mapping helpers for faculty profile autofill.
 *
 * The `faculty` table stores persistent profile fields that pre-populate the
 * "Recommender details" step every time the faculty member drafts a new letter.
 * `FacultyProfileRow` mirrors the DB columns added in the accompanying SQL migration.
 */

// ─── Recommender form types (used inside the "Write Letter" dialog) ───────────

export type RecommenderProfile = {
  prefix?: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  department?: string;
  title?: string;
  /** Per-letter field – NOT persisted to the faculty profile row. */
  relationship?: string;
  /** Letter sign-off (e.g. "Sincerely," / "Best regards,"). Persisted to profile. */
  signOff?: string;
  email?: string;
  phone?: string;
  country?: string;
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type RecommenderForm = Required<RecommenderProfile>;

export const EMPTY_RECOMMENDER_FORM: RecommenderForm = {
  prefix: "",
  firstName: "",
  lastName: "",
  organization: "",
  department: "",
  title: "",
  relationship: "",
  signOff: "Sincerely,",
  email: "",
  phone: "",
  country: "",
  street: "",
  city: "",
  state: "",
  postalCode: "",
};

export function buildRecommenderForm(
  profile?: RecommenderProfile,
): RecommenderForm {
  return { ...EMPTY_RECOMMENDER_FORM, ...profile };
}

// ─── DB row shape (mirrors the faculty table after the SQL migration) ─────────

export type FacultyProfileRow = {
  // existing columns
  id: string;
  user_id: string;
  institution: string | null;
  institution_opeid: string | null;
  department: string | null;
  title: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  postal_code: string | null;
  street: string | null;
  // asset columns
  signature_storage_path: string | null;
  logo_storage_path: string | null;
  /** ISO timestamp of the last logo upload; nulled by the cron after the 1-year retention window */
  logo_uploaded_at: string | null;
  /** ISO timestamp of the last signature upload; nulled by the cron after the 1-year retention window */
  signature_uploaded_at: string | null;
  // new columns
  prefix: string | null;
};

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/** Convert a DB row into a RecommenderProfile for form initialisation. */
export function dbRowToProfile(
  row: FacultyProfileRow,
  authEmail?: string | null,
  firstName?: string | null,
  lastName?: string | null,
): RecommenderProfile {
  return {
    prefix: row.prefix ?? "",
    firstName: firstName ?? "",
    lastName: lastName ?? "",
    organization: row.institution ?? "",
    department: row.department ?? "",
    title: row.title ?? "",
    email: authEmail ?? "",
    phone: "",
    country: row.country ?? "",
    state: row.state ?? "",
    city: row.city ?? "",
    postalCode: row.postal_code ?? "",
    street: row.street ?? "",
    signOff: "Sincerely,",
    // `relationship` is intentionally omitted – it is per-letter, not a profile field.
  };
}

/** Convert the recommender form back to DB column names for an update/upsert. */
export function profileFormToDbRow(
  form: RecommenderForm,
): Partial<FacultyProfileRow> {
  return {
    prefix: form.prefix || null,
    institution: form.organization || null,
    department: form.department || null,
    title: form.title || null,
    country: form.country || null,
    state: form.state || null,
    city: form.city || null,
    postal_code: form.postalCode || null,
    street: form.street || null,
  };
}
