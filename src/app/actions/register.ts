"use server";

import { createClient } from "@supabase/supabase-js";
// import { Verifier } from "academic-email-verifier";
import { registerSchema, RegisterFormValues } from "@/lib/schemas";

// Initialize Admin Client (Bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

export async function signUpAction(data: RegisterFormValues) {
  const parsed = registerSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Invalid form data" };
  }

  const {
    email,
    password,
    role,
    firstName,
    lastName,
    countryCode,
    university,
    universityOpeId,
    program,
    graduationDate,
    institution,
    institutionOpeId,
    title,
    department,
  } = parsed.data;

  // if (role === "STUDENT") {
  //   try {
  //     //! This package should verify the user email but doesn't seem to work for SUU
  //     // const isAcademic = await Verifier.isAcademic(email);

  //     const lowerCaseEmail = email.toLowerCase();
  //     const isAcademic = lowerCaseEmail.endsWith(".edu");
  //     if (!isAcademic) {
  //       return {
  //         success: false,
  //         error: "Students must use a valid academic (.edu) email address.",
  //       };
  //     }
  //   } catch (e) {
  //     // If verifier is down, we might want to allow it or at least log it.
  //     // For now, we'll log it and proceed or fail depending on strictness.
  //     console.warn("Email verifier failed:", e);
  //   }
  // }

  try {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
        user_metadata: {
          role,
          firstName,
          lastName,
        },
      });

    if (authError || !authData.user) {
      return {
        success: false,
        error: authError?.message || "Failed to create user account.",
      };
    }

    const userId = authData.user.id;

    // Insert into role-specific table
    if (role === "STUDENT") {
      const { error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          user_id: userId,
          university: university,
          university_opeid: universityOpeId,
          program: program,
          graduation_date: graduationDate, // Supabase handles ISO strings for dates automatically
        });

      if (studentError) {
        console.error("Student Insert Error:", studentError);
        // ROLLBACK
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: "Failed to create student record.",
        };
      }
    } else {
      // FACULTY
      const { data: newFacultyRow, error: facultyError } = await supabaseAdmin
        .from("faculty")
        .insert({
          user_id: userId,
          institution: institution,
          institution_opeid: institutionOpeId,
          title: title,
          department: department,
        })
        .select("id")
        .single();

      if (facultyError || !newFacultyRow) {
        console.error("Faculty Insert Error:", facultyError);
        // ROLLBACK
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return {
          success: false,
          error: "Failed to create faculty record.",
        };
      }

      // Claim any letter requests that were sent to this email address while
      // the professor was not yet registered (status "invited", faculty_id null).
      const { error: claimError } = await supabaseAdmin
        .from("letter_requests")
        .update({ faculty_id: newFacultyRow.id, status: "requested" })
        .ilike("professor_email", email.trim())
        .eq("status", "invited");

      if (claimError) {
        console.error("Failed to claim invited requests:", claimError);
        // Non-fatal — registration still succeeds
      }
    }

    const { error: emailError } = await supabaseAdmin.auth.resend({
      type: "signup",
      email: email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
      },
    });

    if (emailError) {
      console.error("Failed to send verification email:", emailError);
      // We don't rollback here because the account is created successfully.
      // We just warn the user or let them "Resend" later.
    }

    return { success: true };
  } catch (error) {
    console.error("Server Action Error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
