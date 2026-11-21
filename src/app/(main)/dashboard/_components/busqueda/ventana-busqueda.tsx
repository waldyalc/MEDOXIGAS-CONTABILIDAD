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
  TrendingUp,
  UserPlus,
  Wallet,
} from "@/components/icons";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { Rol } from "@/lib/auth/rol";
import { buscarGlobal, buscarGlobalPorCategoria } from "@/lib/busqueda/consultas";
import { rutaDeResultado } from "@/lib/busqueda/rutas";
import type { RespuestaBusqueda } from "@/lib/busqueda/tipos";
import { getLocalStorageValue, setLocalStorageValue } from "@/lib/local-storage.client";
import { REPORTES } from "@/lib/reportes/catalogo-reportes";
import { filtrarItemsPorRol } from "@/navigation/sidebar/sidebar-items";

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
/**
 * Recientes en localStorage con el formato de siempre, `{titulo, url}` (§2.5):
 * los que guardó el diálogo viejo se siguen leyendo. Tope 8, dedupe por url.
 */
const MAX_RECIENTES = 8;
const MINIMO_BUSQUEDA = 2;

/** Debounce de la consulta mientras se escribe (§3.6): ágil sin hacer spam de peticiones. */
const DEBOUNCE_BUSQUEDA_MS = 150;

/** Caché LRU en memoria (§3.6): 10 entradas que valen 60 segundos. */
const MAX_ENTRADAS_CACHE = 10;
const TTL_CACHE_MS = 60_000;

/** «Ver más» avanza de 20 en 20: el límite de categoría de la RPC (§3.5). */
const PASO_VER_MAS = 20;

/** Con categoría fijada el servidor ya paginó y «Ver más» acumula: el cliente no recorta (§1.5). */
const SIN_LIMITE = Number.POSITIVE_INFINITY;

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

/** Enlace del fallback (§1.9): página del menú lateral o reporte del catálogo. */
interface Enlace {
  id: string;
  titulo: string;
  url: string;
  /** Módulo del menú al que pertenece (solo subítems de navegación). */
  modulo?: string;
  icono: typeof Search;
}

/** Enlaces de navegación del menú lateral, aplanados a una sola lista. */
function enlacesDeNavegacion(rol: Rol | null): Enlace[] {
  const enlaces: Enlace[] = [];

  for (const grupo of filtrarItemsPorRol(rol)) {
    for (const item of grupo.items) {
      if (item.subItems == null) {
        enlaces.push({ id: item.id, titulo: item.title, url: item.url, icono: item.icon ?? Search });
        continue;
      }

      for (const subItem of item.subItems) {
        if (subItem.disabled) continue;
        enlaces.push({
          id: subItem.id,
          titulo: subItem.title,
          url: subItem.url,
          modulo: item.title,
          icono: item.icon ?? Search,
        });
      }
    }
  }

  return enlaces;
}

/** Reportes del catálogo con ruta; los que aún no la tienen quedan fuera (como en el diálogo viejo). */
const ENLACES_REPORTES: Enlace[] = REPORTES.flatMap((reporte) =>
  reporte.href == null
    ? []
    : [{ id: `reporte-${reporte.href}`, titulo: reporte.nombre, url: reporte.href, icono: TrendingUp }],
);

/** Suma los `total` de los grupos de entidad de la RPC por categoría del rail (§1.4). */
function totalesPorGrupoDe(respuesta: RespuestaBusqueda): Partial<Record<GrupoBusqueda, number>> {
  const totales: Partial<Record<GrupoBusqueda, number>> = {};
  for (const grupo of respuesta.grupos) {
    totales[grupo.grupo] = (totales[grupo.grupo] ?? 0) + grupo.total;
  }
  return totales;
}

