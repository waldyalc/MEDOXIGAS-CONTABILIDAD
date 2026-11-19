"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { SelectorContacto } from "@/components/contactos/selector-contacto";
import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_COMBO,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormCard,
  FormDivider,
  FormGrid,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { RetencionOpcion } from "@/lib/configuracion/tipos";
import { formatoMoneda, formatoMonedaCentavos } from "@/lib/facturacion/formato";
import type { Empresa } from "@/lib/facturacion/tipos";
import { formatoDia } from "@/lib/formato";
import { type ReglaCampo, requerido } from "@/lib/formularios/validacion";
import { buscarFacturasPago } from "@/lib/pagos/busqueda";
import {
  type FacturaPago,
  type LineaOtroPago,
  type PestanaPago,
  retenidoDeFactura,
  saldoPendiente,
  TAMANO_PAGINA_FACTURAS,
  totalOtrosCentavos,
  validarPago,
} from "@/lib/pagos/multifactura";
import type { MetodoPago } from "@/lib/pagos/tipos";

export interface ContactoPago {
  id: string;
  nombre: string;
  rnc_cedula: string | null;
  lista_precio_id?: string | null;
}

export interface CuentaPago {
  id: string;
  codigo: string;
  nombre: string;
}

export interface CentroPago {
  id: string;
  codigo: string;
  nombre: string;
}

interface ResultadoAccionPago {
  ok: boolean;
  id?: string;
  error?: string;
}

interface Props {
  tipo: "recibido" | "proveedor";
  empresa: Empresa | null;
  contactos: ContactoPago[];
  cuentas: CuentaPago[];
  cuentasMovimiento: CuentaPago[];
  centrosCosto: CentroPago[];
  facturaInicial?: FacturaPago | null;
  retenciones: RetencionOpcion[];
  siguienteNumero: number;
  fechaHoy: string;
  initialContacto?: string;
  initialCuenta?: string;
  rutaCancelar: string;
  accion: (entrada: unknown) => Promise<ResultadoAccionPago>;
}

const METODOS: readonly { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "cheque", label: "Cheque" },
  { value: "tarjeta", label: "Tarjeta" },
];

const OPCIONES_ITBIS = [
  { value: "0", label: "Sin ITBIS" },
  { value: "16", label: "ITBIS 16 %" },
  { value: "18", label: "ITBIS 18 %" },
];

const SIN_CENTRO = "__ninguno";
const CELDA_ENCABEZADO = "h-10 bg-slate-100 px-2 text-sm font-bold whitespace-nowrap text-slate-700";

function esMetodo(valor: string | null): valor is MetodoPago {
  return METODOS.some((metodo) => metodo.value === valor);
}

function nuevoNumeroLinea(lineas: readonly LineaOtroPago[]): string {
  const usados = new Set(lineas.map((linea) => linea.clave));
  let indice = lineas.length + 1;
  while (usados.has(`otro-${indice}`)) indice += 1;
  return `otro-${indice}`;
}

