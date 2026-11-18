import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { FileMinus2 } from "lucide-react";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  type ItemResumenDetalle,
  type SeccionDocumento,
  SeccionesDocumento,
  TablaDocumento,
  TarjetaDocumento,
  TotalesDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { aCentavos, aNumero } from "@/lib/compras/calculo";
import { cargarCuentasCajaBanco, obtenerFacturaProveedor } from "@/lib/compras/consultas";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import type {
  AsientoDetalle,
  AsientoLinea,
  EstadoDocumento,
  FacturaDetalle,
  LineaDetalle,
  MetodoPago,
  PagoProveedorVista,
} from "@/lib/compras/tipos";
import { getRetencionesActivas } from "@/lib/configuracion/consultas";
import { rutaAsiento, rutaContacto, rutaCuenta, rutaPagoProveedor, rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";

import { AccionesFactura } from "../_components/acciones-factura";

const ETIQUETAS_METODO: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
};

const ESTADOS_COMPRA: Record<EstadoDocumento, EstadoDetalle> = {
  abierta: { etiqueta: "Por pagar", tono: "amber" },
  pagada: { etiqueta: "Pagada", tono: "green" },
  anulada: { etiqueta: "Anulada", tono: "red" },
};

function CuentaLinea({ linea }: { linea: LineaDetalle }) {
  if (!linea.cuentas) return null;

  const texto = `${linea.cuentas.codigo} · ${linea.cuentas.nombre}`;
  return (
    <span className="text-muted-foreground text-xs">
      {linea.cuenta_id ? <Enlace href={rutaCuenta(linea.cuenta_id)}>{texto}</Enlace> : texto}
    </span>
  );
}

function InformacionCompra({ factura }: { factura: FacturaDetalle }) {
  const campos: CampoInformacionDocumento[] = [
    {
      etiqueta: "Proveedor",
      valor: factura.contactos ? (
        <Enlace href={rutaContacto(factura.contacto_id)}>{factura.contactos.nombre}</Enlace>
      ) : (
        "—"
      ),
    },
    { etiqueta: "RNC", valor: factura.contactos?.rnc_cedula ?? "—" },
    {
      etiqueta: "NCF",
      valor: factura.ncf ? <span className="font-mono text-xs">{factura.ncf}</span> : "—",
    },
    { etiqueta: "Fecha", valor: formatoDia(factura.fecha) },
    { etiqueta: "Vencimiento", valor: formatoDia(factura.vencimiento) },
    {
      etiqueta: "Notas",
      valor: factura.notas ? <span className="whitespace-pre-line">{factura.notas}</span> : "—",
    },
  ];

  return <InformacionDocumento titulo="Información de la factura" campos={campos} />;
}

function FilasLineas({ lineas }: { lineas: LineaDetalle[] }) {
  return lineas.map((linea) => (
    <TableRow key={linea.id}>
      <TableCell className="h-12 px-4 text-sm whitespace-normal">
        <div className="flex flex-col">
          <span>{linea.descripcion || "—"}</span>
          {linea.productos ? (
            <span className="text-muted-foreground text-xs">
              {linea.producto_id ? (
                <Enlace href={rutaProducto(linea.producto_id)}>{linea.productos.nombre}</Enlace>
              ) : (
                linea.productos.nombre
              )}
            </span>
          ) : null}
          <CuentaLinea linea={linea} />
        </div>
      </TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoCantidad(linea.cantidad)}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoCantidad(linea.itbis_tasa)} %</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.subtotal)}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.total)}</TableCell>
    </TableRow>
  ));
}

function FilasPagosAsociados({ pagos }: { pagos: PagoProveedorVista[] }) {
  return pagos.map((pago) => (
    <TableRow key={pago.id}>
      <TableCell className="h-12 px-4 text-sm font-medium">
        <Enlace href={rutaPagoProveedor(pago.id)}>#{pago.numero}</Enlace>
      </TableCell>
      <TableCell className="h-12 px-4 text-sm">{formatoDia(pago.fecha)}</TableCell>
      <TableCell className="h-12 px-4 text-sm">{ETIQUETAS_METODO[pago.metodo]}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(pago.monto)}</TableCell>
      <TableCell className="h-12 px-4 text-sm">
        <Badge variant={pago.estado === "anulado" ? "destructive" : "default"}>
          {pago.estado === "anulado" ? "Anulado" : "Activo"}
        </Badge>
      </TableCell>
    </TableRow>
  ));
}

function FilasAsiento({ lineasAsiento }: { lineasAsiento: AsientoLinea[] }) {
  return lineasAsiento.map((linea) => (
    <TableRow key={linea.id}>
      <TableCell className="h-12 px-4 text-sm whitespace-normal">
        {linea.cuentas ? (
          <Enlace href={rutaCuenta(linea.cuenta_id)}>
            {linea.cuentas.codigo} · {linea.cuentas.nombre}
          </Enlace>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="h-12 px-4 text-sm whitespace-normal">{linea.descripcion || "—"}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.debito)}</TableCell>
      <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.credito)}</TableCell>
    </TableRow>
  ));
}

