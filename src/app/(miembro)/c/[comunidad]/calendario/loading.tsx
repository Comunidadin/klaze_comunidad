import { Skeleton } from "@/components/ui/skeleton";

/** Fallback de Suspense mientras carga el chunk de `/c/[comunidad]/cursos/[curso]/calendario`. */
export default function CalendarioLoading() {
  return (
    <div>
      <Skeleton className="mb-2 h-8 w-40" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="space-y-7">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i}>
            <Skeleton className="mb-3 h-4 w-32" />
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-24 w-full rounded-2xl" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
