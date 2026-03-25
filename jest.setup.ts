/**
 * Jest global setup.
 *
 * Imported after the test environment is ready (via `setupFilesAfterEnv`).
 * Adds all @testing-library/jest-dom matchers (toBeInTheDocument, toHaveValue, etc.)
 * to Jest's `expect` so they're available in every test file automatically.
 */
import "@testing-library/jest-dom";
