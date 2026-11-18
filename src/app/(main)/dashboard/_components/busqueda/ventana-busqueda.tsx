"use client";

import type { MouseEvent } from "react";
import * as React from "react";

import { useRouter } from "next/navigation";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import {
  Banknote,
  BookOpen,
  FilePlus2,
  PackagePlus,
  Receipt,
  Search,
  ShoppingCart,
  Sparkles,
  UserPlus,
  Wallet,
} from "lucide-react";

import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Rol } from "@/lib/auth/rol";
import {
  rutaAsiento,
  rutaCompra,
  rutaContacto,
  rutaCuenta,
  rutaFactura,
  rutaGasto,
  rutaNotaCreditoVenta,
  rutaOrdenCompra,
  rutaPagoProveedor,
  rutaPagoRecibido,
  rutaProducto,
} from "@/lib/enlaces";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";

import {
  agrupar,
  claveResultado,
  type GrupoBusqueda,
  type GrupoResultados,
  LIMITE_TODOS,
  type ResultadoBusqueda,
} from "./agrupar";
import { type CategoriaRail, ICONO_CATEGORIA, NOMBRE_CATEGORIAS, RailCategorias } from "./rail-categorias";
import { TarjetaResultado } from "./tarjeta-resultado";

const CLAVE_RECIENTES = "medoxigas.busqueda.recientes";
/** Mismo formato y tope que el diálogo actual: los recientes viejos se leen igual (§2.5). */
const MAX_RECIENTES = 5;
const MINIMO_BUSQUEDA = 2;

/** Espera simulada mientras no exista la RPC: deja ver el estado de carga. */
const ESPERA_BUSQUEDA_MS = 300;

const PLACEHOLDER = "Busca facturas, clientes, NCF, montos…";
/** Sugerencia rotativa a los 4 s sin escribir (§1.3). */
const PLACEHOLDER_SUGERENCIA = "Busca «factura de Pedro en octubre»";

const SUGERENCIAS = ["factura de Pedro en octubre", "B0100000123", "compras de la semana pasada"];

/** Acciones rápidas del estado vacío (§1.7): abren formularios que ya existen. */
const ACCIONES_RAPIDAS: { titulo: string; url: string; icono: typeof Search }[] = [
  { titulo: "Nueva factura", url: "/dashboard/facturacion/nueva", icono: FilePlus2 },
  { titulo: "Nueva compra", url: "/dashboard/compras/nueva", icono: ShoppingCart },
  { titulo: "Registrar pago", url: "/dashboard/pagos-recibidos/nuevo", icono: Wallet },
  { titulo: "Pago a proveedor", url: "/dashboard/compras/pagos/nuevo", icono: Banknote },
  { titulo: "Nuevo gasto", url: "/dashboard/gastos/nuevo", icono: Receipt },
  { titulo: "Nuevo asiento", url: "/dashboard/contabilidad/asientos/nuevo", icono: BookOpen },
  { titulo: "Nuevo contacto", url: "/dashboard/contactos?nuevo=1", icono: UserPlus },
  { titulo: "Nuevo producto", url: "/dashboard/productos?nuevo=1", icono: PackagePlus },
];

interface Reciente {
  titulo: string;
  url: string;
}

/**
 * Datos de ejemplo de la fase 1 (§5.7): la ventana se publica antes de la RPC
 * y estos datos dejan clavar medidas, grupos y estados sin depender de la base.
 * TODO: conectar a buscar_global cuando exista la RPC; entonces se borran estos
 * datos y el filtro local, y las rutas salen de src/lib/busqueda/rutas.ts.
 */
