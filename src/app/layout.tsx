import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

/**
 * Título por defecto: el de la plataforma.
 *
 * Es lo único de la app que no se puede poner en marca blanca sin trabajo
 * extra: se resuelve en el servidor, antes de saber qué academia va a
 * cargarse. Para que cada academia diera nombre a la pestaña haría falta
 * `generateMetadata` en las rutas que llevan el slug, y consultar
 * `marca_publica` desde el servidor. Queda pendiente y es visible solo en la
 * pestaña del navegador.
 */
export const metadata: Metadata = {
  title: "Klaze — Módulos y comunidad para tu empresa",
  description: "Plataforma de módulos en video y comunidad, una por empresa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
