/**
 * Loader mínimo mostrado por los guards de rol mientras el store de
 * Zustand aún no terminó de hidratarse desde localStorage. Nunca debe
 * renderizarse contenido protegido detrás de este loader.
 */
export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="Cargando"
      />
    </div>
  );
}
