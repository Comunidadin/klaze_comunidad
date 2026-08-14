import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display" });

/**
 * Título e icono por defecto: los de la plataforma.
 *
 * Las rutas con academia (`/c/[comunidad]`, `/login/[academia]`, la
 * invitación) los pisan con `generateMetadata` + `marca_publica`. Por eso los
 * iconos van AQUÍ, declarados en `icons`, y los archivos viven en `public/` y
 * no como `src/app/favicon.ico`: los iconos "de convención" de Next se
 * inyectan en TODAS las rutas sin que ninguna página pueda quitarlos, así que
 * la pestaña de una academia salía con dos `<link rel="icon">` y Chrome
 * escogía el más grande — el de Klaze, y el favicon de la academia no se veía
 * nunca. Un `icons` de metadata sí se sustituye entero en las rutas hijas.
 */
/**
 * `viewportFit: cover` es lo que hace válidos los `env(safe-area-inset-*)`
 * en el iPhone: sin él valen 0 y la interfaz se mete bajo la barra de inicio
 * cuando la app corre instalada (standalone).
 */
export const viewport: Viewport = {
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Klaze — Módulos y comunidad para tu empresa",
  description: "Plataforma de módulos en video y comunidad, una por empresa.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.png", type: "image/png", sizes: "256x256" },
    ],
  },
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
