"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import {
  RequestNotificationEmail,
  FacultyInvitationEmail,
  InstitutionDeliveryEmail,
  StudentRejectionEmail,
  RequestRejectionEmail,
} from "@/components/letter-request-email-templates";
import { randomBytes, createHash } from "crypto";
import { stripe } from "@/lib/stripe";
import type { RecommenderForm } from "@/lib/faculty-profile";
import { sanitizeLetterHtml, validateLexicalJson } from "@/lib/sanitize";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Types ───────────────────────────────────────────────────────────────────

export type DraftPayload = {
  recommenderForm: RecommenderForm;
  letterHtml: string;
  letterPlainText: string;
  /** Serialised Lexical editor state string */
  letterEditorState: string | null;
  /** Storage path of the logo used on this letter (may differ from profile) */
  logoStoragePath?: string | null;
  /** Storage path of the signature PNG used on this letter */
  signatureStoragePath?: string | null;
};

export type DraftRow = {
  id: string;
  recommender_snapshot: RecommenderForm | null;
  letter_body_html: string | null;
  letter_plain_text: string | null;
  /** Lexical state re-serialised back to string for the editor */
  letter_editor_state: string | null;
  letterhead_logo_storage_path: string | null;
  signature_image_storage_path: string | null;
  student_preview_enabled: boolean;
};

export type StudentLetterPreview = {
  html: string | null;
  recommenderSnapshot: RecommenderForm | null;
  logoSignedUrl: string | null;
  signatureSignedUrl: string | null;
  finalizedAt: string | null;
};

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Upsert a draft letter for a given request.
 * Requires a UNIQUE constraint on letters(request_id) — add it if missing:
 *   ALTER TABLE letters ADD CONSTRAINT letters_request_id_unique UNIQUE (request_id);
 *
 * Also requires these columns (run migration if not present):
 *   ALTER TABLE letters
 *     ADD COLUMN IF NOT EXISTS recommender_snapshot         jsonb,
 *     ADD COLUMN IF NOT EXISTS letterhead_logo_storage_path text,
 *     ADD COLUMN IF NOT EXISTS signature_image_storage_path text,
 *     ADD COLUMN IF NOT EXISTS letter_plain_text            text;
 */
export async function saveDraft(
  requestId: string,
  payload: DraftPayload,
): Promise<{ success: boolean; letterId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  // Resolve faculty row
  const { data: facultyRow } = await supabase
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!facultyRow)
    return { success: false, error: "Faculty record not found." };

  // Resolve request (gives us student_id + ownership check via RLS)
  const { data: requestRow } = await supabase
    .from("letter_requests")
    .select("student_id")
    .eq("id", requestId)
    .single();
  if (!requestRow) return { success: false, error: "Request not found." };

  // Parse and validate the Lexical editor state string → jsonb
  let editorJson: object | null = null;
  if (payload.letterEditorState) {
    try {
      const parsed = JSON.parse(payload.letterEditorState) as unknown;
      if (validateLexicalJson(parsed)) {
        editorJson = parsed;
      } else {
        return { success: false, error: "Invalid editor state structure." };
      }
    } catch {
      // not valid JSON — store null rather than crashing
    }
  }

  // Sanitize the HTML produced by $generateHtmlFromNodes
  const safeHtml = payload.letterHtml
    ? sanitizeLetterHtml(payload.letterHtml)
    : null;

  const { data: upserted, error } = await supabase
    .from("letters")
    .upsert(
      {
        request_id: requestId,
        faculty_id: facultyRow.id,
        student_id: requestRow.student_id,
        is_draft: true,
        status: "draft",
        recommender_snapshot: payload.recommenderForm,
        letter_body_html: safeHtml,
        letter_plain_text: payload.letterPlainText || null,
        letter_body_json: editorJson,
        letterhead_logo_storage_path: payload.logoStoragePath ?? null,
        signature_image_storage_path: payload.signatureStoragePath ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" },
    )
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, letterId: upserted.id as string };
}

