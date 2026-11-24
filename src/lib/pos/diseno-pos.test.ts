import { describe, expect, it } from "vitest";

import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("el menú del POS es plano: cinco enlaces, sin grupos ni submenús", () => {
    const menu = readFileSync(join(POS, "_components", "menu-pos.tsx"), "utf8");
    const estilos = readFileSync(join(POS, "_components", "menu-pos-estilos.ts"), "utf8");
    const inicio = menu.indexOf("const ITEMS_PRINCIPALES");
    const fin = menu.indexOf("const ITEMS_CONTABILIDAD");
    const bloque = menu.slice(inicio, fin);

    expect(inicio, "No se encontró ITEMS_PRINCIPALES en menu-pos.tsx").toBeGreaterThan(-1);
    expect(fin, "No se encontró ITEMS_CONTABILIDAD después de ITEMS_PRINCIPALES").toBeGreaterThan(inicio);

    const etiquetas = [...bloque.matchAll(/etiqueta: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
    expect(
      etiquetas,
      "El menú del POS es plano (decisión de Waldy, 23-11-2026): deja exactamente Facturar, Ventas, Pagos, Turnos y Devoluciones en ese orden, sin grupos «Ingresos» ni «Historial de turnos».",
    ).toEqual(["Facturar", "Ventas", "Pagos", "Turnos", "Devoluciones"]);

    const enlaces = [...bloque.matchAll(/href: "([^"]+)"/g)].map((coincidencia) => coincidencia[1]);
    expect(
      enlaces,
      "Los cinco enlaces planos deben apuntar a /pos, /pos/historial, /pos/pagos, /pos/turnos y /pos/devoluciones, en ese orden.",
    ).toEqual(["/pos", "/pos/historial", "/pos/pagos", "/pos/turnos", "/pos/devoluciones"]);

    for (const texto of ["Ingresos", "Historial de turnos", "Historial de ventas", "Registro de pagos"]) {
      expect(
        menu,
        `No vuelvas a agrupar el menú del POS: quita «${texto}» y deja el enlace plano con su nombre visible (Ventas, Pagos, Turnos).`,
      ).not.toContain(texto);
    }

    for (const pieza of ["ItemSeccion", "sub:", "Collapsible", "ChevronDown"]) {
      expect(
        menu,
        `El menú del POS no tiene submenús ni acordeones (decisión de Waldy, 23-11-2026); quita «${pieza}» y deja los cinco enlaces al mismo nivel.`,
      ).not.toContain(pieza);
    }

    expect(
      estilos,
      "Elimina itemMenuSeccion de menu-pos-estilos.ts: ya no hay títulos de grupo en el menú plano del POS.",
    ).not.toContain("itemMenuSeccion");
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

  it("las hojas móviles ganan su ancho real y el carrito no borra al tacto", () => {
    const menu = readFileSync(join(POS, "_components", "menu-pos.tsx"), "utf8");
    expect(
      menu,
      "El cajón del menú debe medir 271 px reales: el w-[271px]! le gana al data-[side=left]:w-3/4 de sheet.tsx",
    ).toContain("w-[271px]!");

    const vender = readFileSync(join(POS, "_components", "vender", "vender-pos.tsx"), "utf8");
    expect(
      vender,
      "La factura móvil debe ocupar todo el ancho: el w-full! le gana al data-[side=right]:w-3/4 de sheet.tsx",
    ).toContain("w-full!");
    expect(vender, "En pantallas sm la factura conserva su max-w de 420 px").toContain("sm:max-w-[420px]!");

    const pagos = readFileSync(join(POS, "_components", "pagos", "pagos-pos.tsx"), "utf8");
    expect(pagos, "El detalle de pagos móvil debe ocupar todo el ancho, no el 75% de sheet.tsx").toContain("w-full!");
    expect(pagos, "En pantallas sm el detalle de pagos conserva su max-w de 480 px").toContain("sm:max-w-[480px]!");

    const linea = readFileSync(join(POS, "_components", "vender", "linea-carrito-pos.tsx"), "utf8");
    expect(
      linea,
      "En táctil (hover: none) el lápiz/papelera no debe mostrarse: un tap sobre el total no puede borrar la línea; quitar vive en el editor",
    ).toContain("[@media(hover:none)]:hidden");
    expect(
      linea,
      "El input de cantidad debe medir 60 px para mostrar 1234.56 completo sin romper el stepper",
    ).toContain("h-9 w-[60px]");
    expect(
      linea,
      "La columna del total no puede ser fija en 112 px: usa un mínimo y deja que crezca con importes largos",
    ).toContain("min-w-[112px]");
    expect(linea, "La fila no vuelve a la columna fija de 112 px que se montaba sobre el +").not.toMatch(
      /flex h-10 w-\[112px\] shrink-0/,
    );
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

  it("«Nuevo pago» del POS es el de Alegra (tarjeta de tipo + formulario), no el «Registrar movimiento» viejo", () => {
    const dialogo = readFileSync(join(POS, "_components", "pagos", "dialogo-movimiento.tsx"), "utf8");

    for (const texto of [
      "Nuevo pago",
      "Selecciona el tipo de movimiento",
      "Gastos generales",
      "Pago a factura de proveedor",
      "Cuenta contable",
      "Total a pagar",
      "/300",
    ]) {
      expect(dialogo, `Falta «${texto}» en el modal «Nuevo pago» (PLAN POS 2, Punto 5)`).toContain(texto);
    }

    expect(
      dialogo,
      "El modal viejo se titulaba «Registrar movimiento»; el diseño de Alegra dice «Nuevo pago»",
    ).not.toContain("Registrar movimiento");
    expect(
      dialogo,
      "El selector visible de «Motivo» ya no va: el tipo se elige en las tarjetas Ingreso/Egreso",
    ).not.toContain("motivo-movimiento");
    expect(dialogo, "Ingreso va en verde (decisión de Waldy), no en blanco como Alegra").toContain("bg-emerald-600");
    expect(dialogo, "Egreso va en rojo (decisión de Waldy), no en blanco como Alegra").toContain("bg-rose-600");
    expect(dialogo, "La pestaña de proveedor debe explicar que no está disponible, sin inventar el cobro").toContain(
      "No disponible en el POS todavía",
    );
    expect(
      dialogo,
      "El botón «Inverso» llega con `prellenado`: debe abrir directo el formulario sin las tarjetas de tipo",
    ).toContain("prellenado === null");
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

  it("las pestañas de venta muestran ⋮ en las extra, renombran y nunca eliminan la principal", () => {
    const archivo = readFileSync(join(POS, "_components", "vender", "pestanas-venta-pos.tsx"), "utf8");

    expect(archivo, "La pestaña activa debe mostrar siempre el ⋮ (opacity-100), y las demás al hover/foco").toMatch(
      /seleccionada\s*\?\s*"[^"]*opacity-100/,
    );
    expect(archivo, "Las pestañas inactivas muestran el ⋮ al hover o al foco").toContain("group-hover:opacity-100");
    expect(archivo, "El menú de la pestaña usa el icono MoreVertical").toContain("MoreVertical");
    expect(
      archivo,
      "El menú ⋮ debe abrir hacia arriba (side=top): la barra de pestañas está al pie y si abre abajo se corta «Eliminar».",
    ).toContain('side="top"');
    expect(archivo, "El menú debe ofrecer Renombrar").toContain("Renombrar");
    expect(archivo, "El menú debe ofrecer Eliminar en las pestañas extra").toContain("Eliminar");

    const bloqueMenu = archivo.slice(
      archivo.indexOf("<DropdownMenuContent"),
      archivo.indexOf("</DropdownMenuContent>"),
    );
    expect(
      bloqueMenu,
      "«Venta principal» nunca puede eliminar: envuelve «Eliminar» en {principal ? null : (...)}",
    ).toMatch(/\{principal \? null : \([\s\S]*Eliminar[\s\S]*\)\}/);
    expect(archivo, "La principal se detecta con esPestanaPrincipal, no comparando el texto del nombre").toContain(
      "esPestanaPrincipal",
    );

    const inicioClick = archivo.indexOf("onClick={() => {", archivo.indexOf('variant="destructive"'));
    const clickEliminar = archivo.slice(inicioClick, archivo.indexOf("}}", inicioClick));
    expect(clickEliminar, "Una pestaña extra sin productos se elimina de inmediato").toContain(
      "pestana.lineas.length === 0",
    );
    expect(clickEliminar, "Una pestaña extra sin productos se elimina de inmediato").toContain(
      "eliminarPestana(pestana.id)",
    );
    expect(clickEliminar, "Una pestaña extra con productos pide confirmación").toContain("setEliminando(pestana.id)");
    expect(
      clickEliminar.indexOf("eliminarPestana(pestana.id)"),
      "La confirmación solo se abre cuando la pestaña extra tiene productos: primero el borrado inmediato",
    ).toBeLessThan(clickEliminar.indexOf("setEliminando(pestana.id)"));

    expect(archivo, "La pestaña mide 160 px como Alegra").toContain("w-[160px]");
    expect(archivo, "La pestaña conserva el icono Basket").toContain("Basket");
    expect(archivo, "La pestaña activa conserva el borde teal").toContain("border-b-pos-primario");
    expect(archivo, "La pestaña conserva el fondo blanco").toContain("bg-white");
    expect(archivo, "La pestaña conserva el dark mode").toContain("dark:bg-card");
    expect(archivo, "La barra conserva el botón + de nueva venta").toContain('aria-label="Nueva venta"');
  });

  it("«Venta simple» no vuelve al POS: ni tarjeta, ni diálogo, ni atajo F4", () => {
    for (const archivo of ["tarjeta-venta-simple-pos.tsx", "dialogo-venta-simple.tsx"]) {
      expect(
        existsSync(join(POS, "_components", "vender", archivo)),
        `Waldy eliminó «Venta simple» del POS (24-11-2026): ${archivo} no existe y no se revive.`,
      ).toBe(false);
    }

    const prohibido = [
      "Venta simple",
      "Venta rápida",
      "TarjetaVentaSimplePos",
      "DialogoVentaSimple",
      "onVentaSimple",
      "agregarLineaLibre",
      "F4",
    ];
    for (const archivo of [
      "_components/vender/catalogo-pos.tsx",
      "_components/vender/panel-factura.tsx",
      "_components/vender/vender-pos.tsx",
      "_components/carrito-pos-provider.tsx",
    ]) {
      const codigo = readFileSync(join(POS, archivo), "utf8");
      for (const texto of prohibido) {
        expect(
          codigo,
          `«Venta simple» y su atajo F4 no vuelven al POS (decisión de Waldy, 24-11-2026): quita «${texto}» de ${archivo}.`,
        ).not.toContain(texto);
      }
    }
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
    expect(
      impresion,
      "El vencimiento va siempre en el encabezado, como Alegra, aunque coincida con la fecha",
    ).toContain("Vencimiento:");

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
