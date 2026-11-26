import { describe, expect, test } from "vitest";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DIALOGO = readFileSync(join(process.cwd(), "src/components/contactos/dialogo-nuevo-contacto.tsx"), "utf8");
const FORMULARIO = readFileSync(join(process.cwd(), "src/components/contactos/formulario-contacto.tsx"), "utf8");
const SELECTOR = readFileSync(join(process.cwd(), "src/components/contactos/selector-contacto.tsx"), "utf8");
const CONTACTOS = readFileSync(
  join(process.cwd(), "src/app/(main)/dashboard/contactos/_components/contactos-cliente.tsx"),
  "utf8",
);
const PANEL_FACTURA = readFileSync(
  join(process.cwd(), "src/app/(pos)/pos/_components/vender/panel-factura.tsx"),
  "utf8",
);
const DIALOGO_MOVIMIENTO = readFileSync(
  join(process.cwd(), "src/app/(pos)/pos/_components/pagos/dialogo-movimiento.tsx"),
  "utf8",
);

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
    expect(DIALOGO).toMatch(/permitirProveedor\?: boolean;/);
  });

  test("el alta de Contactos usa el diálogo rápido; editar sigue en el formulario completo", () => {
    expect(CONTACTOS).toContain('import { DialogoNuevoContacto } from "@/components/contactos/dialogo-nuevo-contacto"');
    expect(CONTACTOS).toContain('import { FormularioContacto } from "@/components/contactos/formulario-contacto"');
    expect(CONTACTOS).toMatch(
      /function abrirNuevo\(\) \{\s*setContactoEditando\(null\);\s*setDialogoAbierto\(false\);\s*setDialogoRapidoAbierto\(true\);/,
    );
    expect(CONTACTOS).toMatch(
      /<DialogoNuevoContacto\s+abierto=\{dialogoRapidoAbierto\}\s+onOpenChange=\{setDialogoRapidoAbierto\}\s+tipoInicial="cliente"\s+onCreado=\{cerrarDialogoRapido\}/,
    );
    expect(CONTACTOS).toMatch(
      /function cerrarDialogoRapido\(\) \{\s*setDialogoRapidoAbierto\(false\);\s*router\.refresh\(\);/,
    );
    expect(CONTACTOS).toContain("contacto={contactoEditando}");
    expect(CONTACTOS).not.toContain("permitirProveedor");
  });

  test("en el POS el diálogo rápido solo crea Cliente y bloquea proveedor/ambos", () => {
    expect(DIALOGO).toContain("if (!permitirProveedor) return null;");
    expect(DIALOGO).toContain("if (!permitirProveedor) return;");
    expect(DIALOGO).toContain('if (!permitirProveedor && tipo !== "cliente") return;');
    expect(DIALOGO).toContain('if (!permitirProveedor) return "cliente";');
    expect(DIALOGO).toContain('const proveedorInicial = permitirProveedor && tipoInicial === "proveedor";');

    const instanciasPOS = PANEL_FACTURA.match(/permitirProveedor=\{false\}/g) ?? [];
    expect(instanciasPOS, "PanelFactura debe restringir su selector y su diálogo directo").toHaveLength(2);
    expect(SELECTOR).toContain("permitirProveedor={permitirProveedor}");
    expect(DIALOGO_MOVIMIENTO).toContain("permitirProveedor={!esIngreso}");
  });
});