/**
 * Load an existing draft for a request.
 * Returns null if no draft exists or the user is not authenticated.
 */
export async function loadDraft(requestId: string): Promise<DraftRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("letters")
    .select(
      "id, recommender_snapshot, letter_body_html, letter_plain_text, letter_body_json, letterhead_logo_storage_path, signature_image_storage_path, student_preview_enabled",
    )
    .eq("request_id", requestId)
    .eq("is_draft", true)
    .maybeSingle();

  if (error || !data) return null;

  // Re-serialise jsonb → string so the Lexical editor can consume it
  const editorState =
    data.letter_body_json != null
      ? JSON.stringify(data.letter_body_json)
      : null;

  return {
    id: data.id as string,
    recommender_snapshot: data.recommender_snapshot as RecommenderForm | null,
    letter_body_html: data.letter_body_html as string | null,
    letter_plain_text: data.letter_plain_text as string | null,
    letter_editor_state: editorState,
    letterhead_logo_storage_path: data.letterhead_logo_storage_path as
      | string
      | null,
    signature_image_storage_path: data.signature_image_storage_path as
      | string
      | null,
    student_preview_enabled: (data.student_preview_enabled as boolean) ?? false,
  };
}

/**
 * Seals a draft letter: sets is_draft = false, status = 'finalized', and
 * finalized_at = now(). Also advances letter_requests.status to 'in_progress'
 * so the student knows the letter is ready for delivery.
 *
 * Returns an error if the letter is already finalized or doesn't belong to the
 * calling faculty member.
 */
export async function finalizeLetter(
  requestId: string,
): Promise<{ success: boolean; letterId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow)
    return { success: false, error: "Faculty record not found." };

  const { data: letter } = await supabaseAdmin
    .from("letters")
    .select("id, is_draft")
    .eq("request_id", requestId)
    .eq("faculty_id", facultyRow.id)
    .maybeSingle();

  if (!letter)
    return { success: false, error: "Letter not found or access denied." };
  if (!letter.is_draft)
    return { success: false, error: "This letter has already been finalized." };

  const now = new Date().toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("letters")
    .update({ is_draft: false, status: "final", finalized_at: now })
    .eq("id", letter.id);

  if (updateError) return { success: false, error: updateError.message };

  // Advance request status so the student can proceed to pay for delivery.
  await supabaseAdmin
    .from("letter_requests")
    .update({ status: "in_progress" })
    .eq("id", requestId);

  return { success: true, letterId: letter.id as string };
}

// ─── Send Letter Request ─────────────────────────────────────────────────────

export type SendRequestPayload = {
  professorEmail: string;
  courseContext?: string;
  studentNote?: string;
};

export type SendRequestResult =
  | { status: "requested"; requestId: string }
  | { status: "invited"; requestId: string }
  | { status: "error"; error: string };

/**
 * Creates a letter request and sends the appropriate email:
 * - If the professor email matches a faculty row in the DB, creates a
 *   letter_request and sends a "new request" notification.
 * - If the professor is not registered, sends a persuasive invitation email.
 */