function PanelContabilidad({
  asiento,
  lineasAsiento,
}: {
  asiento: AsientoDetalle | null;
  lineasAsiento: AsientoLinea[];
}) {
  if (!asiento) return <p className="text-muted-foreground text-sm">La factura no tiene asiento contable.</p>;

  const debitos = lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.debito), 0);
  const creditos = lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.credito), 0);
  const cuadrado = aCentavos(debitos) === aCentavos(creditos);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        <Enlace href={rutaAsiento(asiento.id)} className="font-medium">
          Asiento #{asiento.numero}
        </Enlace>{" "}
        · {formatoDia(asiento.fecha)} · {asiento.descripcion}
      </p>

      <TablaDocumento
        columnas={[
          { titulo: "Cuenta" },
          { titulo: "Descripción" },
          { titulo: "Débito", alineadaDerecha: true },
          { titulo: "Crédito", alineadaDerecha: true },
        ]}
        vacio="El asiento no tiene líneas."
        hayFilas={lineasAsiento.length > 0}
        pie={
          <TableRow>
            <TableCell colSpan={2} className="h-12 px-4 text-sm font-semibold">
              Totales · {cuadrado ? "Cuadrado ✓" : "Descuadrado"}
            </TableCell>
            <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
              {formatoMoneda(debitos)}
            </TableCell>
            <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
              {formatoMoneda(creditos)}
            </TableCell>
          </TableRow>
        }
      >
        <FilasAsiento lineasAsiento={lineasAsiento} />
      </TablaDocumento>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, detalle, cuentasBase, retencionesBase, empresa] = await Promise.all([
    getRol(),
    obtenerFacturaProveedor(id),
    cargarCuentasCajaBanco(),
    getRetencionesActivas(),
    getEmpresa(),
  ]);
  if (rol == null) redirect("/unauthorized");
  if (!detalle) notFound();

  const { factura, lineas, asiento, lineasAsiento, pagos } = detalle;
  const puedePagar = (rol === "admin" || rol === "contador") && factura.estado === "abierta";
  const puedeEscribir = rol === "admin" || rol === "contador";
  const cuentasCajaBanco = puedePagar ? cuentasBase : [];
  const retenciones = puedePagar ? retencionesBase : [];

  const total = aNumero(factura.total);
  const pagado = aNumero(factura.pagado);
  const credito = aNumero(factura.credito);
  const retenido = aNumero(factura.retenido);
  const saldo = total - pagado - credito - retenido;

  const resumen: ItemResumenDetalle[] = [
    { etiqueta: "Valor total", valor: formatoMoneda(total) },
    { etiqueta: "Valor retenido", valor: formatoMoneda(retenido) },
    { etiqueta: "Total pagado", valor: formatoMoneda(pagado) },
    ...(credito > 0 ? [{ etiqueta: "Notas de crédito", valor: formatoMoneda(credito) }] : []),
    { etiqueta: "Por pagar", valor: formatoMoneda(saldo), peligro: true },
  ];

  const secciones: SeccionDocumento[] = [
    {
      valor: "pagos",
      etiqueta: "Pagos asociados",
      contenido: (
        <TablaDocumento
          columnas={[
            { titulo: "Número" },
            { titulo: "Fecha" },
            { titulo: "Método" },
            { titulo: "Monto", alineadaDerecha: true },
            { titulo: "Estado" },
          ]}
          vacio="Sin pagos."
          hayFilas={pagos.length > 0}
        >
          <FilasPagosAsociados pagos={pagos} />
        </TablaDocumento>
      ),
    },
    {
      valor: "contabilidad",
      etiqueta: "Contabilidad",
      contenido: <PanelContabilidad asiento={asiento} lineasAsiento={lineasAsiento} />,
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/compras"
      etiquetaVolver="Volver a compras"
      titulo={`Factura de proveedor #${factura.numero}`}
      estado={ESTADOS_COMPRA[factura.estado]}
      acciones={
        <>
          {puedeEscribir && factura.estado !== "anulada" ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={`/dashboard/compras/notas-credito/nueva?factura=${factura.id}`} prefetch={false} />}
            >
              <FileMinus2 data-icon="inline-start" />
              Nota de crédito
            </Button>
          ) : null}
          <AccionesFactura
            facturaId={factura.id}
            numero={factura.numero}
            estado={factura.estado}
            saldo={saldo}
            subtotal={aNumero(factura.subtotal)}
            itbis={aNumero(factura.itbis)}
            cuentas={cuentasCajaBanco}
            retenciones={retenciones}
            puedeRegistrarPago={puedeEscribir}
            puedeAnular={puedeEscribir}
          />
        </>
      }
      resumen={resumen}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={String(factura.numero)}>
        <InformacionCompra factura={factura} />

        <TablaDocumento
          titulo="Líneas de la factura"
          columnas={[
            { titulo: "Descripción" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Costo", alineadaDerecha: true },
            { titulo: "ITBIS %", alineadaDerecha: true },
            { titulo: "Subtotal", alineadaDerecha: true },
            { titulo: "ITBIS", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="La factura no tiene líneas."
          hayFilas={lineas.length > 0}
        >
          <FilasLineas lineas={lineas} />
        </TablaDocumento>

        <TotalesDocumento
          filas={[
            { etiqueta: "Subtotal", valor: formatoMoneda(aNumero(factura.subtotal)) },
            { etiqueta: "ITBIS", valor: formatoMoneda(aNumero(factura.itbis)) },
          ]}
          total={formatoMoneda(total)}
        />
      </TarjetaDocumento>

      <SeccionesDocumento secciones={secciones} />
    </DocumentoDetalle>
  );
}
