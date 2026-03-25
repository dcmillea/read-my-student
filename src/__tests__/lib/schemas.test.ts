/**
 * Unit tests for Zod validation schemas.
 *
 * These tests validate the schema rules themselves — they do NOT hit a server
 * or database. Any regression in a schema's shape, required fields, or error
 * messages will be caught here before it can reach the UI or server action.
 */

import { contactFormSchema, registerSchema } from "@/lib/schemas";

// ─── contactFormSchema ────────────────────────────────────────────────────────

describe("contactFormSchema", () => {
  const validPayload = {
    email: "user@example.com",
    subject: "Question about pricing",
    message: "I would like to know more about the pricing plans.",
  };

  it("accepts a fully valid payload", () => {
    const result = contactFormSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const { email: _email, ...rest } = validPayload;
    const result = contactFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailIssue = result.error.issues.find((i) =>
        i.path.includes("email"),
      );
      expect(emailIssue).toBeDefined();
    }
  });

  it("rejects a subject shorter than 5 characters", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      subject: "Hi",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("subject"));
      expect(issue?.message).toMatch(/5/);
    }
  });

  it("rejects a message shorter than 10 characters", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      message: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty subject", () => {
    const result = contactFormSchema.safeParse({
      ...validPayload,
      subject: "",
    });
    expect(result.success).toBe(false);
  });
});

// ─── registerSchema ───────────────────────────────────────────────────────────

describe("registerSchema", () => {
  const validStudent = {
    email: "student@university.edu",
    password: "SuperSecure1",
    role: "STUDENT" as const,
    firstName: "Jane",
    lastName: "Doe",
    countryCode: "US",
    university: "MIT",
    universityOpeId: "00223",
    program: "Computer Science",
    graduationDate: "2026-05",
  };

  const validFaculty = {
    email: "prof@university.edu",
    password: "SuperSecure1",
    role: "FACULTY" as const,
    firstName: "John",
    lastName: "Smith",
    countryCode: "US",
    institution: "MIT",
    institutionOpeId: "00223",
    title: "Associate Professor",
    department: "EECS",
  };

  it("accepts valid student data", () => {
    expect(registerSchema.safeParse(validStudent).success).toBe(true);
  });

  it("accepts valid faculty data", () => {
    expect(registerSchema.safeParse(validFaculty).success).toBe(true);
  });

  it("rejects a missing email", () => {
    const { email: _email, ...rest } = validStudent;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...validStudent, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      ...validStudent,
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("password"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("rejects an invalid role value", () => {
    const result = registerSchema.safeParse({ ...validStudent, role: "ADMIN" });
    expect(result.success).toBe(false);
  });

  it("rejects a firstName shorter than 2 characters", () => {
    const result = registerSchema.safeParse({
      ...validStudent,
      firstName: "A",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a lastName shorter than 2 characters", () => {
    const result = registerSchema.safeParse({ ...validStudent, lastName: "B" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing countryCode", () => {
    const { countryCode: _cc, ...rest } = validStudent;
    expect(registerSchema.safeParse(rest).success).toBe(false);
  });

  it("accepts optional faculty fields as absent (student registration)", () => {
    // A student payload should parse successfully even without faculty-only fields.
    const result = registerSchema.safeParse(validStudent);
    expect(result.success).toBe(true);
    if (result.success) {
      // Optional fields that were omitted should be undefined.
      expect(result.data.institution).toBeUndefined();
      expect(result.data.title).toBeUndefined();
    }
  });
});
