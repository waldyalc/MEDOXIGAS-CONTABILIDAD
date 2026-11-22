import { describe, expect, it } from "vitest";

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = join(process.cwd(), "src");
const POS = join(SRC, "app", "(pos)", "pos");
const GLOBALS = join(SRC, "app", "globals.css");

/**
 * Candado del rediseño Alegra del POS (decisión de Waldy, 22-11-2026):
 * el POS se ve como Alegra — teal #00b19d y tokens `--pos-*` propios — y
 * nunca usa el `--primary` azul de Medoxigas ni el hex `#1e56c7`.
 *
 * PENDIENTES: archivos que hoy todavía usan el azul y se migran después.
 * La lista SOLO PUEDE ENCOGERSE: al migrar un archivo se borra de aquí;
 * agregarlo de vuelta rompe el test. Archivo nuevo con `--primary` también
 * rompe el test (no está en la lista).
 */
const PENDIENTES = [
  "_components/devoluciones/confirmacion-devolucion.tsx",
  "_components/devoluciones/wizard-devolucion.tsx",
  "_components/estado-turno-pos.tsx",
  "_components/historial/detalle-venta-pos.tsx",
  "_components/menu-pos-estilos.ts",
  "_components/menu-pos.tsx",
  "_components/pagos/lista-pagos.tsx",
  "_components/vender/confirmacion-venta.tsx",
  "_components/vender/dialogo-venta-simple.tsx",
];

function listar(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return listar(ruta);
    return /\.(tsx?|css|jsx)$/.test(entrada.name) ? [ruta] : [];
  });
}

function rutaRelativa(ruta: string) {
  return relative(POS, ruta).split(sep).join("/");
}

const ARCHIVOS = listar(POS);
const MARCA_AZUL = /#1e56c7|--primary|(?:bg|text|border|ring|fill|stroke|from|to|via|shadow|outline)-primary\b/;