export async function sendLetterRequest(
  payload: SendRequestPayload,
): Promise<SendRequestResult> {
  const supabase = await createClient();

  // ── Authenticate student ──────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", error: "Not authenticated." };

  const studentFullName =
    [user.user_metadata?.firstName, user.user_metadata?.lastName]
      .filter(Boolean)
      .join(" ") || "A student";

  // Get student row for university info (use admin client to bypass any RLS gaps)
  const { data: studentRow } = await supabaseAdmin
    .from("students")
    .select("id, university")
    .eq("user_id", user.id)
    .maybeSingle();

  const studentUniversity = studentRow?.university || "their university";
  const studentId = studentRow?.id ?? null;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://readmystudent.com";

  // ── Look up professor in faculty table via auth.users ────────────────────
  // The faculty table has no email/name columns — those live in auth.users
  // metadata. We find the auth user by email, then confirm they have a faculty
  // row by user_id.
  type FacultyLookup = {
    id: string;
    first_name: string | null;
    email: string | null;
  };
  let facultyRow: FacultyLookup | null = null;

  const { data: authUserList } = await supabaseAdmin.auth.admin.listUsers({
    perPage: 1000,
  });
  const matchedAuthUser = authUserList?.users?.find(
    (u) =>
      u.email?.toLowerCase() === payload.professorEmail.trim().toLowerCase(),
  );
  if (matchedAuthUser) {
    const { data: facultyByUserId } = await supabaseAdmin
      .from("faculty")
      .select("id")
      .eq("user_id", matchedAuthUser.id)
      .maybeSingle();
    if (facultyByUserId) {
      facultyRow = {
        id: facultyByUserId.id as string,
        first_name:
          (matchedAuthUser.user_metadata?.firstName as string | null) ?? null,
        email: matchedAuthUser.email ?? null,
      };
    }
  }

  // ── Case A: Professor is a registered faculty member ─────────────────────
  if (facultyRow) {
    if (!studentId) {
      return {
        status: "error",
        error:
          "Your student profile could not be found. Please contact support.",
      };
    }

    const { data: requestRow, error: insertError } = await supabaseAdmin
      .from("letter_requests")
      .insert({
        student_id: studentId,
        faculty_id: facultyRow.id,
        professor_email: payload.professorEmail.trim(),
        course_context: payload.courseContext || null,
        student_note: payload.studentNote || null,
        status: "requested",
      })
      .select("id")
      .single();

    if (insertError || !requestRow) {
      return {
        status: "error",
        error: insertError?.message ?? "Failed to create request.",
      };
    }

    const { error: emailError } = await resend.emails.send({
      from: "ReadMyStudent <notification@readmystudent.com>",
      to: facultyRow.email ?? payload.professorEmail,
      subject: `${studentFullName} has requested a letter of recommendation`,
      html: RequestNotificationEmail({
        facultyFirstName: facultyRow.first_name ?? "Professor",
        studentFullName,
        studentUniversity,
        courseContext: payload.courseContext,
        studentNote: payload.studentNote,
        dashboardUrl: `${siteUrl}/dashboard`,
      }),
    });

    if (emailError) {
      // Request was created — roll it back then surface the error
      await supabaseAdmin
        .from("letter_requests")
        .delete()
        .eq("id", requestRow.id);
      return { status: "error", error: `Email failed: ${emailError.message}` };
    }

    return { status: "requested", requestId: requestRow.id as string };
  }

  // ── Case B: Professor not registered — insert request row then invite ──────
  if (!studentId) {
    return {
      status: "error",
      error: "Your student profile could not be found. Please contact support.",
    };
  }

  const { data: inviteRequestRow, error: inviteInsertError } =
    await supabaseAdmin
      .from("letter_requests")
      .insert({
        student_id: studentId,
        faculty_id: null,
        professor_email: payload.professorEmail.trim(),
        course_context: payload.courseContext || null,
        student_note: payload.studentNote || null,
        status: "invited",
      })
      .select("id")
      .single();

  if (inviteInsertError || !inviteRequestRow) {
    return {
      status: "error",
      error: inviteInsertError?.message ?? "Failed to create request.",
    };
  }

  const { error: inviteError } = await resend.emails.send({
    from: "ReadMyStudent <notification@readmystudent.com>",
    to: payload.professorEmail.trim(),
    subject: `${studentFullName} needs your recommendation — it only takes 2 minutes`,
    html: FacultyInvitationEmail({
      studentFullName,
      studentUniversity,
      courseContext: payload.courseContext,
      studentNote: payload.studentNote,
      signupUrl: `${siteUrl}/signup?role=FACULTY`,
    }),
  });

  if (inviteError) {
    // Roll back the inserted row
    await supabaseAdmin
      .from("letter_requests")
      .delete()
      .eq("id", inviteRequestRow.id);
    return { status: "error", error: `Email failed: ${inviteError.message}` };
  }

  return { status: "invited", requestId: inviteRequestRow.id as string };
}

