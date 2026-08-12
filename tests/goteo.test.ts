import { expect, test } from "bun:test";
import {
  fechaDeApertura,
  textoDeApertura,
  notaDeGoteo,
  type ConfigGoteo,
} from "../src/lib/goteo";

const AHORA = new Date("2026-08-12T12:00:00Z");
const SIN_GOTEO: ConfigGoteo = { goteoModo: "ninguno", goteoDias: null, goteoDesde: null };

test("sin goteo, abierto", () => {
  expect(fechaDeApertura(SIN_GOTEO, "2026-08-10T00:00:00Z", AHORA)).toBeNull();
});

test("por dias: el plazo se cuenta desde que entro a la academia", () => {
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  const abre = fechaDeApertura(c, "2026-08-10T09:00:00Z", AHORA);
  expect(abre?.toISOString()).toBe("2026-08-17T09:00:00.000Z");
});

test("por dias: cumplido el plazo, abierto", () => {
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, "2026-07-01T09:00:00Z", AHORA)).toBeNull();
});

test("por dias: justo al cumplirse el instante, abierto", () => {
  // El limite exacto. Con `<` en vez de `<=` este caso ensenaria un candado
  // que la base ya no aplica --- y el alumno veria "se abre en 0 minutos".
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, "2026-08-05T12:00:00Z", AHORA)).toBeNull();
});

test("por dias sin fecha de entrada, se da por abierto", () => {
  // No es permisividad: quien decide es Postgres. Si aqui no se sabe, se pinta
  // abierto y la base devuelve lo que corresponda.
  const c: ConfigGoteo = { goteoModo: "dias", goteoDias: 7, goteoDesde: null };
  expect(fechaDeApertura(c, null, AHORA)).toBeNull();
});

test("por fecha: antes devuelve el instante, despues null", () => {
  const futuro: ConfigGoteo = {
    goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-09-15T14:00:00Z",
  };
  expect(fechaDeApertura(futuro, null, AHORA)?.toISOString()).toBe("2026-09-15T14:00:00.000Z");

  const pasado: ConfigGoteo = {
    goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-01-01T00:00:00Z",
  };
  expect(fechaDeApertura(pasado, null, AHORA)).toBeNull();
});

test("el texto cambia segun lo que falte", () => {
  // 2h30m se dice «3 horas», no «2»: ver el docstring de `textoDeApertura`.
  expect(textoDeApertura(new Date("2026-08-12T14:30:00Z"), AHORA)).toBe("Se abre en 3 horas");
  expect(textoDeApertura(new Date("2026-08-12T12:30:00Z"), AHORA)).toBe("Se abre en 30 minutos");
  // 22 horas siguen siendo horas: no hay tramo de «mañana».
  expect(textoDeApertura(new Date("2026-08-13T10:00:00Z"), AHORA)).toBe("Se abre en 22 horas");
  // A más de un día se pasa a la fecha. `toContain` y no igualdad exacta
  // porque el nombre del día lo pone `Intl` en la zona de quien ejecuta.
  expect(textoDeApertura(new Date("2026-08-20T10:00:00Z"), AHORA)).toContain("Se abre el ");
});

test("una hora se dice en singular", () => {
  expect(textoDeApertura(new Date("2026-08-12T13:00:00Z"), AHORA)).toBe("Se abre en 1 hora");
});

test("la nota de la lista resume la configuracion", () => {
  expect(notaDeGoteo(SIN_GOTEO)).toBeNull();
  expect(notaDeGoteo({ goteoModo: "dias", goteoDias: 7, goteoDesde: null }))
    .toBe("Se abre a los 7 días");
  expect(notaDeGoteo({ goteoModo: "dias", goteoDias: 1, goteoDesde: null }))
    .toBe("Se abre al día siguiente");
  expect(notaDeGoteo({ goteoModo: "fecha", goteoDias: null, goteoDesde: "2026-09-15T14:00:00Z" }))
    .toContain("Se abre el ");
});