describe("diseño POS estilo Alegra", () => {
  it("el turno y las ventas pendientes viven en la barra inferior, no sobre el catálogo", () => {
    const vender = readFileSync(join(POS, "_components", "vender", "vender-pos.tsx"), "utf8");
    expect(vender, "La barra inferior debe renderizarse fuera del panel, bajo catálogo y carrito").toContain(
      "<BarraInferiorPos",
    );
    expect(
      vender,
      "El turno no puede volver a la línea suelta sobre el buscador; va en la barra inferior (decisión de Waldy, Punto 1)",
    ).not.toMatch(/Turno No \$\{turnoActual\.numero\} abierto/);

    const barra = readFileSync(join(POS, "_components", "vender", "barra-inferior-pos.tsx"), "utf8");
    expect(barra, "La barra debe contener las pestañas de ventas pendientes").toContain("PestanasVentaPos");
    expect(barra, "La barra debe mostrar el estado del turno").toContain("Turno No");
    expect(barra, "La barra debe conservar la acción de cerrar turno").toContain("Cerrar turno");
    expect(barra, "La barra debe conservar la acción de abrir turno").toContain("Abrir turno");

    const panel = readFileSync(join(POS, "_components", "vender", "panel-factura.tsx"), "utf8");
    expect(panel, "Las pestañas no van dentro del panel del carrito; van en la barra inferior").not.toContain(
      "PestanasVentaPos",
    );
    expect(vender, "El Sheet «Ver factura» debe terminar 44 px antes para no tapar la barra inferior").toContain(
      'height: "calc(100dvh - 2.75rem)"',
    );
    expect(vender, "El velo del Sheet tampoco debe cubrir la barra inferior").toContain(
      'overlayStyle={{ bottom: "2.75rem" }}',
    );

    expect(panel, "El cuerpo del panel debe usar --pos-panel (#f8fafc), no blanco").toContain("bg-pos-panel");
    const linea = readFileSync(join(POS, "_components", "vender", "linea-carrito-pos.tsx"), "utf8");
    expect(linea, "Los renglones del carrito van en blanco sobre el cuerpo gris del panel").toContain("bg-white");
  });

  it("el shell del POS enfoca en teal, no en el azul del sistema", () => {
    const layout = readFileSync(join(POS, "layout.tsx"), "utf8");
    expect(
      layout,
      "El wrapper del POS debe fijar --ring a --pos-primario para que buscador, selects y botones enfoquen en teal",
    ).toContain("[--ring:var(--pos-primario)]");
    expect(layout, "El comentario del riel debe decir 52 px, la medida real de Alegra").not.toContain("56 px");
  });

  it("los archivos del POS no usan --primary ni #1e56c7 salvo los pendientes", () => {
    const infractores = ARCHIVOS.filter((ruta) => MARCA_AZUL.test(readFileSync(ruta, "utf8"))).map(rutaRelativa);
    const nuevos = infractores.filter((archivo) => !PENDIENTES.includes(archivo));

    expect(
      nuevos,
      `Estos archivos usan el azul de Medoxigas; cámbialos por tokens pos-*: ${nuevos.join(", ")}`,
    ).toEqual([]);
    expect(infractores, "La lista PENDIENTES tiene archivos de más o alguno ya está migrado: actualízala").toEqual(
      [...PENDIENTES].sort(),
    );
  });

  it("el modal Pagar factura muestra una sola línea «Por cobrar» y el toast de Alegra", () => {
    const checkout = readFileSync(join(POS, "_components", "vender", "checkout-pos.tsx"), "utf8");

    expect(
      checkout.match(/Por cobrar:/g)?.length ?? 0,
      "«Por cobrar» debe aparecer una sola vez, bajo el TOTAL; no repitas el resumen en el modo combinado",
    ).toBe(1);
    expect(
      checkout,
      "El CTA Cobrar no puede deshabilitarse por Consumidor Final: el aviso sale como toast al pulsar y se intercepta antes de completarVenta",
    ).toContain("if (porCobrarVisible && esConsumidorFinal)");
    expect(checkout, "El toast del POS debe ser local y anunciarse con role=alert").toContain('role="alert"');
    expect(
      checkout,
      "El toast debe llevar el título exacto de Alegra: «Algunos campos necesitan tu atención»",
    ).toContain("Algunos campos necesitan tu atención");
    expect(checkout, "El toast debe explicar qué revisar antes de guardar").toContain(
      "Revisa los campos marcados antes de guardar.",
    );

    const inicioCta = checkout.indexOf("const ctaDeshabilitado");
    const finCta = checkout.indexOf(";", inicioCta);
    expect(
      checkout.slice(inicioCta, finCta),
      "Quita (hayCredito && esConsumidorFinal) de ctaDeshabilitado: el toast nunca saldría",
    ).not.toContain("esConsumidorFinal");

    const intercepto = checkout.indexOf("setAviso(true)");
    const escritura = checkout.indexOf("await completarVenta(entrada)");
    expect(intercepto, "cobrar() debe mostrar el toast cuando falta el cliente").toBeGreaterThan(-1);
    expect(
      intercepto,
      "El toast debe mostrarse ANTES de llamar a completarVenta: no se escribe nada si falta el cliente",
    ).toBeLessThan(escritura);
  });

  it("el modal Pagar factura conserva Vendedor y no revive el bloque de crédito viejo", () => {
    const checkout = readFileSync(join(POS, "_components", "vender", "checkout-pos.tsx"), "utf8");

    for (const texto of ["Queda a crédito", "Aplicado a la venta", "Cliente para el crédito"]) {
      expect(
        checkout,
        `El modal ya no muestra «${texto}»: usa una sola línea «Por cobrar» bajo el TOTAL y el toast de Alegra`,
      ).not.toContain(texto);
    }
    expect(
      checkout,
      "El aviso rojo inline de Consumidor Final se reemplazó por el toast «Algunos campos necesitan tu atención»",
    ).not.toContain("No se puede vender a crédito al Consumidor Final");

    expect(checkout, "El selector Vendedor debe seguir dentro de CamposCobro").toContain('id="cobro-vendedor"');
    expect(checkout.indexOf('id="cobro-vendedor"'), "Vendedor va arriba de Observaciones, como Alegra").toBeLessThan(
      checkout.indexOf("Observaciones"),
    );
    expect(checkout, "El placeholder del Vendedor es «Seleccionar»").toContain("Seleccionar");
  });

  it("globals.css define la paleta POS (--pos-*) en claro y oscuro", () => {
    const css = readFileSync(GLOBALS, "utf8");
    const tokens = [
      "--pos-primario",
      "--pos-primario-hover",
      "--pos-acento",
      "--pos-acento-texto",
      "--pos-oscuro",
      "--pos-linea",
      "--pos-panel",
      "--pos-texto",
      "--pos-texto-suave",
      "--pos-icono",
    ];

    for (const token of tokens) {
      expect(css, `Falta ${token} en globals.css`).toContain(`${token}:`);
      expect(css, `Falta el alias --color-${token.slice(2)} en @theme`).toContain(`--color-${token.slice(2)}:`);
    }
    expect(css, "El teal de Alegra #00b19d debe estar en globals.css").toContain("#00b19d");
  });
});
