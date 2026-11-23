"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ReceiptText } from "@/components/icons";
import { ImpresionPos } from "@/components/pos/impresion-pos";
import { TicketPos } from "@/components/pos/ticket-pos";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import type { ContactoResumen, Empresa } from "@/lib/facturacion/tipos";
import type { Impuesto } from "@/lib/impuestos/tipos";
import type { Numeracion } from "@/lib/numeraciones/tipos";
import { crearCotizacionPOS } from "@/lib/pos/acciones";
import { conBloqueoOffline, guardarOffline, leerOffline } from "@/lib/pos/almacen-offline";
import { enlaceCotizacionPOS, payloadCotizacionPOS } from "@/lib/pos/cotizaciones";
import type { TicketPOSPayload } from "@/lib/pos/impresion";
import type { CotizacionPOSResultado, PlantillaTicket, ProductoPOS, ProductoPOSCodigo } from "@/lib/pos/tipos";

import { buscarCatalogoPOS, buscarCodigoPOS } from "../acciones-pos";
import { useCarritoPOS } from "../carrito-pos-provider";
import { capitalizar, formatoMonedaPOS, hoyRD, sumarDias } from "../formato-pos";
import { useOfflinePOS } from "../offline-pos-provider";
import { DialogoAbrirTurno } from "../turnos/dialogo-abrir-turno";
import { BarraInferiorPos } from "./barra-inferior-pos";
import { CatalogoPos } from "./catalogo-pos";
import { CheckoutPos } from "./checkout-pos";
import { ConfirmacionVenta } from "./confirmacion-venta";
import { DialogoCargarCotizacion } from "./dialogo-cargar-cotizacion";
import { DialogoVentaSimple } from "./dialogo-venta-simple";
import { PanelFactura } from "./panel-factura";

const TAMANO_LOTE = 50;

function desdeCodigo(producto: ProductoPOSCodigo): ProductoPOS {
  return {
    producto_id: producto.producto_id,
    nombre: producto.nombre,
    referencia: producto.referencia,
    marca: producto.marca,
    tipo: producto.tipo,
    categoria_id: null,
    favorito_pos: producto.favorito_pos,
    imagen_path: producto.imagen_path,
    unidad_medida: producto.unidad_nombre,
    precio: producto.precio,
    itbis_tasa: producto.itbis_tasa,
    stock: producto.stock,
    disponible: producto.disponible,
    unidades: [],
  };
}

