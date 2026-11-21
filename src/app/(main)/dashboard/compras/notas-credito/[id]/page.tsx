import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  type SeccionDocumento,
  SeccionesDocumento,
  TablaDocumento,
  TarjetaDocumento,
  TotalesDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { BookOpen, ReceiptText } from "@/components/icons";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { getPerfil } from "@/lib/auth/rol";
import { aCentavos, aNumero } from "@/lib/compras/calculo";
import { formatoCantidad, formatoMoneda } from "@/lib/compras/formato";
import { getNotaCreditoCompraVista } from "@/lib/compras/notas-credito/consultas";
import { rutaAsiento, rutaCompra, rutaContacto, rutaCuenta, rutaProducto } from "@/lib/enlaces";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";

import { AccionesNotaCompra } from "../_components/acciones-nota-compra";

function ncfVisible(valor: string | null): string {
  return valor ?? "—";
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const { id } = await params;
  const [nota, empresa] = await Promise.all([getNotaCreditoCompraVista(id), getEmpresa()]);
  if (!nota) notFound();

  const puedeEscribir = perfil.rol === "admin" || perfil.rol === "contador";
  const debitos = nota.lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.debito), 0);
  const creditos = nota.lineasAsiento.reduce((suma, linea) => suma + aNumero(linea.credito), 0);
  const cuadrado = aCentavos(debitos) === aCentavos(creditos);

  const estado: EstadoDetalle =
    nota.estado === "anulada" ? { etiqueta: "Anulada", tono: "red" } : { etiqueta: "Activa", tono: "green" };

  const informacion: CampoInformacionDocumento[] = [
    {
      etiqueta: "Proveedor",
      valor: <Enlace href={rutaContacto(nota.contacto_id)}>{nota.proveedor_nombre}</Enlace>,
    },
    {
      etiqueta: "Factura de proveedor",
      valor: (
        <Enlace href={rutaCompra(nota.factura_proveedor_id)}>
          {`#${nota.factura_numero}`}
          {nota.factura_ncf ? ` — ${nota.factura_ncf}` : ""}
        </Enlace>
      ),
    },
    { etiqueta: "Comprobante", valor: "Nota de crédito del proveedor (B04)" },
    { etiqueta: "Fecha", valor: formatoDia(nota.fecha) },
    { etiqueta: "Devuelve inventario", valor: nota.devuelve_inventario ? "Sí" : "No" },
    {
      etiqueta: "Notas",
      valor: nota.notas ? <span className="whitespace-pre-line">{nota.notas}</span> : "—",
    },
  ];

  const secciones: SeccionDocumento[] = [
    {
      valor: "contabilidad",
      etiqueta: "Asiento contable",
      contenido: nota.asiento ? (
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            <Enlace href={rutaAsiento(nota.asiento.id)} className="font-medium">
              Asiento #{nota.asiento.numero}
            </Enlace>{" "}
            · {formatoDia(nota.asiento.fecha)} · {nota.asiento.descripcion}
          </p>

          <TablaDocumento
            columnas={[
              { titulo: "Cuenta" },
              { titulo: "Descripción" },
              { titulo: "Débito", alineadaDerecha: true },
              { titulo: "Crédito", alineadaDerecha: true },
            ]}
            vacio="El asiento no tiene líneas."
            hayFilas={nota.lineasAsiento.length > 0}
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
            {nota.lineasAsiento.map((linea) => (
              <FilaNavegable key={linea.id} href={linea.cuentas ? rutaCuenta(linea.cuenta_id) : null}>
                <TableCell className="h-12 px-4 text-sm whitespace-normal">
                  {linea.cuentas ? (
                    <Enlace href={rutaCuenta(linea.cuenta_id)}>
                      {linea.cuentas.codigo} — {linea.cuentas.nombre}
                    </Enlace>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="h-12 px-4 text-sm whitespace-normal">{linea.descripcion || "—"}</TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoMoneda(linea.debito)}
                </TableCell>
                <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                  {formatoMoneda(linea.credito)}
                </TableCell>
              </FilaNavegable>
            ))}
          </TablaDocumento>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">La nota no tiene asiento contable.</p>
      ),
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/compras/notas-credito"
      etiquetaVolver="Volver a notas de crédito en compras"
      titulo={`Nota de crédito #${nota.numero}`}
      estado={estado}
      acciones={
        <>
          {nota.asiento_id ? (
            <Button
              variant="outline"
              className={CLASE_BOTON_DOCUMENTO}
              render={<Link href={rutaAsiento(nota.asiento_id)} prefetch={false} />}
            >
              <BookOpen data-icon="inline-start" />
              Ver asiento
            </Button>
          ) : null}
          <Button
            variant="outline"
            className={CLASE_BOTON_DOCUMENTO}
            render={<Link href={rutaCompra(nota.factura_proveedor_id)} prefetch={false} />}
          >
            <ReceiptText data-icon="inline-start" />
            Ver factura de proveedor
          </Button>
          {puedeEscribir && nota.estado === "activa" ? (
            <AccionesNotaCompra notaId={nota.id} numero={nota.numero} />
          ) : null}
        </>
      }
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={ncfVisible(nota.ncf)}>
        <InformacionDocumento titulo="Información de la nota" campos={informacion} columnas={2} />

        <TablaDocumento
          titulo="Líneas de la nota"
          columnas={[
            { titulo: "Descripción" },
            { titulo: "Cantidad", alineadaDerecha: true },
            { titulo: "Costo", alineadaDerecha: true },
            { titulo: "ITBIS %", alineadaDerecha: true },
            { titulo: "Subtotal", alineadaDerecha: true },
            { titulo: "ITBIS", alineadaDerecha: true },
            { titulo: "Total", alineadaDerecha: true },
          ]}
          vacio="La nota no tiene líneas."
          hayFilas={nota.lineas.length > 0}
        >
          {nota.lineas.map((linea) => (
            <FilaNavegable key={linea.id} href={linea.producto_id ? rutaProducto(linea.producto_id) : null}>
              <TableCell className="h-12 px-4 text-sm font-medium whitespace-normal">
                <div className="flex flex-col">
                  <span>{linea.descripcion}</span>
                  {linea.productos ? (
                    <span className="text-muted-foreground text-xs">
                      {linea.producto_id ? (
                        <Enlace href={rutaProducto(linea.producto_id)}>{linea.productos.nombre}</Enlace>
                      ) : (
                        linea.productos.nombre
                      )}
                    </span>
                  ) : null}
                  {linea.cuentas ? (
                    <span className="text-muted-foreground text-xs">
                      {linea.cuenta_id ? (
                        <Enlace href={rutaCuenta(linea.cuenta_id)}>
                          {linea.cuentas.codigo} · {linea.cuentas.nombre}
                        </Enlace>
                      ) : (
                        `${linea.cuentas.codigo} · ${linea.cuentas.nombre}`
                      )}
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.cantidad)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.costo)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoCantidad(linea.itbis_tasa)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {formatoMoneda(linea.subtotal)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">{formatoMoneda(linea.itbis)}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-medium tabular-nums">
                {formatoMoneda(linea.total)}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>

        <TotalesDocumento
          filas={[
            { etiqueta: "Subtotal", valor: formatoMoneda(nota.subtotal) },
            { etiqueta: "ITBIS", valor: formatoMoneda(nota.itbis) },
          ]}
          total={formatoMoneda(nota.total)}
        />
      </TarjetaDocumento>

      <SeccionesDocumento secciones={secciones} />
    </DocumentoDetalle>
  );
}
