/**
 * Jest configuration for read-my-student.
 *
 * Uses the official Next.js jest helper which:
 *  - Applies SWC transforms to TypeScript / JSX automatically.
 *  - Mocks Next.js internals (next/image, next/font, etc.).
 *  - Loads .env.local / .env.test for environment variables.
 *
 * Test environments:
 *  - Default: jsdom  (React component tests)
 *  - Override per-file with `@jest-environment node` docblock (pure Node logic, PDF rendering)
 */

import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const customConfig: Config = {
  coverageProvider: "v8",

  // Default environment for component tests.
  testEnvironment: "jsdom",

  // Runs after the test framework is installed in the environment.
  // This is where you extend `expect` with jest-dom matchers.
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],

  // Only pick up files under __tests__ directories.
  testMatch: ["**/__tests__/**/*.[jt]s?(x)"],

  // Explicitly mirror the tsconfig.json `paths` so jest.mock() and static
  // imports resolve consistently. next/jest reads tsconfig via the async
  // wrapper but jest.mock() calls are hoisted to the top of the module before
  // the async config is fully applied.
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },

  // Coverage is collected from src only, excluding generated / infra files.
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/layout.tsx",
    "!src/app/globals.css",
  ],
};

const nextConfig = createJestConfig(customConfig);

/**
 * Wrap the async Next.js config to inject `transformIgnorePatterns` AFTER
 * next/jest has applied its own defaults.  Modifying it inside `customConfig`
 * alone is not reliable because next/jest may overwrite the array.
 *
 * Packages we must transform (they ship as ESM-only):
 *   @react-pdf/renderer     — PDF rendering engine used by the finalize route
 *   @exodus/bytes           — ESM-only dep of jsdom v28 (used by sanitize.ts)
 *   html-encoding-sniffer   — transitive ESM dep pulled in by jsdom v28
 *   whatwg-encoding         — transitive ESM dep pulled in by jsdom v28
 *   @asamuzakjp/*           — CSS selector/color lib (jsdom v28 direct dep)
 *   @csstools/*             — CSS calc/tokenizer (transitive via @asamuzakjp)
 *   @bramus/specificity     — CSS specificity lib (jsdom v28 direct dep)
 *   parse5                  — HTML parser (jsdom v28 direct dep)
 *   tough-cookie            — Cookie jar (jsdom v28 direct dep)
 */
export default async (): Promise<Config> => {
  const config = await nextConfig();
  config.transformIgnorePatterns = [
    "/node_modules/(?!(@react-pdf|@exodus|@asamuzakjp|@csstools|@bramus|html-encoding-sniffer|whatwg-encoding|parse5|tough-cookie|yoga-layout)/)",
    "^.+\\.module\\.(css|sass|scss)$",
  ];
  return config;
};