const RESULTADOS_EJEMPLO: (ResultadoBusqueda & { url: string })[] = [
  // — Clientes (contactos)
  {
    entidad: "contacto",
    id: "ejemplo-pedro",
    titulo: "Pedro Pérez",
    subtitulo: "1-01-12345-6",
    etiquetas: ["809-555-1234"],
    estado: { texto: "Cliente", tono: "info" },
    fecha: null,
    monto: null,
    rango: 2,
    url: rutaContacto("ejemplo-pedro"),
  },
  {
    entidad: "contacto",
    id: "ejemplo-oxymat",
    titulo: "OXYMAT SRL",
    subtitulo: "131488791",
    etiquetas: ["809-555-0199"],
    estado: { texto: "Proveedor", tono: "neutro" },
    fecha: null,
    monto: null,
    rango: 2,
    url: rutaContacto("ejemplo-oxymat"),
  },
  {
    entidad: "contacto",
    id: "ejemplo-farmacia",
    titulo: "Farmacia del Sol",
    subtitulo: "00112345678",
    etiquetas: ["809-333-2211"],
    estado: { texto: "Cliente", tono: "info" },
    fecha: null,
    monto: null,
    rango: 3,
    url: rutaContacto("ejemplo-farmacia"),
  },
  // — Productos
  {
    entidad: "producto",
    id: "ejemplo-ox200",
    titulo: "Cilindro de oxígeno 200 bar",
    subtitulo: "OX-200",
    etiquetas: ["ITBIS 18 %"],
    estado: { texto: "Producto", tono: "neutro" },
    fecha: null,
    monto: "3500.00",
    rango: 2,
    url: rutaProducto("ejemplo-ox200"),
  },
  {
    entidad: "producto",
    id: "ejemplo-nitrogeno",
    titulo: "Nitrógeno líquido por litro",
    subtitulo: "NL-001",
    etiquetas: ["ITBIS 18 %"],
    estado: { texto: "Producto", tono: "neutro" },
    fecha: null,
    monto: "180.00",
    rango: 3,
    url: rutaProducto("ejemplo-nitrogeno"),
  },
  {
    entidad: "producto",
    id: "ejemplo-transporte",
    titulo: "Transporte de cilindros",
    subtitulo: "SERV-01",
    etiquetas: ["Exento"],
    estado: { texto: "Servicio", tono: "info" },
    fecha: null,
    monto: "1200.00",
    rango: 3,
    url: rutaProducto("ejemplo-transporte"),
  },
  // — Facturación
  {
    entidad: "factura",
    id: "ejemplo-f123",
    titulo: "B0100000123",
    subtitulo: "Pedro Pérez · 12/10/2026",
    etiquetas: ["01 · Crédito fiscal"],
    estado: { texto: "Cobrada", tono: "exito" },
    fecha: "2026-10-12",
    monto: "4500.00",
    rango: 1,
    url: rutaFactura("ejemplo-f123"),
  },
  {
    entidad: "factura",
    id: "ejemplo-f124",
    titulo: "B0100000124",
    subtitulo: "Pedro Pérez · 03/10/2026",
    etiquetas: ["01 · Crédito fiscal"],
    estado: { texto: "Por cobrar", tono: "pendiente" },
    fecha: "2026-10-03",
    monto: "1200.00",
    rango: 2,
    url: rutaFactura("ejemplo-f124"),
  },
  {
    entidad: "factura",
    id: "ejemplo-f118",
    titulo: "B0100000118",
    subtitulo: "OXYMAT SRL · 28/09/2026",
    etiquetas: ["02 · Consumo"],
    estado: { texto: "Cobrada", tono: "exito" },
    fecha: "2026-09-28",
    monto: "18750.00",
    rango: 3,
    url: rutaFactura("ejemplo-f118"),
  },
  {
    entidad: "nota_credito_venta",
    id: "ejemplo-nc31",
    titulo: "B0400000031",
    subtitulo: "Pedro Pérez · 15/10/2026",
    etiquetas: ["Nota de crédito"],
    estado: { texto: "Anulada", tono: "peligro" },
    fecha: "2026-10-15",
    monto: "450.00",
    rango: 4,
    url: rutaNotaCreditoVenta("ejemplo-nc31"),
  },
  {
    entidad: "pago_recibido",
    id: "ejemplo-pr66",
    titulo: "N.º 66",
    subtitulo: "OXYMAT SRL · 05/11/2026",
    etiquetas: ["Transferencia"],
    estado: { texto: "Registrado", tono: "exito" },
    fecha: "2026-11-05",
    monto: "18750.00",
    rango: 4,
    url: rutaPagoRecibido("ejemplo-pr66"),
  },
  // — Compras
  {
    entidad: "factura_proveedor",
    id: "ejemplo-cp99",
    titulo: "B0104500099",
    subtitulo: "Oxígeno RD SRL · 10/11/2026",
    etiquetas: ["01 · Crédito fiscal"],
    estado: { texto: "Pagada", tono: "exito" },
    fecha: "2026-11-10",
    monto: "22400.00",
    rango: 2,
    url: rutaCompra("ejemplo-cp99"),
  },
  {
    entidad: "gasto_menor",
    id: "ejemplo-gasto1",
    titulo: "B1300000001",
    subtitulo: "Almuerzo de la oficina · 14/11/2026",
    etiquetas: ["Gasto menor"],
    estado: { texto: "Registrado", tono: "exito" },
    fecha: "2026-11-14",
    monto: "1850.00",
    rango: 4,
    url: rutaGasto("ejemplo-gasto1"),
  },
  {
    entidad: "pago_proveedor",
    id: "ejemplo-pp45",
    titulo: "N.º 45",
    subtitulo: "Oxígeno RD SRL · 08/11/2026",
    etiquetas: ["Cheque"],
    estado: { texto: "Registrado", tono: "exito" },
    fecha: "2026-11-08",
    monto: "15000.00",
    rango: 4,
    url: rutaPagoProveedor("ejemplo-pp45"),
  },
  {
    entidad: "orden_compra",
    id: "ejemplo-oc210",
    titulo: "N.º 210",
    subtitulo: "Oxígeno RD SRL · 02/11/2026",
    etiquetas: ["Orden de compra"],
    estado: { texto: "Pendiente", tono: "pendiente" },
    fecha: "2026-11-02",
    monto: "9800.00",
    rango: 4,
    url: rutaOrdenCompra("ejemplo-oc210"),
  },
  // — Otros
  {
    entidad: "asiento",
    id: "ejemplo-a4210",
    titulo: "N.º 4210",
    subtitulo: "Venta B0100000123 · 12/10/2026",
    etiquetas: [],
    estado: { texto: "Automático", tono: "info" },
    fecha: "2026-10-12",
    monto: "4500.00",
    rango: 4,
    url: rutaAsiento("ejemplo-a4210"),
  },
  {
    entidad: "cuenta",
    id: "ejemplo-cuenta1103",
    titulo: "1103",
    subtitulo: "Efectivo y equivalentes",
    etiquetas: ["Activo"],
    estado: { texto: "Detalle", tono: "neutro" },
    fecha: null,
    monto: null,
    rango: 4,
    url: rutaCuenta("ejemplo-cuenta1103"),
  },
  {
    entidad: "reporte",
    id: "ejemplo-ventas-producto",
    titulo: "Ventas por producto",
    subtitulo: "Reportes · Ventas",
    etiquetas: [],
    estado: null,
    fecha: null,
    monto: null,
    rango: 5,
    url: "/dashboard/reportes/ventas-producto",
  },
];

