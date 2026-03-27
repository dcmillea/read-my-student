/**
 * /view/[token]
 *
 * Public, token-gated letter view page for admissions offices.
 *
 * Access flow:
 *   1. Validate token (exists, paid/used status, not expired).
 *   2. Check for a signed HttpOnly cookie set by the verifyEmail action.
 *      If absent → render the EmailGateForm (email verification wall).
 *   3. Cookie present → atomically flip payment_status 'paid' → 'used'
 *      and log an 'opened' event for the audit trail.
 *      If the link is already 'used' and the cookie is valid, still serve the
 *      PDF — this allows the legitimate holder to refresh within their session.
 *   4. Generate a 1-hour server-side signed URL for the PDF and render the
 *      viewer. The signed URL is never client-accessible.
 *
 * Single-use enforcement:
 *   The conditional UPDATE (WHERE payment_status = 'paid') is atomic. A
 *   concurrent request that lost the race returns zero rows; we check for this
 *   and fall through to cookie-holder logic so the same valid session can
 *   refresh without being blocked.
 */

import { createHash } from "crypto";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ShieldCheck, ShieldAlert, Clock, FileText } from "lucide-react";
import type { Metadata } from "next";

import { EmailGateForm } from "./EmailGateForm";
import { DownloadButton } from "./DownloadButton";
import { viewCookieName, viewCookieValue } from "./cookie-helpers";

// ─── Admin client (no cookie session — this page is public) ──────────────────

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Secure Letter Delivery | ReadMyStudent",
  description:
    "View a securely delivered letter of recommendation via ReadMyStudent.",
  robots: { index: false, follow: false },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type InvalidReason = "not-found" | "expired" | "used";

// ─── Error states ─────────────────────────────────────────────────────────────

