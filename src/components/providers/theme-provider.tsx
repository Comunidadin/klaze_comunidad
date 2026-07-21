"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Envoltura fina de `next-themes`. Vive en su propio archivo porque el
 * root layout (`src/app/layout.tsx`) es un Server Component y no puede
 * usar el provider directamente.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
