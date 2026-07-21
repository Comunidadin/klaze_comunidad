# Klaze V2 — Iteración 2: dueño unificado y portadas de módulos

**Fecha:** 2026-07-21 · **Estado:** Aprobado · **Base:** main tras merge del frontend completo

## Cambio 1 — Dueño de plataforma administra su academia (cuenta unificada)

- `admin@klaze.app` (u-admin, superadmin) pasa a ser `ownerId` de `com-principal` ("Academia Klaze"): al entrar ve `/admin` con su academia Y `/plataforma`.
- Login del superadmin aterriza en `/admin` (uso diario); enlaces cruzados en sidebars: "Panel plataforma" en el AdminShell del creador (visible solo para rol superadmin) y "Mi academia" en el AdminShell de plataforma (visible solo si el superadmin es dueño de alguna comunidad).
- `creador@klaze.app` pasa a ser **Marta** (u-creador2, dueña de "Inglés con Marta"): demuestra el modelo multi-creador — solo ve SU `/admin`, sin plataforma. El antiguo u-creador (Daniel) queda como miembro/autor de contenido histórico sin chip de demo; el post fijado de bienvenida y los eventos de Academia Klaze se reasignan a u-admin.
- Chips del login y UserSwitcher siguen siendo 3: alumno / creador (Marta) / admin (dueño total). README actualizado.
- `homePorRol`: superadmin → `/admin` si es dueño de alguna comunidad, si no `/plataforma`.

## Cambio 2 — Portadas de módulos (estilo Hotmart Club)

- `CourseModule.portadaUrl?: string` (nuevo campo opcional en types + mocks: sembrar portadas Unsplash en los módulos del curso 1 y 2 de Academia Klaze; alguno sin portada para mostrar el fallback).
- **Vista alumno** (`/c/[comunidad]/cursos/[curso]`): los módulos se muestran como **grid de tarjetas con portada vertical** (estilo Netflix/Hotmart Club) con nº de lecciones y progreso del módulo; clic en tarjeta → expande/navega a la lista de lecciones de ese módulo (reemplaza el acordeón como vista principal; la lista de lecciones del módulo seleccionado se muestra debajo del grid o en la misma página con scroll — decisión de implementación documentada). Fallback sin imagen: gradiente índigo con inicial del módulo (reutilizar patrón CoursePortada).
- **Editor** (`/admin/cursos/[curso]`): campo "URL de portada del módulo" con preview y fallback en la columna de estructura o en un popover por módulo.
- El player (sidebar de lecciones) no cambia.

## Fuera de alcance
- Subida de archivos real (solo URL). Reordenar con drag & drop. Cambios en comunidad secundaria más allá del rol de Marta.
