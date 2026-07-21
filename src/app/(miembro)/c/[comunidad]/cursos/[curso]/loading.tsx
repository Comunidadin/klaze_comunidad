import { Skeleton } from "@/components/ui/skeleton";

/** Fallback de Suspense mientras carga el chunk de `/c/[comunidad]/cursos/[curso]`. */
export default function CursoDetalleLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="aspect-[16/9] w-full rounded-3xl sm:aspect-[3/1]" />
      <div className="space-y-3 rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
