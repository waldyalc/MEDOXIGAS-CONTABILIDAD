"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { UnidadPos } from "@/lib/inventario/ferreteria/tipos";
import { almacenColaOffline, guardarOffline, leerOffline } from "@/lib/pos/almacen-offline";
import { calcularLineaPOS, sumarMontos, type TotalesCarritoPOS, type TotalesLineaPOS } from "@/lib/pos/calculo";
import { contactoDePestanaRestaurada } from "@/lib/pos/consumidor-final";
import { eliminarPestanaDe, ID_PESTANA_PRINCIPAL, renombrarPestanaEn } from "@/lib/pos/pestanas-venta";
import type { Decimal, ProductoPOS } from "@/lib/pos/tipos";

import { useOfflinePOS } from "./offline-pos-provider";

export const MAXIMO_PESTANAS = 8;

export interface LineaCarrito {
  id: string;
  productoId: string | null;
  descripcion: string;
  referencia: string | null;
  cantidad: Decimal;
  unidadId: string | null;
  unidadNombre: string | null;
  unidadBase: string | null;
  factorBase: Decimal | null;
  precio: Decimal;
  /** Precio de la unidad base con la lista vigente; permite volver a ella. */
  precioBase: Decimal | null;
  precioManual: boolean;
  descuentoPct: Decimal;
  itbisTasa: Decimal;
  impuestoId: string | null;
  unidades: UnidadPos[];
  tipo: string;
}

export interface PestanaVenta {
  id: string;
  nombre: string;
  lineas: LineaCarrito[];
  contactoId: string;
  listaPrecioId: string;
  numeracionId: string;
  vendedorId: string;
  cotizacion: { id: string; numero: number; fecha: string | null; vencimiento: string | null } | null;
}

export interface DefaultsVenta {
  contactoId: string;
  listaPrecioId: string;
  numeracionId: string;
}

interface ValorCarrito {
  pestanas: PestanaVenta[];
  activa: PestanaVenta;
  hayLineas: boolean;
  agregarProducto: (producto: ProductoPOS) => void;
  actualizarLinea: (lineaId: string, cambios: Partial<LineaCarrito>) => void;
  cambiarCantidad: (lineaId: string, cantidad: Decimal) => void;
  quitarLinea: (lineaId: string) => void;
  activarPestana: (id: string) => void;
  nuevaPestana: () => void;
  renombrarPestana: (id: string, nombre: string) => void;
  eliminarPestana: (id: string) => void;
  setContacto: (contactoId: string) => void;
  setLista: (listaPrecioId: string) => void;
  setNumeracion: (numeracionId: string) => void;
  setVendedor: (vendedorId: string) => void;
  aplicarCotizacion: (entrada: {
    id: string;
    numero: number;
    fecha: string | null;
    vencimiento: string | null;
    contactoId: string;
    listaPrecioId: string;
    lineas: {
      productoId: string | null;
      descripcion: string;
      referencia: string | null;
      cantidad: Decimal;
      unidadId: string | null;
      unidadNombre: string | null;
      precio: Decimal;
      descuentoPct: Decimal;
      itbisTasa: Decimal;
    }[];
  }) => void;
  quitarCotizacion: () => void;
  vaciarPestana: () => void;
  reiniciarTrasVenta: () => void;
  /** Vuelve a cargar en el carrito una venta offline fallida para editarla y recobrarla. Devuelve true si se cargó. */
  cargarVentaOffline: (pestana: unknown) => boolean;
  aplicarPreciosDeLista: (precios: Record<string, Decimal>) => void;
  cantidadDeProducto: (productoId: string) => number;
  totales: TotalesCarritoPOS;
}

const CarritoPOSContext = createContext<ValorCarrito | null>(null);

let contadorTemporal = 0;