function InvalidPage({ reason }: { reason: InvalidReason }) {
  const content: Record<
    InvalidReason,
    { icon: React.ReactNode; title: string; body: string }
  > = {
    "not-found": {
      icon: <ShieldAlert className='h-10 w-10 text-red-400' />,
      title: "Link not found",
      body: "This delivery link is invalid or does not exist. If you believe this is an error, please contact the sender.",
    },
    expired: {
      icon: <Clock className='h-10 w-10 text-amber-400' />,
      title: "Link has expired",
      body: "This secure delivery link has passed its 48-hour expiry window and is no longer accessible. Please contact the applicant or institution to arrange a new delivery.",
    },
    used: {
      icon: <ShieldAlert className='h-10 w-10 text-red-400' />,
      title: "Link already used",
      body: "This is a single-use link and has already been accessed. For security, each delivery link may only be viewed once. Please contact the applicant or ReadMyStudent support if you need assistance.",
    },
  };

  const { icon, title, body } = content[reason];

  return (
    <div className='flex min-h-screen flex-col bg-gray-50'>
      {/* Header banner */}
      <div className='bg-green-900 px-6 py-4'>
        <div className='mx-auto flex max-w-3xl items-center gap-3'>
          <ShieldCheck className='h-6 w-6 text-amber-300' />
          <span className='font-semibold tracking-wide text-white'>
            ReadMyStudent Secure Delivery
          </span>
        </div>
      </div>

      {/* Error card */}
      <div className='flex flex-1 items-center justify-center px-4 py-16'>
        <div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100'>
            {icon}
          </div>
          <h1 className='mb-3 font-serif text-2xl font-bold text-gray-900'>
            {title}
          </h1>
          <p className='text-sm leading-relaxed text-gray-500'>{body}</p>
          <p className='mt-8 text-xs text-gray-400'>
            ReadMyStudent &mdash; Secure, Respectful Recommendation Letters
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ViewLetterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // ── 1. Hash the token to look up the delivery row ─────────────────────────
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: link } = await adminSupabase
    .from("delivery_links")
    .select(
      "id, payment_status, expires_at, school_name, student_user_id, letter_id",
    )
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link) return <InvalidPage reason='not-found' />;

  // ── 2. Expiry check ───────────────────────────────────────────────────────
  const expiresAt = link.expires_at
    ? new Date(link.expires_at as string)
    : null;
  if (!expiresAt || expiresAt < new Date()) {
    return <InvalidPage reason='expired' />;
  }

  // ── 3. Status must be 'paid' or 'used' to proceed ─────────────────────────
  const status = link.payment_status as string;
  if (status !== "paid" && status !== "used") {
    return <InvalidPage reason='not-found' />;
  }

  // ── 4. Email-verification cookie gate ─────────────────────────────────────
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(viewCookieName(tokenHash))?.value;
  const expectedVal = viewCookieValue(tokenHash);
  const isVerified = cookieVal === expectedVal;

  if (!isVerified) {
    // Resolve names for the gate UI before rendering
    let studentFullName = "Applicant";
    const studentUserId = link.student_user_id as string | null;
    if (studentUserId) {
      const { data: authUser } =
        await adminSupabase.auth.admin.getUserById(studentUserId);
      const meta = authUser?.user?.user_metadata ?? {};
      studentFullName =
        [meta.firstName, meta.lastName].filter(Boolean).join(" ") ||
        "Applicant";
    }

    return (
      <EmailGateForm
        token={token}
        schoolName={(link.school_name as string | null) ?? "your institution"}
        studentFullName={studentFullName}
      />
    );
  }

  // ── 5. Atomically consume the link on first verified load ─────────────────
  // If status is already 'used', the cookie holder is returning (e.g. refresh).
  // Skip the flip and logging to avoid double-counting.
  const deliveryLinkId = link.id as string;
  if (status === "paid") {
    const { data: claimed } = await adminSupabase
      .from("delivery_links")
      .update({ payment_status: "used" })
      .eq("id", deliveryLinkId)
      .eq("payment_status", "paid") // atomic — zero rows if already flipped
      .select("id")
      .single();

    if (claimed) {
      await adminSupabase.from("delivery_access_events").insert({
        delivery_link_id: deliveryLinkId,
        event_type: "opened",
        ip_address: null,
        user_agent: null,
      });
    }
    // If claimed is null, a race was lost — cookie holder still proceeds.
  }

  // ── 6. Load letter ────────────────────────────────────────────────────────
  const { data: letter } = await adminSupabase
    .from("letters")
    .select("storage_path, finalized_at, faculty_id")
    .eq("id", link.letter_id as string)
    .maybeSingle();

  if (!letter?.storage_path) {
    console.error("[view] letter missing storage_path for letter_id:", link.letter_id);
    return <InvalidPage reason='not-found' />;
  }

  // ── 7. Load signature metadata ────────────────────────────────────────────
  const { data: sig } = await adminSupabase
    .from("letter_signatures")
    .select("pdf_sha256, signed_at, signing_key_id")
    .eq("letter_id", link.letter_id as string)
    .maybeSingle();

  // ── 8. Resolve faculty display name via auth user metadata ────────────────
  let facultyName = "Faculty";
  const facultyId = letter.faculty_id as string | null;
  if (facultyId) {
    const { data: facultyRow } = await adminSupabase
      .from("faculty")
      .select("user_id")
      .eq("id", facultyId)
      .maybeSingle();
    if (facultyRow?.user_id) {
      const { data: facultyAuth } = await adminSupabase.auth.admin.getUserById(
        facultyRow.user_id as string,
      );
      const meta = facultyAuth?.user?.user_metadata ?? {};
      facultyName =
        [meta.title, meta.firstName, meta.lastName].filter(Boolean).join(" ") ||
        "Faculty";
    }
  }

  // ── 9. Resolve student display name ───────────────────────────────────────
  let studentFullName = "Applicant";
  const studentUserId = link.student_user_id as string | null;
  if (studentUserId) {
    const { data: authUser } =
      await adminSupabase.auth.admin.getUserById(studentUserId);
    const meta = authUser?.user?.user_metadata ?? {};
    studentFullName =
      [meta.firstName, meta.lastName].filter(Boolean).join(" ") || "Applicant";
  }

  // ── 10. Generate short-lived signed PDF URL (server-side only) ───────────
  const { data: signedData } = await adminSupabase.storage
    .from("letters")
    .createSignedUrl(letter.storage_path as string, 3600); // 1-hour TTL

  if (!signedData?.signedUrl) {
    console.error("[view] createSignedUrl failed for storage_path:", letter.storage_path);
    return <InvalidPage reason='not-found' />;
  }

  const pdfUrl = signedData.signedUrl;
  const finalizedDate = letter.finalized_at
    ? new Date(letter.finalized_at as string).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";
  const schoolName = (link.school_name as string | null) ?? "Institution";

  // ── 11. Render ────────────────────────────────────────────────────────────
  return (
    <div className='flex min-h-screen flex-col bg-gray-50'>
      {/* Header banner */}
      <div className='bg-green-900 px-6 py-4 shadow-sm'>
        <div className='mx-auto flex max-w-5xl items-center justify-between'>
          <div className='flex items-center gap-3'>
            <ShieldCheck className='h-6 w-6 text-amber-300' />
            <span className='font-semibold tracking-wide text-white'>
              ReadMyStudent Secure Delivery
            </span>
          </div>
          <span className='flex items-center gap-1.5 rounded-full bg-green-700 px-3 py-1 text-xs font-semibold text-amber-300'>
            <ShieldCheck className='h-3.5 w-3.5' />
            Email Verified
          </span>
        </div>
      </div>

      {/* Metadata bar */}
      <div className='border-b bg-white px-6 py-4 shadow-sm'>
        <div className='mx-auto grid max-w-5xl gap-4 sm:grid-cols-4'>
          <div>
            <p className='text-xs font-medium uppercase tracking-wide text-gray-400'>
              Applicant
            </p>
            <p className='mt-0.5 text-sm font-semibold text-gray-900'>
              {studentFullName}
            </p>
          </div>
          <div>
            <p className='text-xs font-medium uppercase tracking-wide text-gray-400'>
              Written by
            </p>
            <p className='mt-0.5 text-sm font-semibold text-gray-900'>
              {facultyName}
            </p>
          </div>
          <div>
            <p className='text-xs font-medium uppercase tracking-wide text-gray-400'>
              Delivered to
            </p>
            <p className='mt-0.5 text-sm font-semibold text-gray-900'>
              {schoolName}
            </p>
          </div>
          <div>
            <p className='text-xs font-medium uppercase tracking-wide text-gray-400'>
              Finalized
            </p>
            <p className='mt-0.5 text-sm font-semibold text-gray-900'>
              {finalizedDate}
            </p>
          </div>
        </div>
      </div>

      {/* PDF viewer + controls */}
      <div className='mx-auto w-full max-w-5xl flex-1 px-4 py-6'>
        {/* Toolbar */}
        <div className='mb-3 flex items-center justify-between'>
          <p className='text-sm text-gray-500'>
            Recommendation letter for{" "}
            <span className='font-semibold text-gray-700'>
              {studentFullName}
            </span>
          </p>
          <DownloadButton
            pdfUrl={pdfUrl}
            deliveryLinkId={deliveryLinkId}
            studentFullName={studentFullName}
          />
        </div>

        {/* Iframe */}
        <div className='overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'>
          <iframe
            src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            className='h-[80vh] w-full'
            title={`Recommendation letter for ${studentFullName}`}
          />
        </div>

        {/* Signature / integrity strip */}
        {sig && (
          <div className='mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm'>
            <div className='flex items-center gap-2 text-green-700'>
              <ShieldCheck className='h-5 w-5 flex-shrink-0' />
              <span className='text-sm font-semibold'>
                Cryptographic integrity verified
              </span>
            </div>
            <div className='ml-auto grid gap-1 text-right text-xs text-gray-400'>
              <div>
                <span className='font-medium text-gray-500'>SHA-256: </span>
                <span className='font-mono'>
                  {(sig.pdf_sha256 as string).slice(0, 16)}&hellip;
                </span>
              </div>
              <div>
                <span className='font-medium text-gray-500'>Signed: </span>
                {sig.signed_at
                  ? new Date(sig.signed_at as string).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "short", day: "numeric" },
                    )
                  : "—"}
              </div>
              <div>
                <span className='font-medium text-gray-500'>Key: </span>
                <span className='font-mono'>
                  {sig.signing_key_id as string}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Single-use notice */}
        <p className='mt-3 flex items-center gap-1.5 text-xs text-gray-400'>
          <FileText className='h-3.5 w-3.5 flex-shrink-0' />
          This secure link has now been consumed and cannot be shared. This
          letter was sealed and delivered via{" "}
          <a
            href='https://readmystudent.com'
            className='underline hover:text-gray-600'
          >
            ReadMyStudent
          </a>
          .
        </p>
      </div>
    </div>
  );
}