const URLS_EJEMPLO = new Map<string, string>(RESULTADOS_EJEMPLO.map((r) => [claveResultado(r), r.url]));

/** En fase 1 la ruta viene embebida en los datos de ejemplo (TODO: src/lib/busqueda/rutas.ts). */
function urlEjemplo(resultado: ResultadoBusqueda): string {
  return URLS_EJEMPLO.get(claveResultado(resultado)) ?? "/dashboard";
}

type ModoVentana = "movil" | "compacta" | "escritorio";

const MEDIA_MOVIL = "(max-width: 767px)";
/** Escritorio: ≥ 1024 de ancho y ≥ 780 de alto (§1.1). */
const MEDIA_ESCRITORIO = "(min-width: 1024px) and (min-height: 780px)";

function useModoVentana(): ModoVentana {
  const [modo, setModo] = React.useState<ModoVentana>("compacta");

  React.useEffect(() => {
    const pantallaMovil = window.matchMedia(MEDIA_MOVIL);
    const pantallaEscritorio = window.matchMedia(MEDIA_ESCRITORIO);

    function actualizar() {
      if (pantallaMovil.matches) {
        setModo("movil");
        return;
      }
      setModo(pantallaEscritorio.matches ? "escritorio" : "compacta");
    }

    actualizar();
    pantallaMovil.addEventListener("change", actualizar);
    pantallaEscritorio.addEventListener("change", actualizar);
    return () => {
      pantallaMovil.removeEventListener("change", actualizar);
      pantallaEscritorio.removeEventListener("change", actualizar);
    };
  }, []);

  return modo;
}

function esMac(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function leerRecientes(): Reciente[] {
  const crudo = getLocalStorageValue(CLAVE_RECIENTES);
  if (crudo == null) return [];

  try {
    const datos: unknown = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];

    return datos.flatMap((valor): Reciente[] => {
      if (typeof valor !== "object" || valor == null) return [];
      const { titulo, url } = valor as { titulo?: unknown; url?: unknown };
      if (typeof titulo !== "string" || typeof url !== "string") return [];
      return [{ titulo, url }];
    });
  } catch {
    return [];
  }
}

function guardarReciente(reciente: Reciente) {
  const anteriores = leerRecientes().filter((item) => item.url !== reciente.url);
  setLocalStorageValue(CLAVE_RECIENTES, JSON.stringify([reciente, ...anteriores].slice(0, MAX_RECIENTES)));
}

const MODULOS: Record<string, string> = {
  contactos: "Contactos",
  productos: "Productos",
  facturacion: "Facturación",
  notas: "Notas",
  cotizaciones: "Cotizaciones",
  conduces: "Conduces",
  compras: "Compras",
  gastos: "Gastos",
  pagos: "Pagos",
  contabilidad: "Contabilidad",
  reportes: "Reportes",
  bancos: "Bancos",
};

/** Tope de tarjetas por grupo según el modo (§1.5 y §1.11). */
function limiteSegunModo(modo: ModoVentana, categoria: CategoriaRail | null): number {
  if (modo === "movil") return 3;
  if (categoria != null) return 20;
  return LIMITE_TODOS;
}