// ─── Student dashboard queries ────────────────────────────────────────────────

export type FinishedLetter = {
  letterId: string;
  requestId: string;
  facultyName: string;
  finalizedAt: string;
  studentPreviewEnabled: boolean;
};

export type PendingRequest = {
  requestId: string;
  facultyEmail: string;
  createdAt: string;
  status: string;
};

/**
 * Returns finalized (non-draft) letters that belong to the current student.
 */
export async function getFinishedLetters(): Promise<FinishedLetter[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!studentRow) return [];

  const { data, error } = await supabase
    .from("letters")
    .select(
      "id, request_id, finalized_at, student_preview_enabled, recommender_snapshot",
    )
    .eq("student_id", studentRow.id)
    .eq("is_draft", false)
    .order("finalized_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => {
    const snapshot = row.recommender_snapshot as {
      firstName?: string;
      lastName?: string;
    } | null;
    const facultyName =
      [snapshot?.firstName, snapshot?.lastName].filter(Boolean).join(" ") ||
      "Professor";
    return {
      letterId: row.id as string,
      requestId: row.request_id as string,
      facultyName,
      finalizedAt: row.finalized_at as string,
      studentPreviewEnabled: (row.student_preview_enabled as boolean) ?? false,
    };
  });
}

/**
 * Returns letter requests that are still pending (no finalized letter yet).
 */
export async function getPendingRequests(): Promise<PendingRequest[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!studentRow) return [];

  const { data, error } = await supabase
    .from("letter_requests")
    .select("id, status, created_at, professor_email")
    .eq("student_id", studentRow.id)
    .in("status", ["requested", "in_progress", "invited", "rejected"])
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    requestId: row.id as string,
    facultyEmail: (row.professor_email as string | null) ?? "Unknown",
    createdAt: row.created_at as string,
    status: row.status as string,
  }));
}

// ─── Faculty delivery-approval queries ────────────────────────────────────────

export type PendingDelivery = {
  deliveryLinkId: string;
  letterId: string;
  studentFullName: string;
  schoolName: string;
  paidAt: string;
};

// ─── Reject letter request ───────────────────────────────────────────────────

/**
 * Faculty declines to write a recommendation for a student.
 * Updates the request status to 'rejected' and emails the student.
 */