/** Une una página de «Ver más» a la respuesta acumulada, sin repetir (entidad, id) (§2.7). */
function combinarRespuestas(anterior: RespuestaBusqueda | null, pagina: RespuestaBusqueda): RespuestaBusqueda {
  if (anterior == null) return pagina;

  const acumulados = new Map(anterior.grupos.map((grupo) => [grupo.entidad, grupo.resultados]));
  const grupos = pagina.grupos.map((grupo) => {
    const previos = acumulados.get(grupo.entidad);
    if (previos == null) return grupo;
    const vistos = new Set(previos.map(claveResultado));
    const nuevos = grupo.resultados.filter((resultado) => !vistos.has(claveResultado(resultado)));
    return { ...grupo, resultados: [...previos, ...nuevos] };
  });

  return { grupos, total: pagina.total, hayMas: pagina.hayMas, ms: pagina.ms };
}

/** Entrada de la caché LRU (§3.6): la respuesta completa y cuándo vence. */
interface EntradaCache {
  respuesta: RespuestaBusqueda;
  expira: number;
}

/**
 * Clave de la caché: término + categoría (§3.6). Con «recientes» la ventana
 * llama a la misma RPC que sin categoría (modo «todos»), así que comparten
 * clave. El separador NUL no se puede teclear: no hay colisiones.
 */
function claveCache(termino: string, categoria: CategoriaRail | null): string {
  if (categoria == null || categoria === "recientes") return termino;
  return `${termino}\u0000${categoria}`;
}

/**
 * Lee la caché barriendo primero las entradas vencidas (§3.6). Al acertar,
 * reinserta la entrada al final del Map: el orden de inserción hace de LRU.
 */
function leerCache(cache: Map<string, EntradaCache>, clave: string): RespuestaBusqueda | null {
  const ahora = Date.now();
  for (const [claveEntrada, entrada] of cache) {
    if (entrada.expira <= ahora) cache.delete(claveEntrada);
  }

  const entrada = cache.get(clave);
  if (entrada == null) return null;
  cache.delete(clave);
  cache.set(clave, entrada);
  return entrada.respuesta;
}

