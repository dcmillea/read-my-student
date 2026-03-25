"use server";

import { createClient } from "@/lib/supabase/server";
import {
  profileFormToDbRow,
  type FacultyProfileRow,
  type RecommenderForm,
} from "@/lib/faculty-profile";

const PROFILE_COLUMNS = [
  "id",
  "user_id",
  "institution",
  "institution_opeid",
  "department",
  "title",
  "country",
  "state",
  "city",
  "postal_code",
  "street",
  "prefix",
  "signature_storage_path",
  "logo_storage_path",
  "logo_uploaded_at",
  "signature_uploaded_at",
].join(", ");

// Supabase Storage bucket names — create these in the Supabase dashboard
// (Storage → New bucket, private) before deploying.
const BUCKET_LOGOS = "faculty-logos";
const BUCKET_SIGNATURES = "faculty-signatures";

/**
 * Fetch the faculty profile row for the currently authenticated user.
 * Returns null if the user is not logged in or has no faculty row.
 */
export async function getFacultyProfile(): Promise<FacultyProfileRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("faculty")
    .select(PROFILE_COLUMNS)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;
  return data as unknown as FacultyProfileRow;
}

/**
 * Persist the recommender form fields back to the faculty row.
 * Uses the regular server client so RLS applies (faculty can only
 * update their own row).
 */
export async function saveFacultyProfile(
  form: RecommenderForm,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const updates = {
    ...profileFormToDbRow(form),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("faculty")
    .update(updates)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Upload a logo or signature image to the appropriate private Storage bucket,
 * then persist the storage path and per-asset upload timestamp on the faculty row.
 * Returns a 1-hour signed URL so the client can display the image immediately.
 *
 * Supabase Storage buckets required (create in the dashboard: Storage → New bucket,
 * set to private for both):
 *   - faculty-logos       → stores logo files at {user_id}/logo.{ext}
 *   - faculty-signatures  → stores signature files at {user_id}/signature.{ext}
 */
export async function uploadFacultyAsset(
  formData: FormData,
  assetType: "logo" | "signature",
): Promise<{
  success: boolean;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided." };

  const ext = file.name.split(".").pop() ?? "bin";
  // One file per user per asset type — stable path so upsert replaces the old one.
  const storagePath = `${user.id}/${assetType}.${ext}`;
  const bucket = assetType === "logo" ? BUCKET_LOGOS : BUCKET_SIGNATURES;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return { success: false, error: uploadError.message };

  // Persist path + refresh the per-asset retention clock on the faculty profile row
  const pathColumn =
    assetType === "logo" ? "logo_storage_path" : "signature_storage_path";
  const tsColumn =
    assetType === "logo" ? "logo_uploaded_at" : "signature_uploaded_at";
  const now = new Date().toISOString();
  await supabase
    .from("faculty")
    .update({ [pathColumn]: storagePath, [tsColumn]: now, updated_at: now })
    .eq("user_id", user.id);

  // Short-lived signed URL so the component can render the image immediately
  const { data: signedData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);

  return { success: true, storagePath, signedUrl: signedData?.signedUrl };
}

/**
 * Generate a short-lived signed URL for an existing faculty asset storage path.
 * Used to display saved logo/signature images without re-uploading.
 */
export async function getSignedAssetUrl(
  storagePath: string,
  assetType: "logo" | "signature",
): Promise<string | null> {
  const supabase = await createClient();
  const bucket = assetType === "logo" ? BUCKET_LOGOS : BUCKET_SIGNATURES;
  const { data } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

/**
 * Confirm an existing asset file is still valid — resets the 1-year retention
 * clock for that asset WITHOUT re-uploading. Faculty call this from the
 * expiry warning prompt in settings.
 */
export async function refreshAssetTimestamp(
  assetType: "logo" | "signature",
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not authenticated." };

  const tsColumn =
    assetType === "logo" ? "logo_uploaded_at" : "signature_uploaded_at";
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("faculty")
    .update({ [tsColumn]: now, updated_at: now })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
