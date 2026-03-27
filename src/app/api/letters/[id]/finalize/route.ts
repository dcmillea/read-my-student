/**
 * POST /api/letters/[id]/finalize
 *
 * Finalizes a letter draft by:
 *   1. Rendering the stored data into a canonical PDF via @react-pdf/renderer.
 *   2. Computing a SHA-256 hash of the PDF bytes.
 *   3. Generating an HMAC-SHA256 signature over that hash using PDF_SIGNING_SECRET.
 *   4. Uploading the PDF to the `letters` Supabase Storage bucket.
 *   5. Marking the letter row as finalized (is_draft=false, storage_path, timestamps).
 *   6. Inserting a row into letter_signatures with hash + HMAC metadata.
 *
 * Required env vars:
 *   PDF_SIGNING_SECRET  — arbitrary ≥32-char secret; rotate to invalidate old signatures.
 *
 * Required Supabase Storage bucket:
 *   letters  — private bucket; service-role client is used for upload.
 */

import { createHash, createHmac } from "crypto";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { DocumentProps } from "@react-pdf/renderer";
import type { RecommenderForm } from "@/lib/faculty-profile";
import { LetterDocument } from "@/lib/pdf/letter-template";

// ─── Admin client (bypasses RLS for PDF upload + finalization writes) ─────────

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── Helper: fetch an asset from a faculty Storage bucket and return a data URI

async function fetchAssetAsDataUri(
  bucket: string,
  storagePath: string,
): Promise<string | null> {
  // Generate a short-lived signed URL via the admin client
  const { data, error } = await adminSupabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 120); // 2-minute window — enough for one PDF render

  if (error || !data?.signedUrl) return null;

  try {
    const res = await fetch(data.signedUrl);
    if (!res.ok) return null;

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    const mime = res.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: letterId } = await params;
  const body = await req.json().catch(() => ({})) as { requestId?: string; regenerate?: boolean };

  // ── 1. Authenticate ──────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Verify faculty ownership ──────────────────────────────────────────────
  const { data: facultyRow } = await supabase
    .from("faculty")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!facultyRow) {
    return NextResponse.json(
      { error: "No faculty record for this user." },
      { status: 403 },
    );
  }

  // ── 3. Load the draft letter (RLS ensures faculty_id matches) ────────────────
  const { data: letter, error: letterError } = await supabase
    .from("letters")
    .select(
      "id, faculty_id, is_draft, recommender_snapshot, letter_plain_text, letterhead_logo_storage_path, signature_image_storage_path",
    )
    .eq("id", letterId)
    .eq("faculty_id", facultyRow.id)
    .maybeSingle();

  if (letterError || !letter) {
    return NextResponse.json(
      { error: "Letter not found or access denied." },
      { status: 404 },
    );
  }

  if (!letter.is_draft) {
    // Allow regeneration only if no active delivery links exist (not yet delivered)
    if (!body.regenerate) {
      return NextResponse.json(
        { error: "Letter is already finalized." },
        { status: 409 },
      );
    }
    const { count } = await adminSupabase
      .from("delivery_links")
      .select("id", { count: "exact", head: true })
      .eq("letter_id", letterId)
      .in("payment_status", ["pending", "paid", "used"]);
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot regenerate PDF: letter has already been delivered." },
        { status: 409 },
      );
    }
  }

  // ── 4. Fetch images as base64 data URIs ──────────────────────────────────────
  const [logoDataUri, signatureDataUri] = await Promise.all([
    letter.letterhead_logo_storage_path
      ? fetchAssetAsDataUri(
          "faculty-logos",
          letter.letterhead_logo_storage_path as string,
        )
      : Promise.resolve(null),
    letter.signature_image_storage_path
      ? fetchAssetAsDataUri(
          "faculty-signatures",
          letter.signature_image_storage_path as string,
        )
      : Promise.resolve(null),
  ]);

  // ── 5. Render PDF ─────────────────────────────────────────────────────────────
  const recommender = (letter.recommender_snapshot ??
    {}) as Partial<RecommenderForm>;
  const letterBody = (letter.letter_plain_text as string | null) ?? "";
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(
      React.createElement(LetterDocument, {
        recommender,
        letterBody,
        logoDataUri,
        signatureDataUri,
        date,
      }) as unknown as React.ReactElement<DocumentProps>,
    );
  } catch (renderErr) {
    console.error("[finalize] PDF render error:", renderErr);
    return NextResponse.json(
      { error: "PDF rendering failed." },
      { status: 500 },
    );
  }

  // ── 6. Hash PDF bytes (SHA-256) ───────────────────────────────────────────────
  const pdfSha256 = createHash("sha256").update(pdfBuffer).digest("hex");

  // ── 7. HMAC-SHA256 sign the hash ──────────────────────────────────────────────
  const signingSecret = process.env.PDF_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("[finalize] PDF_SIGNING_SECRET env var is not set.");
    return NextResponse.json(
      { error: "Server misconfiguration: signing secret absent." },
      { status: 500 },
    );
  }
  const hmacSignature = createHmac("sha256", signingSecret)
    .update(pdfSha256)
    .digest("hex");

  // ── 8. Upload PDF to Supabase Storage (`letters` bucket) ─────────────────────
  const pdfStoragePath = `${facultyRow.id as string}/${letterId}.pdf`;

  const { error: uploadError } = await adminSupabase.storage
    .from("letters")
    .upload(pdfStoragePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    console.error("[finalize] Storage upload error:", uploadError);
    return NextResponse.json(
      { error: `PDF upload failed: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // ── 9. Mark letter as finalized ───────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent") ?? null;
  const finalizedAt = new Date().toISOString();

  // expires_at = finalized_at + 1 year (retention policy)
  const expiresAt = new Date(
    new Date(finalizedAt).getTime() + 365 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: updateError } = await adminSupabase
    .from("letters")
    .update({
      is_draft: false,
      status: "final",
      storage_path: pdfStoragePath,
      finalized_at: finalizedAt,
      expires_at: expiresAt,
      finalized_ip: ip,
      finalized_user_agent: userAgent,
      updated_at: finalizedAt,
    })
    .eq("id", letterId);

  if (updateError) {
    console.error("[finalize] Letter update error:", updateError);
    return NextResponse.json(
      { error: `Failed to update letter: ${updateError.message}` },
      { status: 500 },
    );
  }

  // ── 10. Insert letter_signatures row (delete stale row first on regeneration) ──
  if (body.regenerate) {
    await adminSupabase
      .from("letter_signatures")
      .delete()
      .eq("letter_id", letterId);
  }
  const { error: sigError } = await adminSupabase
    .from("letter_signatures")
    .insert({
      letter_id: letterId,
      pdf_sha256: pdfSha256,
      signature: hmacSignature,
      signature_alg: "hmac-sha256",
      signed_at: finalizedAt,
      signing_key_id: "hmac-sha256-v1",
    });

  if (sigError) {
    // PDF is already uploaded and letter marked finalized — log but don't roll back.
    console.error("[finalize] Signature insert error:", sigError);
  }

  // ── 11. Advance letter_requests status so student can proceed to payment ─────
  if (body.requestId) {
    await adminSupabase
      .from("letter_requests")
      .update({ status: "in_progress" })
      .eq("id", body.requestId);
  }

  // ── 12. Respond ───────────────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    pdfStoragePath,
    pdfSha256,
  });
}