function nuevoId(): string {
  contadorTemporal += 1;
  const aleatorio =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${contadorTemporal}`;
  return aleatorio;
}

export function crearPestana(nombre: string, defaults: DefaultsVenta, id?: string): PestanaVenta {
  return {
    id: id ?? nuevoId(),
    nombre,
    lineas: [],
    contactoId: defaults.contactoId,
    listaPrecioId: defaults.listaPrecioId,
    numeracionId: defaults.numeracionId,
    vendedorId: "",
    cotizacion: null,
  };
}

function siguienteNombre(pestanas: readonly PestanaVenta[]): string {
  const usados = new Set(pestanas.map((pestana) => pestana.nombre));
  let numero = 1;
  while (usados.has(`Venta ${numero}`)) numero += 1;
  return `Venta ${numero}`;
}

function esCadenaONulo(valor: unknown): boolean {
  return typeof valor === "string" || valor === null;
}

/** Lo guardado en IndexedDB es `unknown`: se valida antes de tocar el carrito. */
function esLineaCarrito(valor: unknown): valor is LineaCarrito {
  if (typeof valor !== "object" || valor === null) return false;
  const campos = valor as Record<string, unknown>;

  return (
    typeof campos.id === "string" &&
    esCadenaONulo(campos.productoId) &&
    typeof campos.descripcion === "string" &&
    esCadenaONulo(campos.referencia) &&
    typeof campos.cantidad === "string" &&
    esCadenaONulo(campos.unidadId) &&
    esCadenaONulo(campos.unidadNombre) &&
    esCadenaONulo(campos.unidadBase) &&
    esCadenaONulo(campos.factorBase) &&
    typeof campos.precio === "string" &&
    esCadenaONulo(campos.precioBase) &&
    typeof campos.precioManual === "boolean" &&
    typeof campos.descuentoPct === "string" &&
    typeof campos.itbisTasa === "string" &&
    esCadenaONulo(campos.impuestoId) &&
    Array.isArray(campos.unidades) &&
    typeof campos.tipo === "string"
  );
}

function leerPestanaOffline(valor: unknown): PestanaVenta | null {
  if (typeof valor !== "object" || valor === null) return null;
  const campos = valor as Record<string, unknown>;
  if (typeof campos.id !== "string" || !Array.isArray(campos.lineas)) return null;

  const lineas: LineaCarrito[] = [];
  for (const item of campos.lineas) {
    if (!esLineaCarrito(item)) return null;
    lineas.push(item);
  }

  return {
    id: campos.id,
    nombre: typeof campos.nombre === "string" ? campos.nombre : "Venta",
    lineas,
    contactoId: typeof campos.contactoId === "string" ? campos.contactoId : "",
    listaPrecioId: typeof campos.listaPrecioId === "string" ? campos.listaPrecioId : "",
    numeracionId: typeof campos.numeracionId === "string" ? campos.numeracionId : "",
    vendedorId: typeof campos.vendedorId === "string" ? campos.vendedorId : "",
    cotizacion: null,
  };
}

export function totalesDeLinea(linea: LineaCarrito): TotalesLineaPOS {
  return calcularLineaPOS({
    cantidad: linea.cantidad,
    precio: linea.precio,
    descuento_pct: linea.descuentoPct,
    itbis_tasa: linea.itbisTasa,
  });
}

export function totalesDePestana(pestana: PestanaVenta): TotalesCarritoPOS {
  return {
    subtotal: sumarMontos(pestana.lineas.map((linea) => totalesDeLinea(linea).subtotal)),
    descuento: sumarMontos(pestana.lineas.map((linea) => totalesDeLinea(linea).descuento)),
    itbis: sumarMontos(pestana.lineas.map((linea) => totalesDeLinea(linea).itbis)),
    total: sumarMontos(pestana.lineas.map((linea) => totalesDeLinea(linea).total)),
  };
}

export function ivaPorTasa(lineas: readonly LineaCarrito[]): { tasa: Decimal; monto: Decimal }[] {
  const grupos = new Map<string, string[]>();
  for (const linea of lineas) {
    const total = totalesDeLinea(linea);
    if ((Number(total.itbis) || 0) <= 0) continue;
    const lista = grupos.get(linea.itbisTasa) ?? [];
    lista.push(total.itbis);
    grupos.set(linea.itbisTasa, lista);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([tasa, montos]) => ({ tasa, monto: sumarMontos(montos) }));
}

export function CarritoPosProvider({ defaults, children }: { defaults: DefaultsVenta; children: ReactNode }) {
  const [pestanas, setPestanas] = useState<PestanaVenta[]>(() => [
    crearPestana("Venta principal", defaults, ID_PESTANA_PRINCIPAL),
  ]);
  const [activaId, setActivaId] = useState<string>(() => pestanas[0]?.id ?? "");
  const { ambito } = useOfflinePOS();
  const [hidratado, setHidratado] = useState(false);
  const [errorPersistencia, setErrorPersistencia] = useState(false);
  const [otroEditor, setOtroEditor] = useState(false);

  useEffect(() => {
    let vigente = true;
    let liberar: (() => void) | undefined;
    async function restaurar() {
      const guardado = await leerOffline<{ pestanas: PestanaVenta[]; activaId: string }>("carritos", ambito);
      const operaciones = await almacenColaOffline.listar(ambito);
      if (!vigente) return;
      if (guardado?.pestanas.length) {
        const restauradas = guardado.pestanas.map((pestana) => {
          const cobrada = operaciones.some((operacion) => {
            const snapshot = operacion.snapshot;
            return (
              typeof snapshot === "object" &&
              snapshot !== null &&
              "pestana" in snapshot &&
              JSON.stringify(snapshot.pestana) === JSON.stringify(pestana)
            );
          });
          const restaurada = cobrada ? { ...pestana, lineas: [], cotizacion: null } : pestana;
          // Una venta restaurada sin líneas es una venta nueva: arranca con el
          // cliente inicial (Consumidor final), no con el que quedó antes.
          return { ...restaurada, contactoId: contactoDePestanaRestaurada(restaurada, defaults.contactoId) };
        });
        setPestanas(restauradas);
        setActivaId(guardado.activaId);
      }
      setHidratado(true);
    }
    if (!navigator.locks) {
      setErrorPersistencia(true);
      return;
    }
    const controlador = new AbortController();
    const aviso = window.setTimeout(() => setOtroEditor(true), 1000);
    void navigator.locks
      .request(`pos-editor:${ambito}`, { signal: controlador.signal }, async () => {
        window.clearTimeout(aviso);
        if (!vigente) return;
        setOtroEditor(false);
        const espera = new Promise<void>((resolve) => {
          liberar = resolve;
        });
        await restaurar();
        if (vigente) await espera;
      })
      .catch(() => {
        if (vigente) setErrorPersistencia(true);
      });
    return () => {
      vigente = false;
      window.clearTimeout(aviso);
      controlador.abort();
      liberar?.();
    };
  }, [ambito, defaults.contactoId]);

  useEffect(() => {
    if (!hidratado) return;
    void guardarOffline("carritos", ambito, { pestanas, activaId }).catch(() => setErrorPersistencia(true));
  }, [ambito, hidratado, pestanas, activaId]);

  const activa = pestanas.find((pestana) => pestana.id === activaId) ?? pestanas[0];

  const cambiarActiva = useCallback(
    (cambio: (pestana: PestanaVenta) => PestanaVenta) => {
      setPestanas((actuales) => actuales.map((pestana) => (pestana.id === activaId ? cambio(pestana) : pestana)));
    },
    [activaId],
  );

  const agregarProducto = useCallback(
    (producto: ProductoPOS) => {
      cambiarActiva((pestana) => {
        if (pestana.cotizacion) return pestana;

        const precio = producto.precio;
        const unidadId: string | null = null;
        const unidadNombre = producto.unidad_medida;

        const existente = pestana.lineas.find(
          (linea) =>
            linea.productoId === producto.producto_id &&
            linea.unidadId === unidadId &&
            linea.precio === precio &&
            linea.descuentoPct === "0" &&
            linea.itbisTasa === producto.itbis_tasa,
        );

        if (existente) {
          return {
            ...pestana,
            lineas: pestana.lineas.map((linea) =>
              linea.id === existente.id ? { ...linea, cantidad: sumarMontos([linea.cantidad, "1"]) } : linea,
            ),
          };
        }

        const nueva: LineaCarrito = {
          id: nuevoId(),
          productoId: producto.producto_id,
          descripcion: producto.nombre,
          referencia: producto.referencia,
          cantidad: "1",
          unidadId,
          unidadNombre,
          unidadBase: producto.unidad_medida,
          factorBase: null,
          precio,
          precioBase: producto.precio,
          precioManual: false,
          descuentoPct: "0",
          itbisTasa: producto.itbis_tasa,
          impuestoId: null,
          unidades: producto.unidades,
          tipo: producto.tipo,
        };

        return { ...pestana, lineas: [...pestana.lineas, nueva] };
      });
    },
    [cambiarActiva],
  );

  const actualizarLinea = useCallback(
    (lineaId: string, cambios: Partial<LineaCarrito>) => {
      cambiarActiva((pestana) => {
        if (pestana.cotizacion) return pestana;
        return {
          ...pestana,
          lineas: pestana.lineas.map((linea) => (linea.id === lineaId ? { ...linea, ...cambios } : linea)),
        };
      });
    },
    [cambiarActiva],
  );

  const cambiarCantidad = useCallback(
    (lineaId: string, cantidad: Decimal) => {
      actualizarLinea(lineaId, { cantidad });
    },
    [actualizarLinea],
  );

  const quitarLinea = useCallback(
    (lineaId: string) => {
      cambiarActiva((pestana) => {
        if (pestana.cotizacion) return pestana;
        return { ...pestana, lineas: pestana.lineas.filter((linea) => linea.id !== lineaId) };
      });
    },
    [cambiarActiva],
  );

  const activarPestana = useCallback((id: string) => setActivaId(id), []);

  const nuevaPestana = useCallback(() => {
    if (pestanas.length >= MAXIMO_PESTANAS) return;
    const nueva = crearPestana(siguienteNombre(pestanas), defaults);
    setPestanas([...pestanas, nueva]);
    setActivaId(nueva.id);
  }, [defaults, pestanas]);

  const renombrarPestana = useCallback((id: string, nombre: string) => {
    setPestanas((actuales) => renombrarPestanaEn(actuales, id, nombre));
  }, []);

  const eliminarPestana = useCallback(
    (id: string) => {
      const resultado = eliminarPestanaDe(pestanas, activaId, id);
      if (!resultado.eliminada) return;
      setPestanas(resultado.pestanas);
      if (resultado.activaId !== activaId) setActivaId(resultado.activaId);
    },
    [activaId, pestanas],
  );

  const setContacto = useCallback(
    (contactoId: string) => cambiarActiva((pestana) => ({ ...pestana, contactoId })),
    [cambiarActiva],
  );

  const setLista = useCallback(
    (listaPrecioId: string) => cambiarActiva((pestana) => ({ ...pestana, listaPrecioId })),
    [cambiarActiva],
  );

  const setNumeracion = useCallback(
    (numeracionId: string) => cambiarActiva((pestana) => ({ ...pestana, numeracionId })),
    [cambiarActiva],
  );

  const setVendedor = useCallback(
    (vendedorId: string) => cambiarActiva((pestana) => ({ ...pestana, vendedorId })),
    [cambiarActiva],
  );

  const aplicarCotizacion = useCallback(
    (entrada: {
      id: string;
      numero: number;
      fecha: string | null;
      vencimiento: string | null;
      contactoId: string;
      listaPrecioId: string;
      lineas: {
        productoId: string | null;
        descripcion: string;
        referencia: string | null;
        cantidad: Decimal;
        unidadId: string | null;
        unidadNombre: string | null;
        precio: Decimal;
        descuentoPct: Decimal;
        itbisTasa: Decimal;
      }[];
    }) => {
      cambiarActiva((pestana) => ({
        ...pestana,
        contactoId: entrada.contactoId,
        listaPrecioId: entrada.listaPrecioId,
        vendedorId: "",
        cotizacion: {
          id: entrada.id,
          numero: entrada.numero,
          fecha: entrada.fecha,
          vencimiento: entrada.vencimiento,
        },
        lineas: entrada.lineas.map((linea) => ({
          id: nuevoId(),
          productoId: linea.productoId,
          descripcion: linea.descripcion,
          referencia: linea.referencia,
          cantidad: linea.cantidad,
          unidadId: linea.unidadId,
          unidadNombre: linea.unidadNombre,
          unidadBase: null,
          factorBase: null,
          precio: linea.precio,
          precioBase: linea.precio,
          precioManual: true,
          descuentoPct: linea.descuentoPct,
          itbisTasa: linea.itbisTasa,
          impuestoId: null,
          unidades: [],
          tipo: linea.productoId ? "producto" : "servicio",
        })),
      }));
    },
    [cambiarActiva],
  );

  const quitarCotizacion = useCallback(
    () => cambiarActiva((pestana) => ({ ...pestana, cotizacion: null })),
    [cambiarActiva],
  );

  const vaciarPestana = useCallback(() => {
    cambiarActiva((pestana) => ({
      ...pestana,
      lineas: [],
      cotizacion: null,
      contactoId: defaults.contactoId,
      listaPrecioId: defaults.listaPrecioId,
      numeracionId: defaults.numeracionId,
      vendedorId: "",
    }));
  }, [cambiarActiva, defaults]);

  const reiniciarTrasVenta = useCallback(() => {
    cambiarActiva((pestana) => ({
      ...pestana,
      lineas: [],
      cotizacion: null,
      contactoId: defaults.contactoId,
      listaPrecioId: defaults.listaPrecioId,
      numeracionId: defaults.numeracionId,
      vendedorId: "",
    }));
  }, [cambiarActiva, defaults]);

  /**
   * Una venta offline fallida vuelve al carrito tal como se cobró (líneas,
   * cliente, lista, numeración y vendedor) para corregirla y recobrarla. Va a
   * la pestaña activa si está vacía; si no, a una pestaña nueva, y si ya no
   * caben pestañas reemplaza la activa.
   */
  const cargarVentaOffline = useCallback(
    (valor: unknown): boolean => {
      const origen = leerPestanaOffline(valor);
      if (!origen || origen.lineas.length === 0) return false;

      const contenido = {
        lineas: origen.lineas.map((linea) => ({ ...linea, id: nuevoId() })),
        cotizacion: null,
        contactoId: origen.contactoId,
        listaPrecioId: origen.listaPrecioId,
        numeracionId: origen.numeracionId || defaults.numeracionId,
        vendedorId: origen.vendedorId,
      };

      const actual = pestanas.find((pestana) => pestana.id === activaId) ?? pestanas[0];
      if (!actual) return false;

      if (actual.lineas.length === 0 && actual.cotizacion === null) {
        setPestanas(pestanas.map((pestana) => (pestana.id === actual.id ? { ...pestana, ...contenido } : pestana)));
        return true;
      }

      if (pestanas.length < MAXIMO_PESTANAS) {
        const nombre = origen.nombre.trim() === "" ? siguienteNombre(pestanas) : origen.nombre;
        const nueva: PestanaVenta = { ...crearPestana(nombre, defaults), ...contenido };
        setPestanas([...pestanas, nueva]);
        setActivaId(nueva.id);
        return true;
      }

      return false;
    },
    [activaId, defaults, pestanas],
  );

  const aplicarPreciosDeLista = useCallback(
    (precios: Record<string, Decimal>) => {
      cambiarActiva((pestana) => {
        if (pestana.cotizacion) return pestana;
        return {
          ...pestana,
          lineas: pestana.lineas.map((linea) => {
            if (linea.precioManual || !linea.productoId || linea.unidadId !== null) return linea;
            const precio = precios[linea.productoId];
            return precio ? { ...linea, precio, precioBase: precio } : linea;
          }),
        };
      });
    },
    [cambiarActiva],
  );

  const hayLineas = pestanas.some((pestana) => pestana.lineas.length > 0);

  useEffect(() => {
    if (!hayLineas) return;

    function avisar(evento: BeforeUnloadEvent) {
      evento.preventDefault();
      evento.returnValue = "";
    }

    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [hayLineas]);

  const cantidadDeProducto = useCallback(
    (productoId: string) => {
      if (!activa) return 0;
      return activa.lineas
        .filter((linea) => linea.productoId === productoId)
        .reduce((total, linea) => total + (Number(linea.cantidad) || 0), 0);
    },
    [activa],
  );

  const totales = useMemo(
    () => (activa ? totalesDePestana(activa) : { subtotal: "0", descuento: "0", itbis: "0", total: "0" }),
    [activa],
  );

  if (otroEditor)
    return (
      <p role="alert" className="p-6">
        Este POS ya está abierto en otra pestaña. Ciérrala y recarga aquí para recuperar sus ventas.
      </p>
    );
  if (errorPersistencia)
    return (
      <p role="alert" className="p-6">
        No se pudo guardar el carrito. No cobres: revisa el almacenamiento del navegador y recarga.
      </p>
    );
  if (!hidratado)
    return (
      <p role="status" className="p-6">
        Recuperando ventas de este dispositivo…
      </p>
    );
  if (!activa) return null;

  const valor: ValorCarrito = {
    pestanas,
    activa,
    hayLineas,
    agregarProducto,
    actualizarLinea,
    cambiarCantidad,
    quitarLinea,
    activarPestana,
    nuevaPestana,
    renombrarPestana,
    eliminarPestana,
    setContacto,
    setLista,
    setNumeracion,
    setVendedor,
    aplicarCotizacion,
    quitarCotizacion,
    vaciarPestana,
    reiniciarTrasVenta,
    cargarVentaOffline,
    aplicarPreciosDeLista,
    cantidadDeProducto,
    totales,
  };

  return <CarritoPOSContext.Provider value={valor}>{children}</CarritoPOSContext.Provider>;
}

export function useCarritoPOS(): ValorCarrito {
  const contexto = useContext(CarritoPOSContext);
  if (!contexto) throw new Error("useCarritoPOS debe usarse dentro de CarritoPosProvider.");
  return contexto;
}
