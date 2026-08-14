import { expect, test, beforeAll, afterAll } from "bun:test";
import { admin } from "./ayudas";
import { montarEscenario, desmontar, type Escenario } from "./escenario";
import {
  leerPagina,
  leerFijado,
  crearPost,
  eliminarPost,
  fijarPost,
  POR_PAGINA,
} from "../../src/lib/supabase/feed";

// Estas pruebas miran permisos, no niveles: un mapa vacio basta.
const sinPuntos = new Map<string, number>();

let e: Escenario;
let espacioId: string;

beforeAll(async () => {
  e = await montarEscenario("feedpag");

  const { data: sec } = await admin
    .from("secciones")
    .insert({ comunidad_id: e.comunidadA, titulo: "General", orden: 1 })
    .select("id")
    .single();
  const { data: esp } = await admin
    .from("espacios")
    .insert({ seccion_id: sec!.id, slug: "general", nombre: "General", orden: 1 })
    .select("id")
    .single();
  espacioId = esp!.id;

  // 25 publicaciones con fechas separadas, para que el orden sea inequivoco.
  for (let i = 0; i < 25; i++) {
    await admin.from("publicaciones").insert({
      comunidad_id: e.comunidadA,
      espacio_id: espacioId,
      autor_id: e.alumnoA.id,
      titulo: `Post ${i}`,
      cuerpo: "x",
      creado_el: new Date(
        Date.parse("2026-08-01T00:00:00Z") + i * 60_000
      ).toISOString(),
    });
  }
});

afterAll(async () => {
  await desmontar(e);
});

test("la primera pagina trae 20 y la segunda el resto, sin repetir", async () => {
  const filtro = { comunidadId: e.comunidadA, espacioId };
  const p1 = await leerPagina(e.alumnoA.cliente, filtro, null, sinPuntos);
  expect(p1.length).toBe(POR_PAGINA);

  const p2 = await leerPagina(e.alumnoA.cliente, filtro, p1[p1.length - 1].creadoEl, sinPuntos);
  expect(p2.length).toBe(5);

  const ids = new Set([...p1, ...p2].map((p) => p.id));
  expect(ids.size).toBe(25);
});

test("publicar entre pagina y pagina NO duplica ninguna", async () => {
  // El fallo exacto que motiva paginar por fecha: con paginas numeradas, una
  // publicacion nueva desplaza a las demas y la 20 reaparece en la pagina 2.
  const filtro = { comunidadId: e.comunidadA, espacioId };
  const p1 = await leerPagina(e.alumnoA.cliente, filtro, null, sinPuntos);

  await crearPost(e.alumnoA.cliente, {
    comunidadId: e.comunidadA,
    espacioId,
    titulo: "Intruso",
    cuerpo: "y",
  });

  const p2 = await leerPagina(e.alumnoA.cliente, filtro, p1[p1.length - 1].creadoEl, sinPuntos);
  const repetidos = p2.filter((x) => p1.some((y) => y.id === x.id));
  expect(repetidos).toEqual([]);
});

test("la publicacion fijada sale aparte, no en la paginacion", async () => {
  const filtro = { comunidadId: e.comunidadA, espacioId };
  const p1 = await leerPagina(e.alumnoA.cliente, filtro, null, sinPuntos);
  // La mas antigua: si entrara en el orden por fecha no la veria nadie.
  const { data: vieja } = await admin
    .from("publicaciones")
    .select("id")
    .eq("comunidad_id", e.comunidadA)
    .order("creado_el", { ascending: true })
    .limit(1)
    .single();

  await fijarPost(e.duenoA.cliente, vieja!.id);

  const fijada = await leerFijado(e.alumnoA.cliente, e.comunidadA, sinPuntos);
  expect(fijada?.id).toBe(vieja!.id);

  const tras = await leerPagina(e.alumnoA.cliente, filtro, null, sinPuntos);
  expect(tras.some((p) => p.id === vieja!.id)).toBe(false);
  expect(p1.length).toBeGreaterThan(0);
});

test("solo hay una publicacion fijada por academia", async () => {
  const { data: otra } = await admin
    .from("publicaciones")
    .select("id")
    .eq("comunidad_id", e.comunidadA)
    .eq("fijado", false)
    .limit(1)
    .single();

  await fijarPost(e.duenoA.cliente, otra!.id);

  const { data: fijadas } = await admin
    .from("publicaciones")
    .select("id")
    .eq("comunidad_id", e.comunidadA)
    .eq("fijado", true);
  expect(fijadas?.length).toBe(1);
});

test("un alumno de otra empresa no ve nada de este feed", async () => {
  const { data } = await e.alumnoB.cliente.from("publicaciones").select("id");
  expect(data ?? []).toEqual([]);
});

test("nadie publica a nombre de otro", async () => {
  const { error } = await e.alumnoA.cliente.from("publicaciones").insert({
    comunidad_id: e.comunidadA,
    espacio_id: espacioId,
    autor_id: e.duenoA.id,
    titulo: "suplantada",
    cuerpo: "x",
  });
  expect(error).not.toBeNull();
});

test("borra el autor y el dueno, pero no un tercero", async () => {
  const { data: p } = await admin
    .from("publicaciones")
    .insert({
      comunidad_id: e.comunidadA,
      espacio_id: espacioId,
      autor_id: e.alumnoA.id,
      titulo: "Borrable",
      cuerpo: "x",
    })
    .select("id")
    .single();

  await eliminarPost(e.alumnoB.cliente, p!.id);
  const { data: sigue } = await admin
    .from("publicaciones")
    .select("id")
    .eq("id", p!.id);
  expect(sigue?.length).toBe(1); // el tercero no pudo

  await eliminarPost(e.duenoA.cliente, p!.id);
  const { data: ya } = await admin
    .from("publicaciones")
    .select("id")
    .eq("id", p!.id);
  expect(ya ?? []).toEqual([]);
});