/** Guarda la respuesta completa y desaloja la entrada más vieja si sobran (§3.6). */
function guardarEnCache(cache: Map<string, EntradaCache>, clave: string, respuesta: RespuestaBusqueda) {
  cache.delete(clave);
  cache.set(clave, { respuesta, expira: Date.now() + TTL_CACHE_MS });

  if (cache.size > MAX_ENTRADAS_CACHE) {
    for (const claveMasVieja of cache.keys()) {
      cache.delete(claveMasVieja);
      break;
    }
  }
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

    return datos
      .flatMap((valor): Reciente[] => {
        if (typeof valor !== "object" || valor == null) return [];
        const { titulo, url } = valor as { titulo?: unknown; url?: unknown };
        if (typeof titulo !== "string" || typeof url !== "string") return [];
        return [{ titulo, url }];
      })
      .slice(0, MAX_RECIENTES);
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

/**
 * Tope de tarjetas por grupo (§1.5 y §1.11). Con categoría fijada el servidor
 * ya paginó (20 por entidad) y «Ver más» acumula: no se recorta en el cliente.
 */
function limiteSegunModo(modo: ModoVentana, categoriaFijada: boolean): number {
  if (categoriaFijada) return SIN_LIMITE;
  return modo === "movil" ? 3 : LIMITE_TODOS;
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
 * inferior con chips. Consulta la RPC `buscar_global` con debounce (§3.6) y,
 * si no responde, se queda con el fallback: recientes, navegación y reportes.
 */
export function VentanaBusqueda({ abierto, onCambiarApertura, rol = null }: Props) {
  const router = useRouter();
  const modo = useModoVentana();
  const [texto, setTexto] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaRail | null>(null);
  const [recientes, setRecientes] = React.useState<Reciente[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const [cargandoMas, setCargandoMas] = React.useState(false);
  /** Última respuesta de la RPC; `null` = no se pudo buscar (§1.9). */
  const [respuesta, setRespuesta] = React.useState<RespuestaBusqueda | null>(null);
  /** Conteos exactos por categoría del rail (respuesta.grupos[].total, §1.4). */
  const [totalesRail, setTotalesRail] = React.useState<Partial<Record<GrupoBusqueda, number>>>({});
  /** Página actual de «Ver más»: 0, 20, 40… (§3.5). */
  const [desplazamiento, setDesplazamiento] = React.useState(0);
  const [indiceActivo, setIndiceActivo] = React.useState(-1);
  const [placeholderIA, setPlaceholderIA] = React.useState(false);
  const [atajo, setAtajo] = React.useState("Ctrl");
  /** Número de la última solicitud: descarta respuestas que llegan tarde (§3.6). */
  const secuencia = React.useRef(0);
  /** Término de la última consulta: al cambiar, los conteos viejos ya no valen. */
  const terminoAnterior = React.useRef("");
  /** Caché LRU de búsquedas (§3.6) en un ref: no se pierde al re-renderizar. */
  const cacheBusqueda = React.useRef(new Map<string, EntradaCache>());
  /** AbortController de la petición en vuelo: se aborta al cambiar el término (§3.6). */
  const controlador = React.useRef<AbortController | null>(null);

  const termino = texto.trim();
  /**
   * Texto diferido (§3.6): el input responde al instante y el panel (fallback,
   * recientes y tarjetas) re-renderiza con prioridad baja, aunque haya 40+.
   */
  const textoDiferido = React.useDeferredValue(texto);
  const terminoDiferido = textoDiferido.trim();
  const buscando = termino.length >= MINIMO_BUSQUEDA;
  const categoriaFijada = categoria != null && categoria !== "recientes";
  const puedeCrear = rol === "admin" || rol === "contador";
  const enlaces = React.useMemo(() => enlacesDeNavegacion(rol), [rol]);

  React.useEffect(() => {
    if (esMac()) setAtajo("⌘");
  }, []);

  React.useEffect(() => {
    if (!abierto) return;
    setRecientes(leerRecientes());
    setCategoria(null);
    setIndiceActivo(-1);
    // Reabrir conserva la última consulta de la sesión; el foco y la selección
    // del texto son inmediatos, sin depender solo del autoFocus (§1.3).
    const entrada = document.querySelector<HTMLInputElement>("input[data-busqueda]");
    entrada?.focus();
    entrada?.select();
  }, [abierto]);

  // Consulta a buscar_global (§3.6): mínimo 2 caracteres (al abrir, con el
  // input vacío, no se toca la base), debounce de 150 ms, caché LRU en memoria
  // y cancelación con AbortController + contador de secuencia. Mientras llega
  // la respuesta nueva, los resultados viejos se quedan visibles. `null` (error
  // de red o RPC ausente) deja el fallback sin mostrar error (§1.9).
  React.useEffect(() => {
    if (!abierto || !buscando) {
      secuencia.current += 1;
      controlador.current?.abort();
      controlador.current = null;
      setCargando(false);
      setCargandoMas(false);
      setRespuesta(null);
      setTotalesRail({});
      return;
    }

    const esCategoria = categoria != null && categoria !== "recientes";
    const numero = secuencia.current + 1;
    secuencia.current = numero;
    const cambioTermino = terminoAnterior.current !== termino;
    terminoAnterior.current = termino;

    setDesplazamiento(0);
    // Con categoría fijada la RPC solo devuelve ese grupo: los conteos del
    // resto se conservan para que el rail no muestre ceros falsos; si cambió
    // el término, ya no valen y se limpian.
    if (cambioTermino && esCategoria) setTotalesRail({});

    const clave = claveCache(termino, categoria);
    const enCache = leerCache(cacheBusqueda.current, clave);
    if (enCache != null) {
      // Caché fresca (§3.6): repetir la misma búsqueda pinta al instante, con
      // 0 ms de red y sin esperar el debounce; se cancela lo que volara.
      controlador.current?.abort();
      controlador.current = null;
      setCargando(false);
      setRespuesta(enCache);
      setTotalesRail((anterior) => {
        const suma = totalesPorGrupoDe(enCache);
        return esCategoria ? { ...anterior, ...suma } : suma;
      });
      return;
    }

    // Sin caché: `cargando` deja los resultados anteriores en pantalla,
    // atenuados con la barra superior; skeletons solo la primera vez.
    setCargando(true);

    const temporizador = setTimeout(() => {
      // La server action no acepta un AbortSignal (no es serializable), así
      // que la cancelación es local: el abort marca la bandera y el contador
      // de secuencia descarta la respuesta tardía (§3.6).
      controlador.current?.abort();
      const controller = new AbortController();
      controlador.current = controller;

      const accion =
        esCategoria && categoria != null ? buscarGlobalPorCategoria(termino, categoria) : buscarGlobal(termino);

      accion
        .then((resultado) => {
          if (controller.signal.aborted || secuencia.current !== numero) return;
          setCargando(false);
          setRespuesta(resultado);
          if (resultado != null) {
            guardarEnCache(cacheBusqueda.current, clave, resultado);
            setTotalesRail((anterior) => {
              const suma = totalesPorGrupoDe(resultado);
              return esCategoria ? { ...anterior, ...suma } : suma;
            });
          }
        })
        .catch(() => {
          if (controller.signal.aborted || secuencia.current !== numero) return;
          setCargando(false);
          setRespuesta(null);
        });
    }, DEBOUNCE_BUSQUEDA_MS);

    return () => clearTimeout(temporizador);
  }, [abierto, buscando, termino, categoria]);

  // Al desmontar la ventana se cancela la petición que quede en vuelo (§3.6).
  React.useEffect(() => () => controlador.current?.abort(), []);

  // Sugerencia rotativa del placeholder a los 4 s; se detiene al primer carácter (§1.3).
  React.useEffect(() => {
    if (texto !== "") return;
    const temporizador = setInterval(() => setPlaceholderIA((alterno) => !alterno), 4000);
    return () => clearInterval(temporizador);
  }, [texto]);

  // Resultados planos con ruta (§2.1): `documento` (fase 4) aún no tiene a
  // dónde navegar, así que no se pinta como tarjeta.
  const resultados = React.useMemo(() => {
    const planos: ResultadoBusqueda[] = [];
    for (const grupo of respuesta?.grupos ?? []) {
      for (const resultado of grupo.resultados) {
        if (rutaDeResultado(resultado) != null) planos.push(resultado);
      }
    }
    return planos;
  }, [respuesta]);

  const limitePorGrupo = limiteSegunModo(modo, categoriaFijada);
  const grupos = React.useMemo(() => {
    const agrupados = agrupar(resultados, { limitePorGrupo });
    // agrupar solo conoce las filas recibidas; el total exacto lo trae la RPC.
    return agrupados.map((grupo) => ({ ...grupo, total: totalesRail[grupo.grupo] ?? grupo.total }));
  }, [limitePorGrupo, resultados, totalesRail]);
  const total = respuesta?.total ?? 0;

  const gruposVisibles = React.useMemo(
    () => (categoriaFijada ? grupos.filter((grupo) => grupo.grupo === categoria) : grupos),
    [categoria, categoriaFijada, grupos],
  );

  // Con la categoría «Recientes» la búsqueda es local (§2.5) y usa el término
  // diferido para no frenar el input (§3.6).
  const recientesFiltrados = React.useMemo(() => {
    if (categoria !== "recientes" || !buscando) return recientes;
    const patron = normalizar(terminoDiferido);
    return recientes.filter((reciente) => normalizar(reciente.titulo).includes(patron));
  }, [buscando, categoria, recientes, terminoDiferido]);
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
      // La lista ya se filtró por resultados con ruta; `?? ""` solo satisface el tipo.
      gruposVisibles.flatMap((grupo) =>
        grupo.resultados.map((resultado) => ({ resultado, url: rutaDeResultado(resultado) ?? "" })),
      ),
    [gruposVisibles],
  );

  const conteos = React.useMemo(
    () => ({ recientes: recientes.length, ...totalesRail }),
    [recientes.length, totalesRail],
  );

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

  /** «Ver más» (§3.5): pide la siguiente página de 20 y la acumula sin repetir. */
  function verMas() {
    if (respuesta == null || categoria == null || categoria === "recientes" || cargandoMas) return;

    const numero = secuencia.current + 1;
    secuencia.current = numero;
    controlador.current?.abort();
    const controller = new AbortController();
    controlador.current = controller;
    const siguiente = desplazamiento + PASO_VER_MAS;
    setCargandoMas(true);

    buscarGlobalPorCategoria(termino, categoria, siguiente)
      .then((pagina) => {
        setCargandoMas(false);
        // Llegó tarde o se canceló (§3.6): manda la consulta nueva.
        if (controller.signal.aborted || secuencia.current !== numero) return;
        // Falló: se conserva lo acumulado y el botón permite reintentar (§1.9).
        if (pagina == null) return;
        setDesplazamiento(siguiente);
        setRespuesta((anterior) => combinarRespuestas(anterior, pagina));
        setTotalesRail((anterior) => ({ ...anterior, ...totalesPorGrupoDe(pagina) }));
      })
      .catch(() => {
        // Error silencioso (§1.9): se conserva lo acumulado y se puede reintentar.
        setCargandoMas(false);
      });
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
      termino={terminoDiferido}
      buscando={buscando}
      cargando={cargando}
      cargandoMas={cargandoMas}
      categoria={categoria}
      grupos={gruposVisibles}
      inicios={inicios}
      total={total}
      respuesta={respuesta}
      recientes={categoria === "recientes" ? recientesFiltrados : recientes}
      enlaces={enlaces}
      puedeCrear={puedeCrear}
      indiceActivo={indiceActivo}
      onAbrir={abrir}
      onAbrirReciente={abrirReciente}
      onNavegar={navegar}
      onVerTodos={(grupo) => {
        setCategoria(grupo);
        setIndiceActivo(-1);
      }}
      onVerMas={verMas}
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

/**
 * Barra sutil de 2 px arriba del panel (§3.6): avisa que llegan resultados
 * nuevos sin tapar los viejos. Es absoluta, para no mover el contenido, y
 * solo anima la opacidad: sin desplazamientos.
 */
function BarraCarga() {
  return <div aria-hidden="true" className="bg-primary/70 absolute inset-x-0 top-0 h-0.5 animate-pulse" />;
}

interface PropsContenidoPanel {
  modo: ModoVentana;
  termino: string;
  buscando: boolean;
  cargando: boolean;
  cargandoMas: boolean;
  categoria: CategoriaRail | null;
  grupos: GrupoResultados[];
  inicios: number[];
  total: number;
  respuesta: RespuestaBusqueda | null;
  recientes: Reciente[];
  enlaces: Enlace[];
  puedeCrear: boolean;
  indiceActivo: number;
  onAbrir: (resultado: ResultadoBusqueda, url: string) => void;
  onAbrirReciente: (reciente: Reciente) => void;
  onNavegar: (url: string) => void;
  onVerTodos: (grupo: GrupoBusqueda) => void;
  onVerMas: () => void;
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
    cargandoMas,
    categoria,
    grupos,
    inicios,
    total,
    respuesta,
    recientes,
    enlaces,
    puedeCrear,
    indiceActivo,
    onAbrir,
    onAbrirReciente,
    onNavegar,
    onVerTodos,
    onVerMas,
    onQuitarFiltro,
    onSugerir,
    onEnfocarTarjeta,
  } = props;

  const columnas = modo === "escritorio" ? "grid-cols-2" : "grid-cols-1";
  const categoriaFijada = categoria != null && categoria !== "recientes";
  // «Recientes» es local (§2.5): ni barra de conteo ni indicador de carga.
  const esLocal = categoria === "recientes";
  const conResultados = buscando && grupos.length > 0 && !esLocal;
  // Stale-while-revalidate (§3.6): refrescando con los resultados viejos aún en pantalla.
  const refrescando = cargando && grupos.length > 0 && !esLocal;
  const textoAria = textoVivo(buscando, cargando, total, grupos.length, termino);

  function contenido() {
    // Con «Recientes» la lista es local (§2.5): se pinta al instante, sin
    // esperar la RPC que solo actualiza los conteos del rail.
    if (categoria === "recientes") {
      return <SeccionRecientes recientes={recientes} onAbrir={onAbrirReciente} modo={modo} />;
    }

    // Skeletons solo la primera vez, cuando no hay resultados previos (§1.9):
    // después, los viejos se quedan visibles mientras llega la respuesta (§3.6).
    if (cargando && grupos.length === 0) {
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

    // La RPC no respondió (error de red o ausente): fallback silencioso con lo
    // que no depende de la base (§1.9).
    if (respuesta == null) {
      return (
        <FallbackBusqueda
          termino={termino}
          recientes={recientes}
          enlaces={enlaces}
          modo={modo}
          conFiltro={categoriaFijada}
          onAbrirReciente={onAbrirReciente}
          onNavegar={onNavegar}
          onQuitarFiltro={onQuitarFiltro}
        />
      );
    }

    if (grupos.length === 0) {
      return <EstadoSinResultados termino={termino} conFiltro={categoriaFijada} onQuitarFiltro={onQuitarFiltro} />;
    }

    return grupos.map((grupo, indiceGrupo) => (
      <SeccionGrupo
        key={grupo.grupo}
        grupo={grupo}
        inicio={inicios[indiceGrupo] ?? 0}
        modo={modo}
        categoriaFijada={categoriaFijada}
        hayMas={respuesta?.hayMas ?? false}
        cargandoMas={cargandoMas}
        indiceActivo={indiceActivo}
        onAbrir={onAbrir}
        onVerTodos={onVerTodos}
        onVerMas={onVerMas}
        onEnfocarTarjeta={onEnfocarTarjeta}
      />
    ));
  }

  return (
    <div id="resultados-busqueda" className={cn("relative flex flex-col gap-4", modo === "movil" ? "p-4" : "p-5")}>
      {refrescando ? <BarraCarga /> : null}
      <p className="sr-only" aria-live="polite">
        {textoAria}
      </p>

      {/*
        Stale-while-revalidate (§3.6): mientras llega la respuesta nueva, los
        resultados viejos se quedan visibles, atenuados (opacity-70).
      */}
      <div className={cn("flex flex-col gap-4", refrescando && "opacity-70")}>
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
    </div>
  );
}

/** Grupo de resultados (§1.5): cabecera sticky con conteo, tarjetas y «Ver más»/«Ver todos →». */
function SeccionGrupo({
  grupo,
  inicio,
  modo,
  categoriaFijada,
  hayMas,
  cargandoMas,
  indiceActivo,
  onAbrir,
  onVerTodos,
  onVerMas,
  onEnfocarTarjeta,
}: {
  grupo: GrupoResultados;
  inicio: number;
  modo: ModoVentana;
  categoriaFijada: boolean;
  hayMas: boolean;
  cargandoMas: boolean;
  indiceActivo: number;
  onAbrir: (resultado: ResultadoBusqueda, url: string) => void;
  onVerTodos: (grupo: GrupoBusqueda) => void;
  onVerMas: () => void;
  onEnfocarTarjeta: (indice: number) => void;
}) {
  const Icono = ICONO_CATEGORIA[grupo.grupo];
  const columnas = modo === "escritorio" ? "grid-cols-2" : "grid-cols-1";

  return (
    <section className="flex flex-col gap-2">
      <div
        className={cn(
          "bg-popover sticky top-0 z-10 flex h-9 items-center gap-2",
          modo === "movil" ? "-mx-4 px-4" : "-mx-5 px-5",
        )}
      >
        <Icono className="text-muted-foreground size-4 shrink-0" />
        <h3 className="text-[13px] font-semibold">{NOMBRE_CATEGORIAS[grupo.grupo]}</h3>
        <span className="text-muted-foreground text-xs tabular-nums">{grupo.total}</span>
        {!categoriaFijada && grupo.total > grupo.resultados.length ? (
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
              // La lista ya se filtró por resultados con ruta (§2.1).
              url={rutaDeResultado(resultado) ?? ""}
              activa={indiceActivo === inicio + indice}
              compacta={modo === "movil"}
              onAbrir={onAbrir}
              onFocus={() => onEnfocarTarjeta(inicio + indice)}
            />
          </li>
        ))}
      </ul>
      {categoriaFijada && hayMas ? (
        <button
          type="button"
          onClick={onVerMas}
          disabled={cargandoMas}
          className="text-primary mx-auto h-9 rounded-lg px-4 text-xs hover:underline disabled:opacity-50"
        >
          {cargandoMas ? "Cargando más…" : "Ver más"}
        </button>
      ) : null}
    </section>
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

/**
 * Fallback (§1.9): la RPC no respondió (error de red o ausente) y la ventana
 * se queda con lo que no depende de la base — recientes, navegación y reportes
 * filtrados por el término — sin mostrar ningún error al usuario.
 */
function FallbackBusqueda({
  termino,
  recientes,
  enlaces,
  modo,
  conFiltro,
  onAbrirReciente,
  onNavegar,
  onQuitarFiltro,
}: {
  termino: string;
  recientes: Reciente[];
  enlaces: Enlace[];
  modo: ModoVentana;
  conFiltro: boolean;
  onAbrirReciente: (reciente: Reciente) => void;
  onNavegar: (url: string) => void;
  onQuitarFiltro: () => void;
}) {
  const patron = normalizar(termino);
  const recientesCoincidentes = recientes.filter((reciente) => normalizar(reciente.titulo).includes(patron));
  const navegacion = enlaces.filter((enlace) =>
    normalizar([enlace.titulo, enlace.modulo ?? ""].join(" ")).includes(patron),
  );
  const reportes = ENLACES_REPORTES.filter((enlace) => normalizar(enlace.titulo).includes(patron));

  if (recientesCoincidentes.length === 0 && navegacion.length === 0 && reportes.length === 0) {
    return <EstadoSinResultados termino={termino} conFiltro={conFiltro} onQuitarFiltro={onQuitarFiltro} />;
  }

  return (
    <div className="flex flex-col gap-5">
      {recientesCoincidentes.length > 0 ? (
        <SeccionRecientes recientes={recientesCoincidentes} onAbrir={onAbrirReciente} modo={modo} />
      ) : null}
      {navegacion.length > 0 ? <SeccionEnlaces titulo="Ir a" enlaces={navegacion} onNavegar={onNavegar} /> : null}
      {reportes.length > 0 ? <SeccionEnlaces titulo="Reportes" enlaces={reportes} onNavegar={onNavegar} /> : null}
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

/** Enlaces del fallback (navegación o reportes), con el mismo molde de las acciones rápidas. */
function SeccionEnlaces({
  titulo,
  enlaces,
  onNavegar,
}: {
  titulo: string;
  enlaces: Enlace[];
  onNavegar: (url: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[13px] font-semibold">{titulo}</h3>
      <ul className="grid grid-cols-2 gap-2">
        {enlaces.map((enlace) => (
          <li key={enlace.id}>
            <a
              href={enlace.url}
              onClick={(evento) => abrirConEnlace(evento, () => onNavegar(enlace.url))}
              className="bg-muted/40 hover:bg-muted flex h-10 items-center gap-2 rounded-[10px] px-3"
            >
              <enlace.icono className="text-muted-foreground size-4 shrink-0" />
              <span className="truncate text-[13px]">{enlace.titulo}</span>
              {enlace.modulo ? (
                <span className="text-muted-foreground ml-auto truncate text-[11px]">{enlace.modulo}</span>
              ) : null}
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
  onQuitarFiltro?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Search className="text-muted-foreground/60 size-8" />
      <p className="text-sm font-semibold">Sin resultados para «{termino}»</p>
      <p className="text-muted-foreground text-xs">Prueba con el NCF, el número o el nombre del cliente.</p>
      {conFiltro && onQuitarFiltro != null ? (
        <button type="button" onClick={onQuitarFiltro} className="text-primary mt-1 text-xs hover:underline">
          Quitar filtros
        </button>
      ) : null}
    </div>
  );
}