export async function rejectLetterRequest(
  requestId: string,
  reason?: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Verify faculty owns this request
  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return { error: "Faculty record not found." };

  const { data: requestRow, error: fetchError } = await supabaseAdmin
    .from("letter_requests")
    .select("id, student_id, status")
    .eq("id", requestId)
    .eq("faculty_id", facultyRow.id)
    .maybeSingle();

  if (fetchError || !requestRow)
    return { error: "Request not found or access denied." };
  if (requestRow.status !== "requested")
    return { error: "Request is no longer in a rejectable state." };

  const { error: updateError } = await supabaseAdmin
    .from("letter_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);
  if (updateError) return { error: updateError.message };

  // Resolve student email and name from auth
  const { data: studentRow } = await supabaseAdmin
    .from("students")
    .select("user_id")
    .eq("id", requestRow.student_id as string)
    .maybeSingle();

  if (studentRow?.user_id) {
    const { data: studentAuth } = await supabaseAdmin.auth.admin.getUserById(
      studentRow.user_id as string,
    );
    const studentUser = studentAuth?.user;
    if (studentUser?.email) {
      const smeta = studentUser.user_metadata ?? {};
      const studentFirstName = (smeta.firstName as string | null) ?? "there";

      const fmeta = user.user_metadata ?? {};
      const facultyName =
        [fmeta.firstName, fmeta.lastName].filter(Boolean).join(" ") ||
        user.email ||
        "Your professor";

      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://readmystudent.com";

      await resend.emails.send({
        from: "ReadMyStudent <notification@readmystudent.com>",
        to: studentUser.email,
        subject: `${facultyName} has declined your recommendation request`,
        html: RequestRejectionEmail({
          studentFirstName,
          facultyName,
          reason: reason?.trim() || undefined,
          supportUrl: `${siteUrl}/contact`,
        }),
      });
    }
  }

  return { error: null };
}

// ─── Faculty incoming requests ────────────────────────────────────────────────

export type FacultyLetterRequest = {
  requestId: string;
  studentName: string;
  courseContext: string | null;
  studentNote: string | null;
  createdAt: string;
};

/**
 * Returns letter_requests rows assigned to the current faculty member that
 * still need a letter written (status = 'requested').
 */
export async function getFacultyRequests(): Promise<FacultyLetterRequest[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return [];

  const { data, error } = await supabaseAdmin
    .from("letter_requests")
    .select("id, student_id, course_context, student_note, created_at")
    .eq("faculty_id", facultyRow.id)
    .eq("status", "requested")
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Resolve student names via auth.users (names live in user_metadata)
  const results: FacultyLetterRequest[] = [];
  for (const row of data) {
    const { data: studentRow } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq("id", row.student_id as string)
      .maybeSingle();

    let studentName = "Unknown Student";
    if (studentRow?.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        studentRow.user_id as string,
      );
      if (authUser?.user) {
        const meta = authUser.user.user_metadata ?? {};
        studentName =
          [meta.firstName, meta.lastName].filter(Boolean).join(" ") ||
          authUser.user.email ||
          "Unknown Student";
      }
    }

    results.push({
      requestId: row.id as string,
      studentName,
      courseContext: (row.course_context as string | null) ?? null,
      studentNote: (row.student_note as string | null) ?? null,
      createdAt: row.created_at as string,
    });
  }

  return results;
}

// ─── Faculty finalized letters list ───────────────────────────────────────────

export type FacultyFinalizedLetter = {
  letterId: string;
  studentName: string;
  finalizedAt: string;
  studentPreviewEnabled: boolean;
};

/**
 * Returns all finalized (non-draft) letters belonging to the current faculty.
 */
export async function getFacultyFinalizedLetters(): Promise<
  FacultyFinalizedLetter[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return [];

  const { data, error } = await supabaseAdmin
    .from("letters")
    .select("id, student_id, finalized_at, student_preview_enabled")
    .eq("faculty_id", facultyRow.id)
    .eq("is_draft", false)
    .order("finalized_at", { ascending: false });

  if (error || !data) return [];

  const results: FacultyFinalizedLetter[] = [];
  for (const row of data) {
    const { data: studentRow } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq("id", row.student_id as string)
      .maybeSingle();

    let studentName = "Unknown Student";
    if (studentRow?.user_id) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
        studentRow.user_id as string,
      );
      if (authUser?.user) {
        const meta = authUser.user.user_metadata ?? {};
        studentName =
          [meta.firstName, meta.lastName].filter(Boolean).join(" ") ||
          authUser.user.email ||
          "Unknown Student";
      }
    }

    results.push({
      letterId: row.id as string,
      studentName,
      finalizedAt: row.finalized_at as string,
      studentPreviewEnabled: (row.student_preview_enabled as boolean) ?? false,
    });
  }

  return results;
}

/**
 * Returns delivery_links that are awaiting faculty approval for the current
 * faculty member. Uses the admin client + explicit faculty_id guard so this
 * works regardless of the RLS policy on delivery_links.
 *
 * Required delivery_links columns (run in Supabase SQL editor if missing):
 *   ALTER TABLE delivery_links ADD COLUMN IF NOT EXISTS school_name text;
 *   ALTER TABLE delivery_links ADD COLUMN IF NOT EXISTS student_user_id uuid;
 */
