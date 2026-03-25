"use server";

/**
 * Server actions for the /view/[token] page.
 *
 * verifyEmail  — validates the submitted email against recipient_email on the
 *                delivery_links row, sets a signed HttpOnly cookie on match,
 *                and logs an 'email_verified' access event.
 *
 * logDownload  — records a 'downloaded' event for audit purposes when the
 *                institution explicitly downloads the PDF.
 */

import { createHash } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient as createAdminClient } from "@supabase/supabase-js";

import { viewCookieName, viewCookieValue } from "./cookie-helpers";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ─── verifyEmail ──────────────────────────────────────────────────────────────

export async function verifyEmail(
  token: string,
  email: string,
): Promise<{ error: string } | never> {
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Look up the delivery link
  const { data: link, error: dbError } = await adminSupabase
    .from("delivery_links")
    .select("id, payment_status, expires_at, recipient_email_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  console.log("[verifyEmail] token:", token);
  console.log("[verifyEmail] tokenHash:", tokenHash);
  console.log("[verifyEmail] link:", link, "dbError:", dbError);

  if (!link) return { error: "This link is invalid or no longer active." };

  // Expiry
  const expiresAt = link.expires_at
    ? new Date(link.expires_at as string)
    : null;
  if (!expiresAt || expiresAt < new Date()) {
    return { error: "This link has expired." };
  }

  // Must be paid or already used (verified visitor returning)
  const status = link.payment_status as string;
  if (status !== "paid" && status !== "used") {
    return { error: "This link is invalid or no longer active." };
  }

  // Hash the submitted email and compare against the stored hash
  const submittedHash = createHash("sha256")
    .update(email.toLowerCase().trim())
    .digest("hex");
  const storedHash = (link.recipient_email_hash as string | null) ?? "";

  if (!storedHash || storedHash !== submittedHash) {
    return {
      error:
        "That email address does not match the one this letter was delivered to. Please use the admissions email exactly as it was registered.",
    };
  }

  // Set the signed proof-of-verification cookie
  const name = viewCookieName(tokenHash);
  const value = viewCookieValue(tokenHash);
  const cookieStore = await cookies();
  cookieStore.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 4 * 60 * 60, // 4 hours — enough for any admissions review session
    path: `/view/${token}`,
  });

  // Log the verification event
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const ua = headerStore.get("user-agent") ?? null;

  await adminSupabase.from("delivery_access_events").insert({
    delivery_link_id: link.id as string,
    event_type: "email_verified",
    ip_address: ip,
    user_agent: ua,
  });

  // Redirect back to the same page — now the cookie is present and the PDF
  // will be served by the server component on the next request.
  redirect(`/view/${token}`);
}

// ─── logDownload ──────────────────────────────────────────────────────────────

export async function logDownload(deliveryLinkId: string): Promise<void> {
  const headerStore = await headers();
  const ip =
    headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headerStore.get("x-real-ip") ??
    null;
  const ua = headerStore.get("user-agent") ?? null;

  await adminSupabase.from("delivery_access_events").insert({
    delivery_link_id: deliveryLinkId,
    event_type: "downloaded",
    ip_address: ip,
    user_agent: ua,
  });
}