/** Texto del `aria-live` de resultados (§1.9). */
function textoVivo(buscando: boolean, cargando: boolean, total: number, grupos: number, termino: string): string {
  if (!buscando || cargando) return "";
  if (total === 0) return `Sin resultados para ${termino}`;
  return `${total} resultados en ${grupos} ${grupos === 1 ? "grupo" : "grupos"}`;
}

/** Etiqueta del módulo derivada de la URL del reciente (no inventa datos). */
function moduloDeUrl(url: string): string {
  const parte = url.split("?")[0]?.split("/")[2] ?? "";
  return MODULOS[parte] ?? "Página";
}

/** Deja que ⌘/clic central abra pestañas nuevas y captura el clic normal (§1.6). */
function abrirConEnlace(evento: MouseEvent<HTMLAnchorElement>, onAbrir: () => void) {
  if (evento.defaultPrevented) return;
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  evento.preventDefault();
  onAbrir();
}

interface Props {
  abierto: boolean;
  onCambiarApertura: (abierto: boolean) => void;
  /** Las acciones rápidas solo se muestran a admin y contador (§1.7). */
  rol?: Rol | null;
}

/**
 * Ventana flotante de búsqueda global (870 × 690, §1.1–1.2): cabecera de 64 px
 * con input, rail de categorías de 190 px, panel de grupos con tarjetas de
 * 313 × 76 y pie de atajos de 40 px. En móvil (< 768) se vuelve un sheet
 * inferior con chips. Fase 1: funciona con datos de ejemplo y recientes.
 */