export async function getPendingDeliveries(): Promise<PendingDelivery[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Resolve faculty row for this user
  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return [];

  // delivery_links → letters (to enforce faculty ownership)
  const { data, error } = await supabaseAdmin
    .from("delivery_links")
    .select(
      "id, letter_id, school_name, student_user_id, created_at, letters!inner(faculty_id)",
    )
    .eq("payment_status", "pending")
    .eq("letters.faculty_id", facultyRow.id)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  // Fetch student display names from Auth metadata in a single batch
  const results: PendingDelivery[] = [];
  for (const row of data) {
    const studentUserId = row.student_user_id as string | null;
    let studentFullName = "Student";
    if (studentUserId) {
      const { data: authUser } =
        await supabaseAdmin.auth.admin.getUserById(studentUserId);
      const meta = authUser?.user?.user_metadata ?? {};
      studentFullName =
        [meta.firstName, meta.lastName].filter(Boolean).join(" ") || "Student";
    }
    results.push({
      deliveryLinkId: row.id as string,
      letterId: row.letter_id as string,
      studentFullName,
      schoolName: (row.school_name as string | null) ?? "Unknown school",
      paidAt: row.created_at as string,
    });
  }
  return results;
}

/**
 * Faculty approves a pending delivery.
 * Sets payment_status = 'paid' and starts the 48-hour expiry window NOW.
 */
export async function approveDelivery(
  deliveryLinkId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return { error: "Faculty record not found." };

  // Verify the delivery_link belongs to a letter authored by this faculty
  const { data: link } = await supabaseAdmin
    .from("delivery_links")
    .select(
      "id, payment_status, school_name, student_user_id, stripe_checkout_session_id, letters!inner(faculty_id)",
    )
    .eq("id", deliveryLinkId)
    .eq("letters.faculty_id", facultyRow.id)
    .maybeSingle();

  if (!link) return { error: "Delivery not found or access denied." };
  if ((link.payment_status as string) !== "pending")
    return { error: "This delivery is not awaiting approval." };

  // Generate the delivery token now — this is the moment the link becomes live.
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from("delivery_links")
    .update({
      payment_status: "paid",
      expires_at: expiresAt,
      token_hash: tokenHash,
    })
    .eq("id", deliveryLinkId);

  if (updateError) return { error: updateError.message };

  const fullLink = link as unknown as {
    school_name: string | null;
    student_user_id: string | null;
    stripe_checkout_session_id: string | null;
  };

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://readmystudent.com";
  const viewUrl = `${siteUrl}/view/${rawToken}`;

  // Look up student name for the email subject line.
  let studentFullName = "Applicant";
  if (fullLink.student_user_id) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      fullLink.student_user_id,
    );
    const meta = authUser?.user?.user_metadata ?? {};
    studentFullName =
      [meta.firstName, meta.lastName].filter(Boolean).join(" ") || "Applicant";
  }

  // Retrieve the school email from Stripe session metadata — never stored in DB
  let recipientEmail: string | null = null;
  if (fullLink.stripe_checkout_session_id) {
    try {
      const session = await stripe.checkout.sessions.retrieve(
        fullLink.stripe_checkout_session_id,
      );
      recipientEmail = session.metadata?.school_email ?? null;
    } catch (err) {
      console.error(
        "[approveDelivery] Failed to retrieve Stripe session:",
        err,
      );
    }
  }

  if (recipientEmail) {
    const { error: emailError } = await resend.emails.send({
      from: "ReadMyStudent <notification@readmystudent.com>",
      to: recipientEmail,
      subject: `Recommendation letter available for ${studentFullName}`,
      html: InstitutionDeliveryEmail({
        schoolName: fullLink.school_name ?? "your institution",
        studentFullName,
        viewUrl,
        expiresAt,
      }),
    });
    if (emailError) {
      console.error("[approveDelivery] Resend failed:", emailError);
      return { error: `Delivery approved but email failed: ${emailError.message}` };
    }
  } else {
    console.error("[approveDelivery] No recipient email found for delivery link", deliveryLinkId);
    return { error: "Delivery approved but could not retrieve the institution email from Stripe." };
  }

  return { error: null };
}

