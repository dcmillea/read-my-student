/**
 * POST /api/letters/[id]/checkout
 *
 * Creates a Stripe Checkout Session for a $5 school delivery.
 * The student is redirected to Stripe's hosted payment page.
 * Fulfillment (token generation, professor email) happens in the webhook,
 * NOT here — the redirect back is not a reliable signal of payment.
 *
 * Body: { schoolName: string; schoolEmail: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { stripe, DELIVERY_PRICE_CENTS } from "@/lib/stripe";

const adminSupabase = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: letterId } = await params;

  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── 2. Parse + validate body ──────────────────────────────────────────────
  let schoolName: string;
  let schoolEmail: string;

  try {
    const body = (await req.json()) as {
      schoolName?: unknown;
      schoolEmail?: unknown;
    };
    if (
      typeof body.schoolName !== "string" ||
      !body.schoolName.trim() ||
      typeof body.schoolEmail !== "string" ||
      !body.schoolEmail.trim()
    ) {
      throw new Error("missing fields");
    }
    schoolName = body.schoolName.trim();
    schoolEmail = body.schoolEmail.trim().toLowerCase();
  } catch {
    return NextResponse.json(
      { error: "schoolName and schoolEmail are required." },
      { status: 400 },
    );
  }

  // ── 3. Verify the letter exists, is finalized, and belongs to this student ─
  const { data: letter } = await adminSupabase
    .from("letters")
    .select("id, student_id, faculty_id, is_draft")
    .eq("id", letterId)
    .maybeSingle();

  if (!letter) {
    return NextResponse.json({ error: "Letter not found." }, { status: 404 });
  }

  if (letter.is_draft) {
    return NextResponse.json(
      { error: "Letter has not been finalized yet." },
      { status: 409 },
    );
  }

  // Confirm the authenticated user maps to the student who owns this letter
  const { data: studentRow } = await supabase
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!studentRow || studentRow.id !== letter.student_id) {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  // ── 4. Prevent double-payment for the same school ─────────────────────────
  // Hash the school email the same way the webhook will, then check delivery_links.
  const { createHash } = await import("crypto");
  const schoolEmailHash = createHash("sha256")
    .update(schoolEmail)
    .digest("hex");

  // const { data: existingLink } = await adminSupabase
  //   .from("delivery_links")
  //   .select("id, payment_status")
  //   .eq("letter_id", letterId)
  //   .eq("recipient_email_hash", schoolEmailHash)
  //   .maybeSingle();

  // if (
  //   existingLink &&
  //   ["pending", "paid", "used"].includes(
  //     existingLink.payment_status as string,
  //   )
  // ) {
  //   return NextResponse.json(
  //     { error: "This letter has already been sent to that institution." },
  //     { status: 409 },
  //   );
  // }

  // ── 5. Create Stripe Embedded Checkout Session ────────────────────────────
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://readmystudent.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: DELIVERY_PRICE_CENTS,
          product_data: {
            name: "Secure Letter Delivery",
            description: `Send your recommendation letter to ${schoolName}`,
          },
        },
      },
    ],
    // Attach context so the webhook knows what to do after payment
    metadata: {
      letter_id: letterId,
      school_name: schoolName,
      school_email: schoolEmail,
      student_user_id: user.id,
    },
    // Stripe redirects inside the iframe to this URL on success
    return_url: `${siteUrl}/dashboard?payment=success`,
    customer_email: user.email,
  });

  if (!session.client_secret) {
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 },
    );
  }

  return NextResponse.json({ clientSecret: session.client_secret });
}
