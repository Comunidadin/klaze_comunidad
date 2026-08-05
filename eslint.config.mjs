import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Salida del adaptador de Cloudflare (`opennextjs-cloudflare build`):
    // es código generado y empaquetado, no fuente del proyecto. Sin esto
    // `bun run lint` reporta cientos de errores del bundle.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
