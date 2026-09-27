import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Android Java/resources are checked by Gradle; do not traverse its generated build/cache files.
  globalIgnores([".next/**", "out/**", "next-env.d.ts", "design-reference/**", "android/**"]),
]);