/**
 * Faculty rejects a pending delivery.
 * Sets payment_status = 'rejected'; student will need to request a refund.
 */
export async function rejectDelivery(
  deliveryLinkId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return { error: "Faculty record not found." };

  const { data: link } = await supabaseAdmin
    .from("delivery_links")
    .select(
      "id, payment_status, school_name, student_user_id, letters!inner(faculty_id)",
    )
    .eq("id", deliveryLinkId)
    .eq("letters.faculty_id", facultyRow.id)
    .maybeSingle();

  if (!link) return { error: "Delivery not found or access denied." };
  if ((link.payment_status as string) !== "pending")
    return { error: "This delivery is not awaiting approval." };

  const { error: updateError } = await supabaseAdmin
    .from("delivery_links")
    .update({ payment_status: "rejected" })
    .eq("id", deliveryLinkId);

  if (updateError) return { error: updateError.message };

  // Email the student to let them know the delivery was rejected.
  const rejLink = link as unknown as {
    school_name: string | null;
    student_user_id: string | null;
  };

  if (rejLink.student_user_id) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(
      rejLink.student_user_id,
    );
    const studentEmail = authUser?.user?.email;
    const meta = authUser?.user?.user_metadata ?? {};
    const studentFirstName = (meta.firstName as string | undefined) ?? "there";
    const facultyName =
      [facultyRow.first_name, facultyRow.last_name].filter(Boolean).join(" ") ||
      "Your professor";

    if (studentEmail) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://readmystudent.com";
      await resend.emails.send({
        from: "ReadMyStudent <notification@readmystudent.com>",
        to: studentEmail,
        subject: `Your delivery request to ${rejLink.school_name ?? "the institution"} was declined`,
        html: StudentRejectionEmail({
          studentFirstName,
          facultyName,
          schoolName: rejLink.school_name ?? "the institution",
          supportUrl: `${siteUrl}/contact`,
        }),
      });
    }
  }

  return { error: null };
}

// ─── Student preview toggle (faculty action) ──────────────────────────────────

/**
 * Faculty toggles whether the student can see a watermarked preview of their
 * finalized (or draft) letter in the student dashboard.
 */
export async function setStudentPreviewEnabled(
  letterId: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: facultyRow } = await supabaseAdmin
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!facultyRow) return { error: "Faculty record not found." };

  const { error } = await supabaseAdmin
    .from("letters")
    .update({ student_preview_enabled: enabled })
    .eq("id", letterId)
    .eq("faculty_id", facultyRow.id);

  return { error: error?.message ?? null };
}

// ─── Student letter preview (student action) ──────────────────────────────────

/**
 * Returns the HTML content (and asset signed URLs) of a finalized letter for a
 * student preview. Returns null if:
 *   - the user is not authenticated
 *   - the letter does not belong to the student
 *   - the letter is still a draft
 *   - student_preview_enabled is false
 */
export async function getStudentLetterPreview(
  letterId: string,
): Promise<StudentLetterPreview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!studentRow) return null;

  const { data: letter } = await supabaseAdmin
    .from("letters")
    .select(
      "student_id, is_draft, student_preview_enabled, letter_body_html, recommender_snapshot, letterhead_logo_storage_path, signature_image_storage_path, finalized_at",
    )
    .eq("id", letterId)
    .maybeSingle();

  if (!letter) return null;
  if ((letter.student_id as string) !== studentRow.id) return null;
  if (letter.is_draft === true) return null;
  if (!letter.student_preview_enabled) return null;

  // Signature and logo assets are intentionally withheld from student previews
  // to protect the professor's signature from being extracted. The preview
  // renders a "Signature on file" placeholder instead.
  return {
    html: letter.letter_body_html as string | null,
    recommenderSnapshot: letter.recommender_snapshot as RecommenderForm | null,
    logoSignedUrl: null,
    signatureSignedUrl: null,
    finalizedAt: letter.finalized_at as string | null,
  };
}
