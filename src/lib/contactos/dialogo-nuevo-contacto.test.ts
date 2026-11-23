import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIALOGO = readFileSync(join(process.cwd(), "src/components/contactos/dialogo-nuevo-contacto.tsx"), "utf8");
const FORMULARIO = readFileSync(join(process.cwd(), "src/components/contactos/formulario-contacto.tsx"), "utf8");

const MENSAJE_DESCARTE = "Cerrar con cambios debe pedir «¿Descartar los cambios sin guardar?»";

describe("diálogo Nuevo contacto", () => {
  test("verifica duplicados antes de crear y deja confirmar el caso legítimo", () => {
    const verificacion = DIALOGO.indexOf("buscarContactoDuplicado");
    const creacion = DIALOGO.indexOf("await crearContacto(");

    expect(verificacion, "El diálogo debe buscar duplicados antes de llamar a crearContacto").toBeGreaterThan(-1);
    expect(creacion).toBeGreaterThan(verificacion);
    expect(DIALOGO).toContain("Crear de todas formas");
    expect(DIALOGO).toContain("Ver el existente");
    expect(DIALOGO).toContain('motivo === "rnc" ? "RNC o cédula" : "nombre"');
  });

  test("ignora un segundo submit mientras el primero está en vuelo", () => {
    expect(DIALOGO).toContain("const enVuelo = useRef<boolean>(false)");
    expect(DIALOGO).toMatch(/if \(enVuelo\.current\) return;/);
    expect(DIALOGO).toContain("disabled={pendiente}");
    expect(FORMULARIO).toContain("const enVuelo = useRef<boolean>(false)");
    expect(FORMULARIO).toMatch(/if \(enVuelo\.current\) return;/);
    expect(FORMULARIO).toContain("disabled={pendiente}");
  });

  test("cerrar con cambios sin guardar pide confirmación", () => {
    expect(DIALOGO, MENSAJE_DESCARTE).toContain("¿Descartar los cambios sin guardar?");
    expect(DIALOGO).toMatch(/onOpenChange=\{cambiarApertura\}/);
    expect(DIALOGO).toMatch(/if \(hayCambios\) \{\s*setConfirmarDescarte\(true\);\s*return;/);
    expect(DIALOGO).toContain("<AlertDialog");
    expect(DIALOGO).toContain("Seguir editando");
  });

  test("el formulario avanzado también avisa del duplicado al crear", () => {
    expect(FORMULARIO).toContain("buscarContactoDuplicado");
    expect(FORMULARIO).toContain("contacto === null && !permitirDuplicado");
    expect(FORMULARIO).toContain("Crear de todas formas");
  });

  test("la API pública del diálogo no cambió", () => {
    expect(DIALOGO).toMatch(/abierto: boolean;/);
    expect(DIALOGO).toMatch(/onOpenChange: \(abierto: boolean\) => void;/);
    expect(DIALOGO).toMatch(/tipoInicial: "cliente" \| "proveedor";/);
    expect(DIALOGO).toMatch(/nombreInicial\?: string;/);
    expect(DIALOGO).toMatch(/onCreado: \(contacto: ContactoCreado\) => void;/);
  });
});
