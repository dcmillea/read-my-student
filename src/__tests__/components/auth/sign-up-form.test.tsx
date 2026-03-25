/**
 * Component tests for the sign-up form.
 *
 * These tests use @testing-library/react to render the SignUpForm in a jsdom
 * environment and verify that:
 *
 *   1. The form renders with the expected inputs and submit button.
 *   2. The STUDENT role is selected by default and shows student-specific fields.
 *   3. Switching to FACULTY reveals faculty-specific fields.
 *   4. Zod validation errors surface as visible error spans after a submit attempt.
 *
 * External dependencies (Next.js router, server actions, heavy sub-components)
 * are mocked so no network requests or heavy rendering occur.
 *
 * NOTE: Because react-hook-form does NOT spread `id` from `register()`, the
 * labels' `htmlFor` attributes are not linked to input `id`s in this form.
 * Queries use `getByPlaceholderText` and `getByRole('button', {name})` instead.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignUpForm } from "@/components/auth/sign-up-form";

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/app/actions/register", () => ({
  signUpAction: jest.fn().mockResolvedValue({ success: true }),
}));

// The CountryCombobox and UniversityCombobox components are complex widgets that
// initiate API calls and use Radix UI popovers. Mock them with simple stubs.
jest.mock("@/components/auth/CountryCombobox", () => ({
  CountryCombobox: ({
    onChange,
  }: {
    value: string;
    onChange: (v: string) => void;
  }) => (
    <select
      aria-label="Country"
      data-testid="country-select"
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select country</option>
      <option value="US">United States</option>
    </select>
  ),
}));

jest.mock("@/components/auth/UniversityCombobox", () => ({
  UniversityCombobox: ({ label }: { label: string }) => (
    <div data-testid="university-combobox">{label} picker (mocked)</div>
  ),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setup() {
  const user = userEvent.setup();
  render(<SignUpForm />);
  return { user };
}

async function clickSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /sign up/i }));
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe("SignUpForm — initial render", () => {
  it("renders the email, password, first name, and last name inputs", () => {
    setup();
    expect(screen.getByPlaceholderText(/university\.edu/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Jane")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Doe")).toBeInTheDocument();
  });

  it("shows a submit button with 'Sign up' label", () => {
    setup();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("defaults to the STUDENT role (shows student-specific fields)", () => {
    setup();
    // The "Program / Major" field is only rendered in STUDENT mode.
    expect(screen.getByPlaceholderText(/biology/i)).toBeInTheDocument();
    // Faculty-specific fields should NOT be visible.
    expect(
      screen.queryByPlaceholderText(/associate professor/i),
    ).not.toBeInTheDocument();
  });
});

// ─── Role toggle ─────────────────────────────────────────────────────────────

describe("SignUpForm — role toggle", () => {
  it("renders both role toggle buttons", () => {
    setup();
    expect(screen.getByRole("button", { name: /student/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /faculty/i })).toBeInTheDocument();
  });

  it("shows faculty-specific fields when FACULTY is selected", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /faculty/i }));
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/associate professor/i),
      ).toBeInTheDocument();
    });
  });

  it("hides faculty-specific fields when STUDENT is re-selected", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /faculty/i }));
    await user.click(screen.getByRole("button", { name: /student/i }));
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText(/associate professor/i),
      ).not.toBeInTheDocument();
    });
  });
});

// ─── Validation errors ────────────────────────────────────────────────────────

describe("SignUpForm — validation", () => {
  it("shows a password validation error when password is too short", async () => {
    const { user } = setup();

    await user.type(screen.getByPlaceholderText("••••••••"), "abc");
    await clickSubmit(user);

    await waitFor(() => {
      // react-hook-form renders the error as a <span> adjacent to the input.
      // We don't pin the exact Zod error message so the test survives
      // minor wording changes in Zod versions.
      const passwordInput = screen.getByPlaceholderText("••••••••");
      const wrapper = passwordInput.closest("div");
      expect(wrapper?.querySelector("span")).toBeInTheDocument();
    });
  });

  it("shows an email validation error for an empty / missing email", async () => {
    const { user } = setup();

    // Do NOT type anything in the email field. An empty `<input type='email'>`
    // without a `required` attribute passes HTML5 native constraint validation
    // (which would otherwise block the submit event before react-hook-form runs),
    // but fails Zod's z.string().email() check, producing an error span.
    await clickSubmit(user);

    await waitFor(() => {
      const emailInput = screen.getByPlaceholderText(/university\.edu/);
      const wrapper = emailInput.closest("div");
      expect(wrapper?.querySelector("span")).toBeInTheDocument();
    });
  });
});