export function VenderPos({
  terminal,
  turno,
  empresa,
  productos,
  categorias,
  impuestos,
  numeraciones,
  listas,
  vendedores,
  contactos,
  consumidorFinalId,
  cuentas,
  plantillaFactura,
  plantillaCotizacion,
}: {
  terminal: {
    id: string;
    nombre: string;
    cuenta_efectivo_id: string;
    cuenta_tarjeta_debito_id: string | null;
    cuenta_tarjeta_credito_id: string | null;
    cuenta_transferencia_id: string | null;
    contacto_defecto_id: string;
    plantilla_ticket: PlantillaTicket;
  };
  turno: { id: string; numero: number } | null;
  empresa: Empresa | null;
  productos: ProductoPOS[];
  categorias: { id: string; nombre: string }[];
  impuestos: Impuesto[];
  numeraciones: Numeracion[];
  listas: { id: string; nombre: string }[];
  vendedores: { id: string; nombre: string }[];
  contactos: ContactoResumen[];
  consumidorFinalId: string | null;
  cuentas: { id: string; nombre: string }[];
  plantillaFactura: { mostrarLogo: boolean; notas: string; terminos: string };
  plantillaCotizacion: { mostrarLogo: boolean; notas: string; terminos: string };
}) {
  const router = useRouter();
  const carrito = useCarritoPOS();
  const { ambito, estado: estadoConexion } = useOfflinePOS();
  const [catalogo, setCatalogo] = useState<ProductoPOS[]>(productos);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [hayMas, setHayMas] = useState(productos.length === TAMANO_LOTE);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [avisoCatalogo, setAvisoCatalogo] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [favoritos, setFavoritos] = useState(false);
  const [categoria, setCategoria] = useState("");
  const [resaltado, setResaltado] = useState(-1);
  const [tokenLimpiar, setTokenLimpiar] = useState(0);
  const [anuncio, setAnuncio] = useState("");
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [simpleAbierto, setSimpleAbierto] = useState(false);
  const [cargarCotizacionAbierto, setCargarCotizacionAbierto] = useState(false);
  const [abrirTurnoAbierto, setAbrirTurnoAbierto] = useState(false);
  const [sheetAbierto, setSheetAbierto] = useState(false);
  const [guardandoCotizacion, setGuardandoCotizacion] = useState(false);
  const [errorCotizacion, setErrorCotizacion] = useState<string | null>(null);
  const [confirmacionCotizacion, setConfirmacionCotizacion] = useState<CotizacionPOSResultado | null>(null);
  /**
   * Documento de presentación (prefactura/cotización) a imprimir. Vive aquí
   * y no en `PanelFactura`: al imprimir, Chromium evalúa el medio «print»
   * con el ancho del papel (80 mm) y `esEscritorio` pasa a falso, lo que
   * desmontaría el panel y su portal a mitad de la impresión.
   */
  const [impresionDoc, setImpresionDoc] = useState<{ titulo: string; payload: TicketPOSPayload } | null>(null);
  const [esEscritorio, setEsEscritorio] = useState(false);
  const [turnoActual, setTurnoActual] = useState(turno);

  useEffect(() => {
    setTurnoActual(turno);
  }, [turno]);

  useEffect(() => {
    const consulta = window.matchMedia("(min-width: 1024px)");
    const actualizar = () => setEsEscritorio(consulta.matches);
    actualizar();
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const solicitud = useRef(0);
  const primeraCarga = useRef(false);
  const ultimoAgregado = useRef<string | null>(null);
  const bufferCodigo = useRef("");
  const ultimaTecla = useRef(0);
  const listaPrecioId = carrito.activa.listaPrecioId;
  const carritoRef = useRef(carrito);
  carritoRef.current = carrito;
  const catalogoRef = useRef(catalogo);
  catalogoRef.current = catalogo;

  const numeracionValida = numeraciones.some((numeracion) => numeracion.id === carrito.activa.numeracionId);
  const sinCaja = !cuentas.some((cuenta) => cuenta.id === terminal.cuenta_efectivo_id);
  const puedeCobrar =
    carrito.activa.lineas.length > 0 &&
    turnoActual !== null &&
    numeracionValida &&
    !sinCaja &&
    !(estadoConexion === "offline" && errorCatalogo !== null);
  const hayModal =
    checkoutAbierto ||
    simpleAbierto ||
    cargarCotizacionAbierto ||
    abrirTurnoAbierto ||
    sheetAbierto ||
    confirmacionCotizacion !== null;

  useEffect(() => {
    if (estadoConexion === "offline" || !navigator.onLine) return;
    let vigente = true;
    async function prepararCache() {
      await guardarOffline("contactos", ambito, contactos);
      await guardarOffline("config", `${ambito}/venta`, {
        terminal,
        turno,
        empresa,
        numeraciones,
        listas,
        cuentas,
        vendedores,
      });
      const acumulados: ProductoPOS[] = [];
      for (let offset = 0; vigente && navigator.onLine; offset += TAMANO_LOTE) {
        const respuesta = await buscarCatalogoPOS({
          terminal_id: terminal.id,
          ...(listaPrecioId ? { lista_precio_id: listaPrecioId } : {}),
          limit: TAMANO_LOTE,
          offset,
        });
        if (!respuesta.ok || !vigente) return;
        acumulados.push(...respuesta.data);
        await conBloqueoOffline(`${ambito}/catalogo`, () =>
          guardarOffline("catalogo", `${ambito}/${listaPrecioId}`, {
            productos: acumulados,
            actualizado: new Date().toISOString(),
            completo: respuesta.data.length < TAMANO_LOTE,
          }),
        );
        if (respuesta.data.length < TAMANO_LOTE) return;
      }
    }
    void prepararCache().catch(() =>
      setErrorCatalogo("No se pudo preparar el catálogo offline. Mantén la conexión hasta completar la preparación."),
    );
    return () => {
      vigente = false;
    };
  }, [
    ambito,
    estadoConexion,
    listaPrecioId,
    terminal,
    turno,
    empresa,
    numeraciones,
    listas,
    cuentas,
    vendedores,
    contactos,
  ]);
  // El carrito siempre tiene un cliente (el de la terminal o el que se elija):
  // «Cargar cotización» muestra solo las suyas, como Alegra.
  const contactoDelCarrito = carrito.activa.contactoId;
  const filtroCotizacionId = contactoDelCarrito === "" ? undefined : contactoDelCarrito;
  const filtroCotizacionNombre = filtroCotizacionId
    ? (contactos.find((contacto) => contacto.id === filtroCotizacionId)?.nombre ?? null)
    : null;

  const cargarCatalogo = useCallback(
    async (reiniciar: boolean) => {
      const numero = solicitud.current + 1;
      solicitud.current = numero;

      if (reiniciar) {
        setCargando(true);
        setErrorCatalogo(null);
      } else {
        setCargandoMas(true);
      }

      try {
        if (!navigator.onLine || estadoConexion === "offline") {
          const guardado = await leerOffline<{ productos: ProductoPOS[]; actualizado: string; completo: boolean }>(
            "catalogo",
            `${ambito}/${listaPrecioId}`,
          );
          if (solicitud.current !== numero) return;
          if (!guardado) {
            setCatalogo([]);
            setHayMas(false);
            setErrorCatalogo("Esta lista de precios todavía no está guardada para trabajar sin conexión.");
            return;
          }
          const texto = busqueda.toLocaleLowerCase("es").trim();
          const datos = guardado.productos.filter(
            (producto) =>
              (!categoria || producto.categoria_id === categoria) &&
              (!favoritos || producto.favorito_pos) &&
              (!texto || `${producto.nombre} ${producto.referencia ?? ""}`.toLocaleLowerCase("es").includes(texto)),
          );
          const precios: Record<string, string> = {};
          for (const producto of guardado.productos) precios[producto.producto_id] = producto.precio;
          carritoRef.current.aplicarPreciosDeLista(precios);
          setCatalogo(datos);
          setHayMas(false);
          setErrorCatalogo(null);
          setAvisoCatalogo(
            `Catálogo ${guardado.completo ? "guardado" : "parcial"} del ${guardado.actualizado}. Existencias sin actualizar.`,
          );
          return;
        }
        const resultado = await buscarCatalogoPOS({
          terminal_id: terminal.id,
          ...(listaPrecioId ? { lista_precio_id: listaPrecioId } : {}),
          ...(busqueda ? { busqueda } : {}),
          ...(categoria ? { categoria_id: categoria } : {}),
          solo_favoritos: favoritos,
          limit: TAMANO_LOTE,
          offset: reiniciar ? 0 : catalogoRef.current.length,
        });

        if (solicitud.current !== numero) return;

        if (!resultado.ok) {
          setErrorCatalogo(resultado.error);
          return;
        }

        const datos = resultado.data;
        const siguiente = reiniciar ? datos : [...catalogoRef.current, ...datos];
        setCatalogo(siguiente);
        setHayMas(datos.length === TAMANO_LOTE);
        setResaltado(datos.length === 1 ? 0 : -1);
        setErrorCatalogo(null);

        if (datos.length > 0) {
          const precios: Record<string, string> = {};
          for (const producto of datos) precios[producto.producto_id] = producto.precio;
          carritoRef.current.aplicarPreciosDeLista(precios);
        }
      } catch {
        if (solicitud.current === numero) {
          setErrorCatalogo("No se pudo cargar el catálogo. Revisa tu conexión e inténtalo de nuevo.");
        }
      } finally {
        if (solicitud.current === numero) {
          setCargando(false);
          setCargandoMas(false);
        }
      }
    },
    [busqueda, categoria, favoritos, listaPrecioId, terminal.id, ambito, estadoConexion],
  );

  useEffect(() => {
    if (!primeraCarga.current) {
      primeraCarga.current = true;
      return;
    }
    void cargarCatalogo(true);
  }, [cargarCatalogo]);

  const buscarCodigo = useCallback(
    async (codigo: string) => {
      try {
        const resultado = await buscarCodigoPOS({
          codigo,
          terminal_id: terminal.id,
          ...(listaPrecioId ? { lista_precio_id: listaPrecioId } : {}),
        });

        if (!resultado.ok) {
          setAnuncio("No se pudo leer el código de barra. Inténtalo de nuevo.");
          return;
        }
        if (!resultado.data) {
          setAnuncio(`No encontramos un producto con el código «${codigo}».`);
          return;
        }

        const producto = desdeCodigo(resultado.data);
        carritoRef.current.agregarProducto(producto);
        ultimoAgregado.current = producto.nombre;
        inputRef.current?.focus();
        setBusqueda("");
        setTokenLimpiar((actual) => actual + 1);
      } catch {
        setAnuncio("No se pudo leer el código de barra. Inténtalo de nuevo.");
      }
    },
    [terminal.id, listaPrecioId],
  );

  function agregar(producto: ProductoPOS) {
    carrito.agregarProducto(producto);
    ultimoAgregado.current = producto.nombre;
    setAnuncio(`${producto.nombre} agregado.`);
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!ultimoAgregado.current) return;
    setAnuncio(
      `${ultimoAgregado.current} agregado. ${carrito.activa.lineas.length} ${
        carrito.activa.lineas.length === 1 ? "artículo" : "artículos"
      }. Total ${formatoMonedaPOS(carrito.totales.total)}.`,
    );
    ultimoAgregado.current = null;
  }, [carrito.activa.lineas.length, carrito.totales.total]);

  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      const objetivo = evento.target as HTMLElement | null;
      const editable =
        objetivo &&
        (objetivo.tagName === "INPUT" ||
          objetivo.tagName === "TEXTAREA" ||
          objetivo.tagName === "SELECT" ||
          objetivo.isContentEditable);
      if (editable) return;

      if (evento.key === "Enter") {
        const codigo = bufferCodigo.current;
        bufferCodigo.current = "";
        if (codigo.length >= 2) {
          evento.preventDefault();
          void buscarCodigo(codigo);
        }
        return;
      }

      if (evento.key.length !== 1) return;
      const ahora = Date.now();
      if (ahora - ultimaTecla.current > 100) bufferCodigo.current = "";
      ultimaTecla.current = ahora;
      if (bufferCodigo.current.length < 64) bufferCodigo.current += evento.key;
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [buscarCodigo]);

  useEffect(() => {
    function alPresionar(evento: KeyboardEvent) {
      if (evento.key === "F2") {
        if (hayModal) return;
        evento.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      if (hayModal) return;

      if (evento.key === "F4") {
        evento.preventDefault();
        if (!carrito.activa.cotizacion) setSimpleAbierto(true);
      }

      if (evento.key === "F8") {
        evento.preventDefault();
        if (puedeCobrar) setCheckoutAbierto(true);
      }

      if (evento.key === "Escape") {
        const input = inputRef.current;
        if (!input) return;
        if (input.value !== "") {
          setBusqueda("");
          setTokenLimpiar((actual) => actual + 1);
        }
        input.focus();
      }
    }

    window.addEventListener("keydown", alPresionar);
    return () => window.removeEventListener("keydown", alPresionar);
  }, [carrito.activa.cotizacion, hayModal, puedeCobrar]);

  function onEnter(texto: string): boolean {
    const resaltadoActual = resaltado >= 0 ? catalogo[resaltado] : undefined;
    if (resaltadoActual) {
      agregar(resaltadoActual);
      setBusqueda("");
      setTokenLimpiar((actual) => actual + 1);
      return true;
    }
    if (catalogo.length === 1 && busqueda.trim() !== "") {
      const unico = catalogo[0];
      if (unico) {
        agregar(unico);
        setBusqueda("");
        setTokenLimpiar((actual) => actual + 1);
        return true;
      }
    }
    if (/^\d{4,}$/.test(texto)) {
      setBusqueda("");
      setTokenLimpiar((actual) => actual + 1);
      void buscarCodigo(texto);
      return true;
    }
    return false;
  }

  function onMover(delta: number) {
    if (catalogo.length === 0) {
      setResaltado(-1);
      return;
    }
    setResaltado((actual) => {
      if (actual < 0) return delta > 0 ? 0 : catalogo.length - 1;
      const siguiente = actual + delta;
      return Math.min(Math.max(siguiente, 0), catalogo.length - 1);
    });
  }

  function limpiar() {
    setBusqueda("");
    setCategoria("");
    setFavoritos(false);
    setResaltado(-1);
  }

  function verHistorial(ncf: string | null) {
    setCheckoutAbierto(false);
    router.push(ncf ? `/pos/historial?q=${encodeURIComponent(ncf)}` : "/pos/historial");
  }

  async function guardarCotizacion() {
    const activa = carrito.activa;
    if (activa.lineas.length === 0 || activa.cotizacion) return;

    setGuardandoCotizacion(true);
    setErrorCotizacion(null);
    const hoy = hoyRD();

    try {
      const resultado = await crearCotizacionPOS(
        payloadCotizacionPOS({
          terminalId: terminal.id,
          fecha: hoy,
          vencimiento: sumarDias(hoy, 30),
          pestana: activa,
        }),
      );

      if (!resultado.ok) {
        setErrorCotizacion(capitalizar(resultado.error));
        return;
      }

      const cotizacion = resultado.data.cotizacion;
      setConfirmacionCotizacion(resultado.data);
      toast.add({
        type: "success",
        title: `Cotización No ${cotizacion.numero} guardada.`,
        description: (
          <a
            href={enlaceCotizacionPOS(cotizacion.id)}
            target="_blank"
            rel="noreferrer"
            className="text-pos-primario font-medium hover:underline"
          >
            Ver cotización
          </a>
        ),
      });
    } catch {
      setErrorCotizacion("No sabemos si la cotización se guardó. Revisa Cotizaciones antes de volver a guardarla.");
    } finally {
      setGuardandoCotizacion(false);
    }
  }

  const cantidades = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const linea of carrito.activa.lineas) {
      if (!linea.productoId) continue;
      mapa.set(linea.productoId, (mapa.get(linea.productoId) ?? 0) + (Number(linea.cantidad) || 0));
    }
    return mapa;
  }, [carrito.activa.lineas]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <a
        href="#catalogo-pos"
        className="focus:bg-card focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:px-2 focus:py-1"
      >
        Ir al catálogo
      </a>
      <a
        href="#panel-factura-pos"
        className="focus:bg-card focus:text-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-32 focus:z-50 focus:rounded focus:px-2 focus:py-1"
      >
        Ir a la factura
      </a>
      <div className="sr-only" aria-live="polite">
        {anuncio}
      </div>

      {sinCaja ? (
        <div className="px-3 pt-2 sm:px-4">
          <Alert variant="destructive">
            <AlertDescription className="flex flex-wrap items-center gap-2">
              {`La terminal ${terminal.nombre} no tiene una cuenta de efectivo activa.`}
              <span className="text-xs">Corrige la configuración en Contabilidad.</span>
              <Button
                variant="outline"
                size="sm"
                render={<a href="/dashboard/configuracion/pos" target="_blank" rel="noreferrer" />}
              >
                Abrir configuración
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 bg-slate-100 dark:bg-background">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {avisoCatalogo ? (
            <p role="status" className="text-pos-texto-suave px-4 py-1 text-xs">
              {avisoCatalogo}
            </p>
          ) : null}
          <CatalogoPos
            inputRef={inputRef}
            productos={catalogo}
            categorias={categorias}
            categoria={categoria}
            favoritos={favoritos}
            busqueda={busqueda}
            cargando={cargando}
            cargandoMas={cargandoMas}
            hayMas={hayMas}
            error={errorCatalogo}
            resultados={catalogo.length}
            resaltado={resaltado}
            cantidades={cantidades}
            onBuscar={setBusqueda}
            onEnter={onEnter}
            onMover={onMover}
            onFavoritos={() => setFavoritos((actual) => !actual)}
            onCategoria={setCategoria}
            onLimpiar={limpiar}
            onReintentar={() => void cargarCatalogo(true)}
            onVerMas={() => void cargarCatalogo(false)}
            onAgregar={agregar}
            onVentaSimple={() => setSimpleAbierto(true)}
            limpiarToken={tokenLimpiar}
          />
        </div>

        {esEscritorio ? (
          <div className="flex min-h-0 w-[40%] max-w-[550px] shrink-0">
            <PanelFactura
              terminal={terminal}
              turno={turnoActual}
              empresa={empresa}
              plantillaTicket={terminal.plantilla_ticket}
              numeraciones={numeraciones}
              listas={listas}
              vendedores={vendedores}
              contactos={contactos}
              consumidorFinalId={consumidorFinalId}
              impuestos={impuestos}
              puedeEscribir
              sinCaja={sinCaja}
              onCobrar={() => setCheckoutAbierto(true)}
              onVentaSimple={() => setSimpleAbierto(true)}
              onCargarCotizacion={() => setCargarCotizacionAbierto(true)}
              onGuardarCotizacion={() => void guardarCotizacion()}
              onCancelarVenta={() => inputRef.current?.focus()}
              onAnunciar={setAnuncio}
              onImprimir={setImpresionDoc}
              guardandoCotizacion={guardandoCotizacion}
              errorCotizacion={errorCotizacion}
            />
          </div>
        ) : null}
      </div>

      {!esEscritorio ? (
        <>
          <div className="border-border bg-card flex h-16 shrink-0 items-center justify-between gap-3 border-t px-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-muted-foreground text-xs">
                {carrito.activa.lineas.length === 1 ? "1 artículo" : `${carrito.activa.lineas.length} artículos`}
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatoMonedaPOS(carrito.totales.total)}</span>
            </div>
            <Button
              className="bg-pos-primario hover:bg-pos-primario-hover h-11 gap-1.5 text-white"
              onClick={() => setSheetAbierto(true)}
            >
              <ReceiptText aria-hidden="true" />
              Ver factura
            </Button>
          </div>

          <Sheet open={sheetAbierto} onOpenChange={setSheetAbierto}>
            {/* `w-full!` vence al `data-[side=right]:w-3/4` de sheet.tsx: la factura ocupa todo el móvil. */}
            <SheetContent
              side="right"
              className="w-full! gap-0 p-0 sm:max-w-[420px]!"
              overlayStyle={{ bottom: "2.75rem" }}
              style={{ bottom: "2.75rem", height: "calc(100dvh - 2.75rem)" }}
            >
              <SheetTitle className="sr-only">Factura de venta</SheetTitle>
              <PanelFactura
                terminal={terminal}
                turno={turnoActual}
                empresa={empresa}
                plantillaTicket={terminal.plantilla_ticket}
                numeraciones={numeraciones}
                listas={listas}
                vendedores={vendedores}
                contactos={contactos}
                consumidorFinalId={consumidorFinalId}
                impuestos={impuestos}
                puedeEscribir
                sinCaja={sinCaja}
                idPanel="panel-factura-pos-movil"
                onCobrar={() => {
                  setSheetAbierto(false);
                  setCheckoutAbierto(true);
                }}
                onVentaSimple={() => {
                  setSheetAbierto(false);
                  setSimpleAbierto(true);
                }}
                onCargarCotizacion={() => {
                  setSheetAbierto(false);
                  setCargarCotizacionAbierto(true);
                }}
                onGuardarCotizacion={() => void guardarCotizacion()}
                onCancelarVenta={() => {
                  setSheetAbierto(false);
                  inputRef.current?.focus();
                }}
                onAnunciar={setAnuncio}
                onImprimir={setImpresionDoc}
                guardandoCotizacion={guardandoCotizacion}
                errorCotizacion={errorCotizacion}
              />
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <BarraInferiorPos turno={turnoActual} onAbrirTurno={() => setAbrirTurnoAbierto(true)} />

      <CheckoutPos
        abierto={checkoutAbierto}
        onCerrar={() => {
          setCheckoutAbierto(false);
          inputRef.current?.focus();
        }}
        terminal={terminal}
        turno={turnoActual}
        empresa={empresa}
        cuentas={cuentas}
        contactos={contactos}
        consumidorFinalId={consumidorFinalId}
        plantillaTicket={terminal.plantilla_ticket}
        plantillaFactura={plantillaFactura}
        plantillaCotizacion={plantillaCotizacion}
        onVerHistorial={verHistorial}
      />

      <DialogoVentaSimple
        abierto={simpleAbierto}
        onCerrar={() => {
          setSimpleAbierto(false);
          inputRef.current?.focus();
        }}
        impuestos={impuestos}
        bloqueado={carrito.activa.cotizacion !== null}
      />

      <DialogoCargarCotizacion
        abierto={cargarCotizacionAbierto}
        contactoId={filtroCotizacionId}
        contactoNombre={filtroCotizacionNombre}
        onCerrar={() => {
          setCargarCotizacionAbierto(false);
          inputRef.current?.focus();
        }}
      />

      <DialogoAbrirTurno
        abierto={abrirTurnoAbierto}
        onCerrar={() => setAbrirTurnoAbierto(false)}
        terminal={{ id: terminal.id, nombre: terminal.nombre }}
        turnoActual={turnoActual?.numero ?? null}
        onAbierto={(datos) => {
          setTurnoActual({ id: datos.turno.id, numero: datos.turno.numero });
          setAbrirTurnoAbierto(false);
          router.refresh();
        }}
      />

      {impresionDoc ? (
        <ImpresionPos
          titulo={impresionDoc.titulo}
          ancho={impresionDoc.payload.diseno.ancho_mm}
          onCerrar={() => setImpresionDoc(null)}
        >
          <TicketPos payload={impresionDoc.payload} />
        </ImpresionPos>
      ) : null}

      <Dialog
        open={confirmacionCotizacion !== null}
        onOpenChange={(nuevo) => (nuevo ? null : setConfirmacionCotizacion(null))}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="sr-only">Cotización guardada</DialogTitle>
            <DialogDescription className="sr-only">La cotización se guardó correctamente.</DialogDescription>
          </DialogHeader>
          {confirmacionCotizacion ? (
            <ConfirmacionVenta
              cotizacion={confirmacionCotizacion}
              empresa={empresa}
              plantillaTicket={terminal.plantilla_ticket}
              plantillaFactura={plantillaFactura}
              plantillaCotizacion={plantillaCotizacion}
              onNuevaVenta={() => {
                carrito.vaciarPestana();
                setConfirmacionCotizacion(null);
                inputRef.current?.focus();
              }}
              onVerHistorial={() => undefined}
              onCerrar={() => setConfirmacionCotizacion(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
