import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Allow intentionally-unused args/locals when prefixed with _.
      // (Common when an interface mandates a parameter we don't consume.)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // We intentionally hydrate from localStorage inside useEffect on mount.
      // The pattern is correct for SSR-safe initialization, but the React lint
      // rule flags it because state updates inside an effect can cascade.
      // Keep as a warning rather than an error so it surfaces but doesn't
      // block CI; we'll revisit if it bites in practice.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