function lineaOtroVacia(clave: string, cuentaId = ""): LineaOtroPago {
  return { clave, cuentaId, descripcion: "", monto: "", itbisTasa: "0", observacion: "" };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: el formulario concentra encabezado, facturas, retenciones y otros ingresos en una sola tarjeta
export function PagoForm({
  tipo,
  empresa,
  contactos,
  cuentas,
  cuentasMovimiento,
  centrosCosto,
  facturaInicial = null,
  retenciones,
  siguienteNumero,
  fechaHoy,
  initialContacto = "",
  initialCuenta = "",
  rutaCancelar,
  accion,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const solicitud = useRef(0);

  const [contactoId, setContactoId] = useState(initialContacto);
  const [fecha, setFecha] = useState(fechaHoy);
  const [cuentaId, setCuentaId] = useState(
    cuentas.find((cuenta) => cuenta.id === initialCuenta)?.id ??
      cuentas.find((cuenta) => cuenta.codigo === "1101")?.id ??
      cuentas[0]?.id ??
      "",
  );
  const [metodo, setMetodo] = useState<MetodoPago>("efectivo");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [pestana, setPestana] = useState<PestanaPago>("facturas");
  const [montos, setMontos] = useState<Record<string, string>>(
    facturaInicial ? { [facturaInicial.id]: saldoPendiente(facturaInicial).toFixed(2) } : {},
  );
  const [retencionesFactura, setRetencionesFactura] = useState<Record<string, string[]>>({});
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalFacturas, setTotalFacturas] = useState(0);
  const [facturasPagina, setFacturasPagina] = useState<FacturaPago[]>([]);
  const [facturasPorId, setFacturasPorId] = useState<Record<string, FacturaPago>>(() =>
    facturaInicial ? { [facturaInicial.id]: facturaInicial } : {},
  );
  const [cargandoFacturas, setCargandoFacturas] = useState(false);
  const [dialogoFacturaId, setDialogoFacturaId] = useState<string | null>(null);
  const [borradorRetenciones, setBorradorRetenciones] = useState<string[]>([]);
  const [otros, setOtros] = useState<LineaOtroPago[]>([lineaOtroVacia("otro-1", cuentasMovimiento[0]?.id ?? "")]);
  const [notas, setNotas] = useState("");
  const [error, setError] = useState<string | null>(null);
  const validacion = useValidacionFormulario();

  const esRecibido = tipo === "recibido";
  const documento = esRecibido ? "cliente" : "proveedor";
  const visibles = facturasPagina;
  const facturaDialogo = dialogoFacturaId ? (facturasPorId[dialogoFacturaId] ?? null) : null;
  const cuentasItems = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const cuentasMovimientoItems = cuentasMovimiento.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const centrosItems = [
    { value: SIN_CENTRO, label: "Sin centro de costo" },
    ...centrosCosto.map((centro) => ({ value: centro.id, label: `${centro.codigo} · ${centro.nombre}` })),
  ];
  const opcionesRetencion = retenciones.map((retencion) => ({
    value: retencion.id,
    label: `${retencion.nombre} (${retencion.porcentaje} %)`,
  }));

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busqueda.trim());
      setPagina(1);
    }, 350);

    return () => clearTimeout(temporizador);
  }, [busqueda]);

  useEffect(() => {
    if (!contactoId) {
      setFacturasPagina([]);
      setFacturasPorId({});
      setTotalFacturas(0);
      setPaginaActual(1);
      setTotalPaginas(1);
      setCargandoFacturas(false);
      return;
    }

    const numeroSolicitud = solicitud.current + 1;
    solicitud.current = numeroSolicitud;
    setCargandoFacturas(true);

    buscarFacturasPago({ tipo, contactoId, q: busquedaAplicada, pagina, tamano: TAMANO_PAGINA_FACTURAS })
      .then((resultado) => {
        if (solicitud.current !== numeroSolicitud) return;

        const inicialVisible =
          facturaInicial !== null &&
          facturaInicial.contacto_id === contactoId &&
          resultado.pagina === 1 &&
          busquedaAplicada === "" &&
          !resultado.facturas.some((factura) => factura.id === facturaInicial.id);

        setFacturasPagina(
          inicialVisible && facturaInicial !== null
            ? [facturaInicial, ...resultado.facturas].slice(0, TAMANO_PAGINA_FACTURAS)
            : resultado.facturas,
        );
        setFacturasPorId((actuales) => {
          const siguiente = { ...actuales };
          for (const factura of resultado.facturas) siguiente[factura.id] = factura;
          return siguiente;
        });
        setTotalFacturas(resultado.total);
        setPaginaActual(resultado.pagina);
        setTotalPaginas(resultado.totalPaginas);
        setPagina(resultado.pagina);
      })
      .catch((fallo: unknown) => {
        if (solicitud.current !== numeroSolicitud) return;
        setError(fallo instanceof Error ? fallo.message : "No se pudieron cargar las facturas.");
      })
      .finally(() => {
        if (solicitud.current === numeroSolicitud) setCargandoFacturas(false);
      });
  }, [tipo, contactoId, busquedaAplicada, pagina, facturaInicial]);

  function montoNoValido(valor: string | undefined): boolean {
    const limpio = (valor ?? "").trim().replace(/\s/g, "").replace(/,/g, "");
    return limpio !== "" && !/^\d{1,15}(\.\d{1,2})?$/.test(limpio);
  }

  function centavosMonto(valor: string | undefined): number {
    const limpio = (valor ?? "").trim().replace(/\s/g, "").replace(/,/g, "");
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(limpio)) return 0;
    return Math.round(Number(limpio) * 100);
  }

  const totalFacturasCentavos = Object.values(montos).reduce((total, monto) => total + centavosMonto(monto), 0);
  const totalRetenidoCentavos = Object.entries(retencionesFactura).reduce((total, [facturaId, ids]) => {
    const factura = facturasPorId[facturaId];
    return factura ? total + Math.round(retenidoDeFactura(ids, retenciones, factura) * 100) : total;
  }, 0);
  const totalOtros = totalOtrosCentavos(otros);
  const totalActivoCentavos = pestana === "facturas" ? totalFacturasCentavos : totalOtros;

  function cambiarContacto(contacto: ContactoPago | null) {
    const id = contacto?.id ?? "";
    const inicial = facturaInicial?.contacto_id === id ? facturaInicial : null;

    setContactoId(id);
    setMontos(inicial ? { [inicial.id]: saldoPendiente(inicial).toFixed(2) } : {});
    setRetencionesFactura({});
    setBusqueda("");
    setBusquedaAplicada("");
    setPagina(1);
    setPaginaActual(1);
    setTotalPaginas(1);
    setTotalFacturas(0);
    setFacturasPagina([]);
    setFacturasPorId(inicial ? { [inicial.id]: inicial } : {});
    setError(null);
  }

  function cambiarMonto(facturaId: string, valor: string) {
    setMontos((actuales) => ({ ...actuales, [facturaId]: valor }));
  }

  function aplicarRetenciones(facturaId: string, ids: string[]) {
    setRetencionesFactura((actuales) => ({ ...actuales, [facturaId]: ids }));

    const factura = facturasPorId[facturaId];
    if (!factura) return;

    const disponible = Math.max(0, saldoPendiente(factura) - retenidoDeFactura(ids, retenciones, factura));
    const actual = centavosMonto(montos[facturaId]);
    if (actual > Math.round(disponible * 100)) {
      setMontos((actuales) => ({ ...actuales, [facturaId]: disponible.toFixed(2) }));
    }
  }

  function abrirRetenciones(facturaId: string) {
    setBorradorRetenciones(retencionesFactura[facturaId] ?? []);
    setDialogoFacturaId(facturaId);
  }

  function cerrarRetenciones(guardar: boolean) {
    if (guardar && dialogoFacturaId) aplicarRetenciones(dialogoFacturaId, borradorRetenciones);
    setDialogoFacturaId(null);
  }

  function agregarRetencionBorrador() {
    const disponible = retenciones.find((retencion) => !borradorRetenciones.includes(retencion.id));
    if (disponible) setBorradorRetenciones((actuales) => [...actuales, disponible.id]);
  }

  function cambiarRetencionBorrador(indice: number, id: string) {
    setBorradorRetenciones((actuales) => {
      if (actuales.some((actual, posicion) => actual === id && posicion !== indice)) return actuales;
      return actuales.map((actual, posicion) => (posicion === indice ? id : actual));
    });
  }

  function quitarRetencionBorrador(indice: number) {
    setBorradorRetenciones((actuales) => actuales.filter((_, posicion) => posicion !== indice));
  }

  function actualizarOtro(clave: string, cambios: Partial<LineaOtroPago>) {
    setOtros((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function agregarOtro() {
    setOtros((actuales) => [...actuales, lineaOtroVacia(nuevoNumeroLinea(actuales), cuentasMovimiento[0]?.id ?? "")]);
  }

  function quitarOtro(clave: string) {
    setOtros((actuales) => (actuales.length > 1 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function mensajeFacturas(): string {
    if (cargandoFacturas) return "Buscando facturas…";
    if (busquedaAplicada) return "No hay facturas que coincidan con la búsqueda.";
    return `El ${documento} no tiene facturas pendientes.`;
  }

  function reglasFacturas(
    filas: { factura: FacturaPago; monto: string; retenciones: readonly string[] }[],
    visibles: readonly FacturaPago[],
  ): ReglaCampo[] {
    const reglas: ReglaCampo[] = [];
    const primeraFactura = visibles[0];
    const conMonto = filas.filter((fila) => centavosMonto(fila.monto) > 0);

    reglas.push({
      campo: primeraFactura ? `pago-monto-${primeraFactura.id}` : "contacto",
      invalido: conMonto.length === 0,
      mensaje: esRecibido
        ? "Agrega el monto recibido a al menos una factura."
        : "Agrega el monto pagado a al menos una factura.",
    });

    for (const fila of filas) {
      const disponible = Math.round(saldoPendiente(fila.factura) * 100);
      const retenido = Math.round(retenidoDeFactura(fila.retenciones, retenciones, fila.factura) * 100);
      reglas.push({
        campo: `pago-monto-${fila.factura.id}`,
        invalido: montoNoValido(fila.monto),
        mensaje: "El monto no es válido.",
      });
      reglas.push({
        campo: `pago-monto-${fila.factura.id}`,
        invalido: !montoNoValido(fila.monto) && centavosMonto(fila.monto) + retenido > disponible,
        mensaje: "El monto más las retenciones supera lo pendiente.",
      });
    }

    return reglas;
  }

  function reglasOtros(): ReglaCampo[] {
    const reglas: ReglaCampo[] = [];
    const primeraLinea = otros[0];

    reglas.push({
      campo: primeraLinea ? `otro-monto-${primeraLinea.clave}` : "contacto",
      invalido: totalOtros <= 0,
      mensaje: esRecibido ? "Agrega al menos un ingreso." : "Agrega al menos un egreso.",
    });

    for (const linea of otros) {
      reglas.push({
        campo: `otro-monto-${linea.clave}`,
        invalido: montoNoValido(linea.monto),
        mensaje: "El monto no es válido.",
      });
      reglas.push({
        campo: `otro-cuenta-${linea.clave}`,
        invalido: centavosMonto(linea.monto) > 0 && !linea.cuentaId,
        mensaje: esRecibido ? "Selecciona la cuenta del ingreso." : "Selecciona la cuenta del egreso.",
      });
    }

    return reglas;
  }

  function guardar() {
    setError(null);

    const filas = Object.entries(montos).flatMap(([facturaId, monto]) => {
      const factura = facturasPorId[facturaId];
      return factura ? [{ factura, monto, retenciones: retencionesFactura[facturaId] ?? [] }] : [];
    });
    const reglas = [
      requerido("contacto", contactoId, `El ${documento} es requerido.`),
      requerido("cuenta", cuentaId, "La cuenta de caja o banco es requerida."),
      requerido("fecha", fecha, "La fecha del pago es requerida."),
      ...(pestana === "facturas" ? reglasFacturas(filas, visibles) : reglasOtros()),
    ];

    if (!validacion.validar(reglas)) return;

    const mensaje = validarPago({
      tipo,
      contactoId,
      cuentaId,
      fecha,
      metodo,
      pestana,
      filas,
      otros,
      retenciones,
    });

    if (mensaje) {
      setError(mensaje);
      return;
    }

    const aplicaciones =
      pestana === "facturas"
        ? filas
            .filter((fila) => centavosMonto(fila.monto) > 0)
            .map((fila) =>
              esRecibido
                ? {
                    factura_id: fila.factura.id,
                    monto: centavosMonto(fila.monto) / 100,
                    ...(fila.retenciones.length > 0
                      ? { retenciones: fila.retenciones.map((id) => ({ retencion_id: id })) }
                      : {}),
                  }
                : {
                    factura_proveedor_id: fila.factura.id,
                    monto: centavosMonto(fila.monto) / 100,
                    ...(fila.retenciones.length > 0
                      ? { retenciones: fila.retenciones.map((id) => ({ retencion_id: id })) }
                      : {}),
                  },
            )
        : [];
    const otrosEnviados =
      pestana === "otros"
        ? otros
            .filter((linea) => centavosMonto(linea.monto) > 0)
            .map((linea) => ({
              cuenta_id: linea.cuentaId,
              descripcion: linea.descripcion || linea.observacion,
              monto: centavosMonto(linea.monto) / 100,
              itbis_tasa: Number(linea.itbisTasa) || 0,
            }))
        : [];

    iniciar(async () => {
      const resultado = await accion({
        contacto_id: contactoId,
        fecha,
        cuenta_id: cuentaId,
        metodo,
        ...(notas.trim() ? { notas: notas.trim() } : {}),
        ...(centroCostoId ? { centro_costo_id: centroCostoId } : {}),
        aplicaciones,
        otros: otrosEnviados,
      });

      if (!resultado.ok || !resultado.id) {
        setError(resultado.error ?? "No se pudo guardar el pago.");
        return;
      }

      const ruta = esRecibido ? "/dashboard/pagos-recibidos" : "/dashboard/compras/pagos";
      router.push(`${ruta}/${resultado.id}`);
    });
  }

  const tituloFacturas = esRecibido ? "Facturas por cobrar" : "Facturas por pagar";
  const subtituloFacturas = esRecibido
    ? "Agrega el monto recibido a las facturas relacionadas con este ingreso."
    : "Agrega el monto pagado a las facturas relacionadas con este egreso.";
  const etiquetaMonto = esRecibido ? "Monto recibido" : "Monto pagado";
  const etiquetaTotal = esRecibido ? "Total recibido" : "Total pagado";
  const etiquetaTipo = esRecibido ? "Tipo de ingreso" : "Tipo de egreso";
  const etiquetaOtros = esRecibido ? "Otros ingresos" : "Otros egresos";
  const subtituloOtros = esRecibido
    ? "Selecciona las cuentas contables relacionadas con este ingreso."
    : "Selecciona las cuentas contables relacionadas con este egreso.";

  return (
    <form
      noValidate
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 [font-family:var(--font-inter)]"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormCard>
        <header className="flex min-h-20 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
          <div className="min-w-0 md:border-r md:border-slate-400/20 md:pr-4">
            <p className="flex flex-wrap items-baseline gap-2 text-base leading-6 font-semibold text-slate-700">
              {empresa?.nombre ?? "MEDOXIGAS ALC, SRL"}
              {empresa?.rnc ? (
                <span className="text-xs leading-4 font-medium text-slate-500">RNC {empresa.rnc}</span>
              ) : null}
            </p>
            {empresa?.direccion ? <p className="text-xs leading-4 text-slate-500">{empresa.direccion}</p> : null}
          </div>
          <div className="flex min-w-0 flex-col gap-1 md:items-end md:text-right">
            <p className="text-base leading-6 font-semibold text-slate-700">No. {siguienteNumero}</p>
            <p className="text-xs leading-4 text-slate-500">
              {esRecibido ? "Recibo de caja" : "Comprobante de egreso"}
            </p>
          </div>
        </header>

        <FormDivider />

        <FormGrid>
          <CampoFormulario
            htmlFor="contacto"
            label={esRecibido ? "Cliente" : "Proveedor"}
            required
            error={validacion.errorDe("contacto")}
          >
            <SelectorContacto
              id="contacto"
              contactos={contactos}
              valor={contactoId}
              onCambio={(contacto) => {
                cambiarContacto(contacto);
                validacion.limpiar("contacto");
              }}
              tipoInicial={esRecibido ? "cliente" : "proveedor"}
              className={FORM_COMBO}
              placeholder={esRecibido ? "Buscar cliente…" : "Buscar proveedor…"}
            />
          </CampoFormulario>

          <CampoFormulario htmlFor="cuenta" label="Cuenta bancaria" required error={validacion.errorDe("cuenta")}>
            <Select
              items={cuentasItems}
              value={cuentaId || null}
              onValueChange={(valor: string | null) => {
                setCuentaId(valor ?? "");
                validacion.limpiar("cuenta");
              }}
            >
              <SelectTrigger id="cuenta" className={FORM_SELECT}>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {cuentasItems.map((cuenta) => (
                  <SelectItem key={cuenta.value} value={cuenta.value}>
                    {cuenta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoFormulario>

          <CampoFormulario htmlFor="fecha" label="Fecha de pago" required error={validacion.errorDe("fecha")}>
            <DatePicker
              id="fecha"
              value={fecha}
              onChange={(valor) => {
                setFecha(valor);
                validacion.limpiar("fecha");
              }}
            />
          </CampoFormulario>

          <CampoFormulario htmlFor="metodo" label="Forma de pago" required>
            <Select
              items={[...METODOS]}
              value={metodo}
              onValueChange={(valor: string | null) => {
                if (esMetodo(valor)) setMetodo(valor);
              }}
            >
              <SelectTrigger id="metodo" className={FORM_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {METODOS.map((opcion) => (
                  <SelectItem key={opcion.value} value={opcion.value}>
                    {opcion.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoFormulario>

          <CampoFormulario htmlFor="centro-costo" label="Centro de costo">
            <Select
              items={centrosItems}
              value={centroCostoId || SIN_CENTRO}
              onValueChange={(valor: string | null) =>
                setCentroCostoId(valor == null || valor === SIN_CENTRO ? "" : valor)
              }
            >
              <SelectTrigger id="centro-costo" className={FORM_SELECT}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {centrosItems.map((centro) => (
                  <SelectItem key={centro.value} value={centro.value}>
                    {centro.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CampoFormulario>
        </FormGrid>

        <section>
          <p className="mb-1 text-sm leading-5 font-medium text-slate-700">{etiquetaTipo}</p>
          <Tabs
            value={pestana}
            onValueChange={(valor: string) => {
              if (valor === "facturas" || valor === "otros") {
                setPestana(valor);
                setError(null);
              }
            }}
            className="gap-6"
          >
            <TabsList className="h-[42px] min-w-full rounded-lg border border-slate-200 bg-slate-400/10 p-1">
              <TabsTrigger
                value="facturas"
                className="h-8 rounded-md text-sm font-semibold text-slate-600 data-active:bg-white! data-active:text-slate-700! data-active:shadow-sm!"
              >
                {esRecibido ? "Pago a factura de cliente" : "Pago a factura de proveedor"}
              </TabsTrigger>
              <TabsTrigger
                value="otros"
                className="h-8 rounded-md text-sm font-semibold text-slate-600 data-active:bg-white! data-active:text-slate-700! data-active:shadow-sm!"
              >
                {etiquetaOtros}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="facturas" className="mt-0 flex flex-col gap-4">
              <FormSectionTitle descripcion={subtituloFacturas}>{tituloFacturas}</FormSectionTitle>

              <InputGroup className="h-9 max-w-sm rounded-lg border-slate-300 bg-white">
                <InputGroupAddon align="inline-start" className="pl-2">
                  <Search className="size-4 text-slate-400" />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Buscar por número o NCF"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  className="text-sm text-slate-700 md:text-sm"
                />
              </InputGroup>

              {!contactoId ? (
                <div className="flex items-start gap-4 rounded-xl border border-indigo-600/20 bg-indigo-100 p-4 text-sm text-slate-700">
                  <p>Selecciona un {documento} para traer sus facturas pendientes.</p>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-[10px] border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className={CELDA_ENCABEZADO}>Número (NCF)</TableHead>
                      <TableHead className={CELDA_ENCABEZADO}>Vencimiento</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} text-right`}>Total</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} text-right`}>Retenciones</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} text-right`}>Por cobrar</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} w-[170px]`}>{etiquetaMonto}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contactoId && visibles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                          {mensajeFacturas()}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibles.map((factura) => {
                        const saldo = saldoPendiente(factura);
                        const retenido = retenidoDeFactura(retencionesFactura[factura.id] ?? [], retenciones, factura);
                        const vencida = factura.vencimiento < fechaHoy;

                        return (
                          <TableRow key={factura.id} className="border-slate-200 hover:bg-slate-50/60">
                            <TableCell className="px-2 py-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-700">
                                  {factura.ncf ?? `#${factura.numero}`}
                                </span>
                                <span className="text-xs text-slate-500">#{factura.numero}</span>
                              </div>
                            </TableCell>
                            <TableCell
                              className={`px-2 py-3 text-sm tabular-nums ${vencida ? "font-medium text-red-600" : "text-slate-600"}`}
                            >
                              {formatoDia(factura.vencimiento)}
                            </TableCell>
                            <TableCell className="px-2 py-3 text-right text-sm text-slate-600 tabular-nums">
                              {formatoMoneda(factura.total)}
                            </TableCell>
                            <TableCell className="px-2 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  readOnly
                                  value={formatoMoneda(retenido)}
                                  aria-label={`Retenciones de la factura ${factura.numero}`}
                                  className="h-9 w-[105px] rounded-lg border-slate-300 bg-white px-2 text-right text-sm text-slate-700 tabular-nums"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-8 text-slate-500 hover:text-slate-900"
                                  onClick={() => abrirRetenciones(factura.id)}
                                  aria-label={`Editar retenciones de la factura ${factura.numero}`}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="px-2 py-3 text-right text-sm text-slate-600 tabular-nums">
                              {formatoMoneda(saldo)}
                            </TableCell>
                            <TableCell className="px-2 py-3">
                              <InputGroup className={FORM_INPUT_GROUP}>
                                <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                                  RD$
                                </InputGroupAddon>
                                <InputGroupInput
                                  id={`pago-monto-${factura.id}`}
                                  inputMode="decimal"
                                  value={montos[factura.id] ?? ""}
                                  placeholder="0.00"
                                  onChange={(evento) => {
                                    cambiarMonto(factura.id, evento.target.value);
                                    validacion.limpiar(`pago-monto-${factura.id}`);
                                  }}
                                  aria-label={`Monto de la factura ${factura.numero}`}
                                  aria-invalid={Boolean(validacion.errorDe(`pago-monto-${factura.id}`))}
                                  className="h-full min-w-0 pl-1 text-right text-sm text-slate-700 md:text-sm"
                                />
                              </InputGroup>
                              {validacion.errorDe(`pago-monto-${factura.id}`) ? (
                                <p role="alert" className="text-destructive mt-1 text-xs">
                                  {validacion.errorDe(`pago-monto-${factura.id}`)}
                                </p>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalFacturas > 0 ? (
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>
                    {Math.min((paginaActual - 1) * TAMANO_PAGINA_FACTURAS + 1, totalFacturas)}–
                    {Math.min(paginaActual * TAMANO_PAGINA_FACTURAS, totalFacturas)} de {totalFacturas}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={paginaActual <= 1}
                      onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={paginaActual >= totalPaginas}
                      onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                      aria-label="Página siguiente"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="otros" className="mt-0 flex flex-col gap-4">
              <FormSectionTitle descripcion={subtituloOtros}>{etiquetaOtros}</FormSectionTitle>

              <div className="overflow-hidden rounded-[10px] border border-slate-200">
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className={CELDA_ENCABEZADO}>Cuenta contable</TableHead>
                      <TableHead className={CELDA_ENCABEZADO}>Concepto</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} w-[150px] text-right`}>Monto</TableHead>
                      <TableHead className={`${CELDA_ENCABEZADO} w-[150px]`}>Impuesto</TableHead>
                      <TableHead className={CELDA_ENCABEZADO}>Observación</TableHead>
                      <TableHead className={CELDA_ENCABEZADO} />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otros.map((linea, indice) => (
                      <TableRow key={linea.clave} className="border-slate-200 hover:bg-slate-50/60">
                        <TableCell className="px-2 py-2">
                          <Select
                            items={cuentasMovimientoItems}
                            value={linea.cuentaId || null}
                            onValueChange={(valor: string | null) =>
                              actualizarOtro(linea.clave, { cuentaId: valor ?? "" })
                            }
                          >
                            <SelectTrigger
                              className="h-9 w-[220px] rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700"
                              aria-label={`Cuenta de la línea ${indice + 1}`}
                            >
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              {cuentasMovimientoItems.map((cuenta) => (
                                <SelectItem key={cuenta.value} value={cuenta.value}>
                                  {cuenta.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {validacion.errorDe(`otro-cuenta-${linea.clave}`) ? (
                            <p role="alert" className="text-destructive mt-1 text-xs">
                              {validacion.errorDe(`otro-cuenta-${linea.clave}`)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Input
                            value={linea.descripcion}
                            placeholder="Concepto"
                            onChange={(evento) => actualizarOtro(linea.clave, { descripcion: evento.target.value })}
                            className="h-9 w-[180px] rounded-lg border-slate-300 bg-white text-sm"
                            aria-label={`Concepto de la línea ${indice + 1}`}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <InputGroup className="h-9 w-[145px] rounded-lg border-slate-300 bg-white">
                            <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                              RD$
                            </InputGroupAddon>
                            <InputGroupInput
                              id={`otro-monto-${linea.clave}`}
                              inputMode="decimal"
                              value={linea.monto}
                              placeholder="0.00"
                              onChange={(evento) => {
                                actualizarOtro(linea.clave, { monto: evento.target.value });
                                validacion.limpiar(`otro-monto-${linea.clave}`);
                              }}
                              aria-label={`Monto de la línea ${indice + 1}`}
                              aria-invalid={Boolean(validacion.errorDe(`otro-monto-${linea.clave}`))}
                              className="h-full min-w-0 pl-1 text-right text-sm text-slate-700 md:text-sm"
                            />
                          </InputGroup>
                          {validacion.errorDe(`otro-monto-${linea.clave}`) ? (
                            <p role="alert" className="text-destructive mt-1 text-xs">
                              {validacion.errorDe(`otro-monto-${linea.clave}`)}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Select
                            items={OPCIONES_ITBIS}
                            value={linea.itbisTasa}
                            onValueChange={(valor: string | null) =>
                              actualizarOtro(linea.clave, { itbisTasa: valor ?? "0" })
                            }
                          >
                            <SelectTrigger
                              className="h-9 w-[140px] rounded-lg border-slate-300 bg-white px-2 text-sm text-slate-700"
                              aria-label={`Impuesto de la línea ${indice + 1}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false}>
                              {OPCIONES_ITBIS.map((opcion) => (
                                <SelectItem key={opcion.value} value={opcion.value}>
                                  {opcion.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Input
                            value={linea.observacion}
                            placeholder="Observación"
                            onChange={(evento) => actualizarOtro(linea.clave, { observacion: evento.target.value })}
                            className="h-9 w-[170px] rounded-lg border-slate-300 bg-white text-sm"
                            aria-label={`Observación de la línea ${indice + 1}`}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="size-8 text-slate-500 hover:text-red-600"
                            disabled={otros.length === 1}
                            onClick={() => quitarOtro(linea.clave)}
                            aria-label={`Quitar línea ${indice + 1}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="text-primary h-9 w-fit justify-start gap-1 rounded-[10px] px-2 text-sm font-medium hover:bg-slate-200/45"
                onClick={agregarOtro}
              >
                <Plus className="size-4" />
                Agregar línea
              </Button>
            </TabsContent>
          </Tabs>
        </section>

        <FormTotal>
          {pestana === "facturas" && totalRetenidoCentavos > 0 ? (
            <div className="flex h-6 items-center justify-between">
              <span>Retenciones</span>
              <span className="tabular-nums">{formatoMonedaCentavos(totalRetenidoCentavos)}</span>
            </div>
          ) : null}
          <div className="mt-3 flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>{etiquetaTotal}</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totalActivoCentavos)}</span>
          </div>
        </FormTotal>

        <CampoFormulario htmlFor="notas" label="Observaciones">
          <Textarea
            id="notas"
            value={notas}
            placeholder="Agrega detalles adicionales que serán visibles en la impresión."
            onChange={(evento) => setNotas(evento.target.value)}
            className={FORM_TEXTAREA}
          />
        </CampoFormulario>
      </FormCard>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded-[12px] px-6 text-base font-medium"
          render={<Link href={rutaCancelar} />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6 text-base font-medium">
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar
        </Button>
      </div>

      <Dialog
        open={dialogoFacturaId !== null}
        onOpenChange={(abierto: boolean) => {
          if (!abierto) cerrarRetenciones(false);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Retenciones aplicadas</DialogTitle>
            <DialogDescription>
              {facturaDialogo
                ? `Número de factura: ${facturaDialogo.ncf ?? `#${facturaDialogo.numero}`} · Monto pendiente: ${formatoMoneda(
                    saldoPendiente(facturaDialogo),
                  )}`
                : null}
            </DialogDescription>
          </DialogHeader>

          {facturaDialogo ? (
            <div className="flex flex-col gap-3">
              {borradorRetenciones.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin retenciones aplicadas.</p>
              ) : (
                borradorRetenciones.map((retencionId, indice) => {
                  const monto = retenidoDeFactura([retencionId], retenciones, facturaDialogo);
                  return (
                    <div key={retencionId} className="flex items-end gap-2">
                      <CampoFormulario
                        htmlFor={`retencion-${indice}`}
                        label="Tipo de retención"
                        required
                        className="flex-1"
                      >
                        <Select
                          items={opcionesRetencion}
                          value={retencionId}
                          onValueChange={(valor: string | null) => {
                            if (valor) cambiarRetencionBorrador(indice, valor);
                          }}
                        >
                          <SelectTrigger id={`retencion-${indice}`} className={FORM_SELECT}>
                            <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            {opcionesRetencion.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CampoFormulario>

                      <CampoFormulario
                        htmlFor={`retencion-valor-${indice}`}
                        label="Valor retenido"
                        required
                        className="w-[150px]"
                      >
                        <InputGroup className={FORM_INPUT_GROUP}>
                          <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                            RD$
                          </InputGroupAddon>
                          <InputGroupInput
                            id={`retencion-valor-${indice}`}
                            readOnly
                            value={monto.toFixed(2)}
                            className="h-full min-w-0 pl-1 text-right text-sm text-slate-700 md:text-sm"
                          />
                        </InputGroup>
                      </CampoFormulario>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mb-1 size-8 text-slate-500 hover:text-red-600"
                        onClick={() => quitarRetencionBorrador(indice)}
                        aria-label={`Quitar retención ${indice + 1}`}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })
              )}

              <Button
                type="button"
                variant="ghost"
                className="text-primary h-9 w-fit justify-start gap-1 rounded-[10px] px-2 text-sm font-medium hover:bg-slate-200/45"
                onClick={agregarRetencionBorrador}
                disabled={borradorRetenciones.length >= retenciones.length}
              >
                <Plus className="size-4" />
                Agregar otra retención
              </Button>
            </div>
          ) : null}

          <DialogFooter className="items-center sm:justify-between">
            <p className="text-muted-foreground text-left text-xs">Los campos marcados con * son obligatorios.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => cerrarRetenciones(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => cerrarRetenciones(true)}>
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  );
}