export function VentanaBusqueda({ abierto, onCambiarApertura, rol = null }: Props) {
  const router = useRouter();
  const modo = useModoVentana();
  const [texto, setTexto] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaRail | null>(null);
  const [recientes, setRecientes] = React.useState<Reciente[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const [indiceActivo, setIndiceActivo] = React.useState(-1);
  const [placeholderIA, setPlaceholderIA] = React.useState(false);
  const [atajo, setAtajo] = React.useState("Ctrl");

  const termino = texto.trim();
  const buscando = termino.length >= MINIMO_BUSQUEDA;
  const puedeCrear = rol === "admin" || rol === "contador";

  React.useEffect(() => {
    if (esMac()) setAtajo("⌘");
  }, []);

  React.useEffect(() => {
    if (!abierto) return;
    setRecientes(leerRecientes());
    setCategoria(null);
    setIndiceActivo(-1);
    // Reabrir conserva la última consulta de la sesión y la selecciona (§1.3).
    document.querySelector<HTMLInputElement>("input[data-busqueda]")?.select();
  }, [abierto]);

  // TODO: reemplazar la espera por la server action de buscar_global
  // (debounce 250 ms + AbortController + caché LRU, §3.6).
  React.useEffect(() => {
    if (!abierto || !buscando) {
      setCargando(false);
      return;
    }
    setCargando(true);
    const temporizador = setTimeout(() => setCargando(false), ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(temporizador);
  }, [abierto, buscando]);

  // Sugerencia rotativa del placeholder a los 4 s; se detiene al primer carácter (§1.3).
  React.useEffect(() => {
    if (texto !== "") return;
    const temporizador = setInterval(() => setPlaceholderIA((alterno) => !alterno), 4000);
    return () => clearInterval(temporizador);
  }, [texto]);

  // TODO: conectar a buscar_global cuando exista la RPC; mientras, filtro local sobre los datos de ejemplo.
  const resultados = React.useMemo(() => {
    if (!buscando) return [];
    const patron = normalizar(termino);
    return RESULTADOS_EJEMPLO.filter((resultado) =>
      normalizar([resultado.titulo, resultado.subtitulo, resultado.etiquetas.join(" ")].join(" ")).includes(patron),
    );
  }, [buscando, termino]);

  const limitePorGrupo = limiteSegunModo(modo, categoria);
  const grupos = React.useMemo(() => agrupar(resultados, { limitePorGrupo }), [resultados, limitePorGrupo]);
  const total = React.useMemo(() => grupos.reduce((suma, grupo) => suma + grupo.total, 0), [grupos]);

  const gruposVisibles = React.useMemo(
    () =>
      categoria != null && categoria !== "recientes" ? grupos.filter((grupo) => grupo.grupo === categoria) : grupos,
    [categoria, grupos],
  );

  // Con la categoría «Recientes» la búsqueda es local (§2.5).
  const recientesFiltrados = React.useMemo(() => {
    if (categoria !== "recientes" || !buscando) return recientes;
    const patron = normalizar(termino);
    return recientes.filter((reciente) => normalizar(reciente.titulo).includes(patron));
  }, [buscando, categoria, recientes, termino]);
  const inicios = React.useMemo(() => {
    let acumulado = 0;
    return gruposVisibles.map((grupo) => {
      const inicio = acumulado;
      acumulado += grupo.resultados.length;
      return inicio;
    });
  }, [gruposVisibles]);

  const tarjetas = React.useMemo(
    () =>
      gruposVisibles.flatMap((grupo) =>
        grupo.resultados.map((resultado) => ({ resultado, url: urlEjemplo(resultado) })),
      ),
    [gruposVisibles],
  );

  const conteos = React.useMemo(() => {
    const mapa: Partial<Record<CategoriaRail, number>> = { recientes: recientes.length };
    for (const grupo of grupos) mapa[grupo.grupo] = grupo.total;
    return mapa;
  }, [grupos, recientes]);

  React.useEffect(() => {
    if (indiceActivo >= tarjetas.length) setIndiceActivo(tarjetas.length - 1);
  }, [indiceActivo, tarjetas.length]);

  function abrir(resultado: ResultadoBusqueda, url: string) {
    guardarReciente({ titulo: resultado.titulo, url });
    onCambiarApertura(false);
    router.push(url);
  }

  function abrirReciente(reciente: Reciente) {
    guardarReciente(reciente);
    onCambiarApertura(false);
    router.push(reciente.url);
  }

  function navegar(url: string) {
    onCambiarApertura(false);
    router.push(url);
  }

  function elegirCategoria(siguiente: CategoriaRail) {
    setCategoria((anterior) => (anterior === siguiente ? null : siguiente));
    setIndiceActivo(-1);
  }

  function sugerir(sugerencia: string) {
    setTexto(sugerencia);
    document.querySelector<HTMLInputElement>("input[data-busqueda]")?.focus();
  }

  /** Teclado (§1.10): ↑↓ roving focus, ↵ abre, ⌘↵ pestaña nueva. */
  function alTeclar(evento: React.KeyboardEvent<HTMLElement>) {
    if (manejarFlechas(evento)) return;
    manejarEnter(evento);
  }

  function manejarFlechas(evento: React.KeyboardEvent<HTMLElement>): boolean {
    if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return false;
    if (tarjetas.length === 0) return true;
    evento.preventDefault();

    const raiz = evento.currentTarget;
    const elementos = Array.from(raiz.querySelectorAll<HTMLAnchorElement>("a[data-tarjeta]"));
    if (elementos.length === 0) return true;

    const siguiente = evento.key === "ArrowDown" ? Math.min(indiceActivo + 1, elementos.length - 1) : indiceActivo - 1;

    // Desde la primera tarjeta (o el input) con ↑ el foco vuelve al input.
    if (siguiente < 0) {
      setIndiceActivo(-1);
      raiz.querySelector<HTMLInputElement>("input[data-busqueda]")?.focus();
      return true;
    }

    setIndiceActivo(siguiente);
    elementos[siguiente]?.focus();
    return true;
  }

  function manejarEnter(evento: React.KeyboardEvent<HTMLElement>) {
    if (evento.key !== "Enter") return;

    const esEntrada = evento.target instanceof Element && evento.target.matches("input[data-busqueda]");
    const enPestañaNueva = evento.metaKey || evento.ctrlKey;

    // Enter sobre una tarjeta o botón lo resuelve el navegador (el <a> hace clic).
    if (!enPestañaNueva && !esEntrada) return;
    evento.preventDefault();

    const tarjeta = tarjetas[Math.max(indiceActivo, 0)];
    if (tarjeta == null) return;

    if (enPestañaNueva) {
      guardarReciente({ titulo: tarjeta.resultado.titulo, url: tarjeta.url });
      window.open(tarjeta.url, "_blank", "noopener");
      return;
    }
    abrir(tarjeta.resultado, tarjeta.url);
  }

  const cabecera = (
    <CabeceraBusqueda
      texto={texto}
      placeholder={placeholderIA ? PLACEHOLDER_SUGERENCIA : PLACEHOLDER}
      onCambiarTexto={setTexto}
    />
  );

  const panel = (
    <ContenidoPanel
      modo={modo}
      termino={termino}
      buscando={buscando}
      cargando={cargando}
      categoria={categoria}
      grupos={gruposVisibles}
      inicios={inicios}
      total={total}
      recientes={categoria === "recientes" ? recientesFiltrados : recientes}
      puedeCrear={puedeCrear}
      indiceActivo={indiceActivo}
      onAbrir={abrir}
      onAbrirReciente={abrirReciente}
      onNavegar={navegar}
      onVerTodos={(grupo) => {
        setCategoria(grupo);
        setIndiceActivo(-1);
      }}
      onQuitarFiltro={() => setCategoria(null)}
      onSugerir={sugerir}
      onEnfocarTarjeta={setIndiceActivo}
    />
  );

  const railDialogo = (
    <RailCategorias conteos={conteos} activa={categoria} onElegir={elegirCategoria} compacta={modo === "compacta"} />
  );

  const railChips = <RailCategorias variante="chips" conteos={conteos} activa={categoria} onElegir={elegirCategoria} />;

  if (modo === "movil") {
    return (
      <Sheet open={abierto} onOpenChange={onCambiarApertura}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          onKeyDown={alTeclar}
          className="flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)] data-[side=bottom]:h-[92dvh]"
        >
          <SheetTitle className="sr-only">Buscar en Medoxigas Contabilidad</SheetTitle>
          <div className="bg-muted mx-auto mt-2 h-1 w-9 shrink-0 rounded-full" aria-hidden="true" />
          <div className="border-border flex items-center gap-2 border-b p-3 dark:border-white/10">
            <div className="min-w-0 flex-1">{cabecera}</div>
            <button
              type="button"
              onClick={() => onCambiarApertura(false)}
              className="text-muted-foreground h-11 shrink-0 px-3 text-sm"
            >
              Cancelar
            </button>
          </div>
          {railChips}
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{panel}</div>
          <div className="text-muted-foreground border-border flex h-8 shrink-0 items-center justify-center border-t text-xs dark:border-white/10">
            Toca para abrir · mantén pulsado para acciones
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={onCambiarApertura}>
      <DialogPortal>
        {/*
          El overlay de DialogContent no admite el black/40 · black/55 de §1.1 sin
          tocar components/ui ni globals.css (decisión D3 de docs/busqueda-global.md),
          así que la ventana compone su propio overlay y popup con las medidas exactas.
        */}
        <DialogOverlay className="z-[60] bg-black/40 backdrop-blur-[2px] supports-backdrop-filter:backdrop-blur-[2px] dark:bg-black/55" />
        <DialogPrimitive.Popup
          onKeyDown={alTeclar}
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 z-[60] flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl text-sm shadow-2xl ring-1 duration-100 outline-none dark:ring-white/10",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            modo === "escritorio"
              ? "h-[690px] w-[870px]"
              : "h-[min(620px,calc(100dvh_-_32px))] w-[min(660px,calc(100vw_-_32px))]",
          )}
        >
          <DialogTitle className="sr-only">Buscar en Medoxigas Contabilidad</DialogTitle>
          <DialogDescription className="sr-only">
            Busca facturas, clientes, NCF, montos o navega a módulos y reportes.
          </DialogDescription>

          <header className="border-border flex h-16 shrink-0 items-center gap-3 border-b px-5 dark:border-white/10">
            <div className="min-w-0 flex-1">{cabecera}</div>
            <button
              type="button"
              onClick={() => onCambiarApertura(false)}
              className="text-muted-foreground hover:bg-muted flex h-11 shrink-0 items-center rounded-lg px-2"
            >
              <Kbd>Esc</Kbd>
            </button>
          </header>

          <div className="flex min-h-0 flex-1">
            {railDialogo}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{panel}</div>
          </div>

          <PieAtajos atajo={atajo} />
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}

/** Cabecera de 64 px (§1.3): input de 44 px, chip IA decorativo y botón Esc. */
function CabeceraBusqueda({
  texto,
  placeholder,
  onCambiarTexto,
  className,
}: {
  texto: string;
  placeholder: string;
  onCambiarTexto: (texto: string) => void;
  className?: string;
}) {
  return (
    <InputGroup className={cn("bg-background dark:bg-input/30 h-11 rounded-[10px]", className)}>
      <InputGroupAddon align="inline-start">
        <Search className="size-4 shrink-0" />
      </InputGroupAddon>
      <InputGroupInput
        data-busqueda=""
        autoFocus
        value={texto}
        onChange={(evento) => onCambiarTexto(evento.target.value)}
        placeholder={placeholder}
        aria-label="Buscar en Medoxigas Contabilidad"
        role="combobox"
        aria-expanded="true"
        aria-controls="resultados-busqueda"
        aria-autocomplete="list"
        enterKeyHint="search"
      />
      <InputGroupAddon align="inline-end">
        {/* Decorativo por ahora: la interpretación con IA llega en una fase posterior (§4). */}
        <span
          aria-hidden="true"
          className="text-primary bg-primary/10 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
        >
          <Sparkles className="size-3" />
          IA
        </span>
      </InputGroupAddon>
    </InputGroup>
  );
}

function PieAtajos({ atajo }: { atajo: string }) {
  return (
    <footer className="text-muted-foreground border-border flex h-10 shrink-0 items-center gap-4 border-t px-5 text-xs dark:border-white/10">
      <span className="flex items-center gap-1">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> Mover
      </span>
      <span className="flex items-center gap-1">
        <Kbd>↵</Kbd> Abrir
      </span>
      <span className="flex items-center gap-1">
        <Kbd>{atajo}</Kbd>
        <Kbd>↵</Kbd> Pestaña nueva
      </span>
      <span className="flex items-center gap-1">
        <Kbd>Tab</Kbd> Categorías
      </span>
      <span className="ml-auto flex items-center gap-1">
        <Kbd>Esc</Kbd> Cerrar
      </span>
    </footer>
  );
}

interface PropsContenidoPanel {
  modo: ModoVentana;
  termino: string;
  buscando: boolean;
  cargando: boolean;
  categoria: CategoriaRail | null;
  grupos: GrupoResultados[];
  inicios: number[];
  total: number;
  recientes: Reciente[];
  puedeCrear: boolean;
  indiceActivo: number;
  onAbrir: (resultado: ResultadoBusqueda, url: string) => void;
  onAbrirReciente: (reciente: Reciente) => void;
  onNavegar: (url: string) => void;
  onVerTodos: (grupo: GrupoBusqueda) => void;
  onQuitarFiltro: () => void;
  onSugerir: (texto: string) => void;
  onEnfocarTarjeta: (indice: number) => void;
}

/** Panel derecho (§1.5–1.9): barra de conteo, grupos con cabecera sticky y estados. */
function ContenidoPanel(props: PropsContenidoPanel) {
  const {
    modo,
    termino,
    buscando,
    cargando,
    categoria,
    grupos,
    inicios,
    total,
    recientes,
    puedeCrear,
    indiceActivo,
    onAbrir,
    onAbrirReciente,
    onNavegar,
    onVerTodos,
    onQuitarFiltro,
    onSugerir,
    onEnfocarTarjeta,
  } = props;

  const columnas = modo === "escritorio" ? "grid-cols-2" : "grid-cols-1";
  const categoriaFijada = categoria != null && categoria !== "recientes";
  const conResultados = buscando && grupos.length > 0 && !cargando;
  const textoAria = textoVivo(buscando, cargando, total, grupos.length, termino);

  function contenido() {
    if (cargando) {
      return (
        <ul className={cn("grid gap-3", columnas)}>
          <li>
            <Skeleton className="h-[76px] w-full rounded-xl" />
          </li>
          <li>
            <Skeleton className="h-[76px] w-full rounded-xl" />
          </li>
          <li>
            <Skeleton className="h-[76px] w-full rounded-xl" />
          </li>
        </ul>
      );
    }

    if (categoria === "recientes") {
      return <SeccionRecientes recientes={recientes} onAbrir={onAbrirReciente} modo={modo} />;
    }

    if (!buscando) {
      if (termino.length === 1) {
        return (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground text-sm">Escribe al menos 2 letras.</p>
            <SeccionSugerencias onSugerir={onSugerir} />
          </div>
        );
      }
      return (
        <EstadoVacio
          recientes={recientes}
          puedeCrear={puedeCrear}
          modo={modo}
          onAbrirReciente={onAbrirReciente}
          onNavegar={onNavegar}
          onSugerir={onSugerir}
        />
      );
    }

    if (grupos.length === 0) {
      return <EstadoSinResultados termino={termino} conFiltro={categoriaFijada} onQuitarFiltro={onQuitarFiltro} />;
    }

    return grupos.map((grupo, indiceGrupo) => {
      const inicio = inicios[indiceGrupo] ?? 0;
      const Icono = ICONO_CATEGORIA[grupo.grupo];
      return (
        <section key={grupo.grupo} className="flex flex-col gap-2">
          <div
            className={cn(
              "bg-popover sticky top-0 z-10 flex h-9 items-center gap-2",
              modo === "movil" ? "-mx-4 px-4" : "-mx-5 px-5",
            )}
          >
            <Icono className="text-muted-foreground size-4 shrink-0" />
            <h3 className="text-[13px] font-semibold">{NOMBRE_CATEGORIAS[grupo.grupo]}</h3>
            <span className="text-muted-foreground text-xs tabular-nums">{grupo.total}</span>
            {grupo.total > grupo.resultados.length ? (
              <button
                type="button"
                onClick={() => onVerTodos(grupo.grupo)}
                className="text-primary ml-auto text-xs hover:underline"
              >
                Ver todos →
              </button>
            ) : null}
          </div>
          <ul className={cn("grid gap-3", columnas)}>
            {grupo.resultados.map((resultado, indice) => (
              <li key={claveResultado(resultado)}>
                <TarjetaResultado
                  resultado={resultado}
                  url={urlEjemplo(resultado)}
                  activa={indiceActivo === inicio + indice}
                  compacta={modo === "movil"}
                  onAbrir={onAbrir}
                  onFocus={() => onEnfocarTarjeta(inicio + indice)}
                />
              </li>
            ))}
          </ul>
        </section>
      );
    });
  }

  return (
    <div id="resultados-busqueda" className={cn("flex flex-col gap-4", modo === "movil" ? "p-4" : "p-5")}>
      <p className="sr-only" aria-live="polite">
        {textoAria}
      </p>

      {conResultados ? (
        <div className="flex h-9 shrink-0 items-center gap-2">
          {categoriaFijada && categoria != null ? (
            <>
              <span className="text-[13px] font-semibold">{NOMBRE_CATEGORIAS[categoria]}</span>
              <span className="text-muted-foreground text-xs tabular-nums">{grupos[0]?.total ?? 0}</span>
              <button type="button" onClick={onQuitarFiltro} className="text-primary ml-auto text-xs hover:underline">
                Quitar filtro
              </button>
            </>
          ) : (
            <span className="text-muted-foreground text-[13px]">
              Todos los resultados · <span className="tabular-nums">{total}</span>
            </span>
          )}
        </div>
      ) : null}

      {contenido()}
    </div>
  );
}

/** Estado vacío (§1.8): recientes, acciones rápidas y sugerencias. Nunca un panel en blanco. */
function EstadoVacio({
  recientes,
  puedeCrear,
  modo,
  onAbrirReciente,
  onNavegar,
  onSugerir,
}: {
  recientes: Reciente[];
  puedeCrear: boolean;
  modo: ModoVentana;
  onAbrirReciente: (reciente: Reciente) => void;
  onNavegar: (url: string) => void;
  onSugerir: (texto: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <SeccionRecientes recientes={recientes} onAbrir={onAbrirReciente} modo={modo} />
      {puedeCrear ? <SeccionAcciones onNavegar={onNavegar} /> : null}
      <SeccionSugerencias onSugerir={onSugerir} />
    </div>
  );
}

/** Recientes compactos de 148 × 64 (§1.8) o, con la categoría fijada, la lista filtrada. */
function SeccionRecientes({
  recientes,
  onAbrir,
  modo,
}: {
  recientes: Reciente[];
  onAbrir: (reciente: Reciente) => void;
  modo: ModoVentana;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold">Recientes</h3>
      {recientes.length === 0 ? (
        <p className="text-muted-foreground text-sm">Tus últimas búsquedas aparecerán aquí.</p>
      ) : (
        <ul className={cn("grid gap-3", modo === "escritorio" ? "grid-cols-4" : "grid-cols-2")}>
          {recientes.map((reciente) => (
            <li key={reciente.url}>
              <a
                href={reciente.url}
                onClick={(evento) => abrirConEnlace(evento, () => onAbrir(reciente))}
                className="bg-card ring-border hover:ring-ring/40 flex h-16 flex-col justify-center gap-0.5 rounded-xl px-3 ring-1 transition-colors dark:bg-white/[0.03] dark:ring-white/10"
              >
                <span className="truncate text-[13px] font-medium">{reciente.titulo}</span>
                <span className="text-muted-foreground truncate text-[11px]">{moduloDeUrl(reciente.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Acciones rápidas: 2 columnas × 4 filas de 40 px (§1.7). */
function SeccionAcciones({ onNavegar }: { onNavegar: (url: string) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold">Acciones rápidas</h3>
      <ul className="grid grid-cols-2 gap-2">
        {ACCIONES_RAPIDAS.map((accion) => (
          <li key={accion.url}>
            <a
              href={accion.url}
              onClick={(evento) => abrirConEnlace(evento, () => onNavegar(accion.url))}
              className="bg-muted/40 hover:bg-muted flex h-10 items-center gap-2 rounded-[10px] px-3"
            >
              <accion.icono className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate text-[13px]">{accion.titulo}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Sugerencias: 3 chips de 32 px que rellenan el input, no navegan (§1.8). */
function SeccionSugerencias({ onSugerir }: { onSugerir: (texto: string) => void }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold">Sugerencias</h3>
      <div className="flex flex-wrap gap-2">
        {SUGERENCIAS.map((sugerencia) => (
          <button
            key={sugerencia}
            type="button"
            onClick={() => onSugerir(sugerencia)}
            className="bg-muted/60 hover:bg-muted h-8 rounded-full px-3 text-xs"
          >
            {sugerencia}
          </button>
        ))}
      </div>
    </section>
  );
}

function EstadoSinResultados({
  termino,
  conFiltro,
  onQuitarFiltro,
}: {
  termino: string;
  conFiltro: boolean;
  onQuitarFiltro: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Search className="text-muted-foreground/60 size-8" />
      <p className="text-sm font-semibold">Sin resultados para «{termino}»</p>
      <p className="text-muted-foreground text-xs">Prueba con el NCF, el número o el nombre del cliente.</p>
      {conFiltro ? (
        <button type="button" onClick={onQuitarFiltro} className="text-primary mt-1 text-xs hover:underline">
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
