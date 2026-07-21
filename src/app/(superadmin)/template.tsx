import { PageTransition } from "@/components/shared/page-transition";

/** Ver `PageTransition` — Next remonta `template.tsx` en cada navegación. */
export default function SuperadminTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
