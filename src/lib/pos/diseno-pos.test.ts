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
  "_components/vender/checkout-pos.tsx",
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

  it("el menú del POS no vuelve a las flechitas: los subitems quedan siempre visibles", () => {
    const menu = readFileSync(join(POS, "_components", "menu-pos.tsx"), "utf8");
    expect(
      menu,
      "El menú no usa Collapsible: Ingresos y Turnos son secciones con sus subitems siempre visibles al expandir (decisión de Waldy, POS 2). Quita el acordeón y deja los enlaces bajo su sección.",
    ).not.toContain("Collapsible");
    expect(
      menu,
      "No vuelvas a poner la flecha de abrir/cerrar: el menú muestra Historial de ventas, Registro de pagos e Historial de turnos sin un clic extra.",
    ).not.toContain("ChevronDown");
    expect(menu, "Falta la sección Ingresos con Historial de ventas y Registro de pagos").toContain(
      "Historial de ventas",
    );
    expect(menu, "Falta la sección Turnos con Historial de turnos").toContain("Historial de turnos");
    expect(menu, "El título de sección debe usar itemMenuSeccion (sin hover de enlace)").toContain("itemMenuSeccion");
  });

  it("la línea del carrito es una sola fila: stepper grande, total solo y acciones flotantes", () => {
    const linea = readFileSync(join(POS, "_components", "vender", "linea-carrito-pos.tsx"), "utf8");
    expect(
      linea,
      "La fila del carrito debe medir 76 px de alto (min-h-[76px]); no vuelvas a apilar el lápiz y la papelera bajo el total.",
    ).toContain("min-h-[76px]");
    expect(linea, "El nombre del producto va en 14 px negrita").toContain("text-sm leading-5 font-bold");
    expect(linea, "El total va en 15 px negrita").toContain("text-[15px] leading-5 font-bold");
    expect(linea, "El stepper usa botones de 36 px (size-9) con iconos de 18 px").toMatch(/size-9/);
    expect(
      linea,
      "Lápiz y papelera deben aparecer flotando sobre el total al hover/foco (absolute + group-hover/precio:opacity-100), sin agregar renglones ni altura a la fila.",
    ).toMatch(/absolute[^"]*group-hover\/precio:opacity-100/);
    expect(
      linea,
      "La fila no puede volver al bloque apilado del total con las acciones debajo (w-[86px] flex-col).",
    ).not.toContain("flex w-[86px] shrink-0 flex-col");
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

  it("el ticket de 80 mm usa @page con alto fijo y el orden de Alegra", () => {
    const ticket = readFileSync(join(SRC, "components", "pos", "ticket-pos.tsx"), "utf8");
    const impresion = readFileSync(join(SRC, "lib", "pos", "impresion.ts"), "utf8");

    expect(
      ticket,
      "Chrome ignora «size: 80mm auto» y cae a Letter: el @page del ticket lleva alto fijo (250 mm)",
    ).toContain("size: 80mm 250mm");
    expect(ticket, "El ticket de 57 mm también necesita alto fijo").toContain("size: 57mm 250mm");
    expect(ticket).not.toContain("size: 80mm auto");
    expect(ticket).not.toContain("size: 57mm auto");

    for (const archivo of [ticket, impresion]) {
      expect(archivo, "El ticket no puede llevar la marca de Alegra ni datos de OXYMAT").not.toMatch(
        /Generado en Alegra POS|OXYMAT/i,
      );
    }

    expect(impresion, "El ticket lleva «Total recibido: RD$X» debajo del Total, no un bloque «Pagos»").toContain(
      "Total recibido",
    );
    expect(impresion, "El método de pago va en el encabezado («Método de pago: Efectivo»)").toContain(
      "Método de pago:",
    );

    const factura = impresion.slice(
      impresion.indexOf("export function armarTicketFactura"),
      impresion.indexOf("export function armarTicketCotizacion"),
    );
    for (const linea of ["Terminal:", "Turno No", "Cajero:"]) {
      expect(
        factura,
        `La factura del POS no imprime «${linea}» (Alegra no lo muestra; cierre/recibos sí conservan su contexto)`,
      ).not.toContain(linea);
    }
  });
});
