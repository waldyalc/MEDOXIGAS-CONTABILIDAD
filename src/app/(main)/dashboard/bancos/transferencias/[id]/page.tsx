import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BookOpen } from "lucide-react";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  InformacionDocumento,
  TablaDocumento,
  TarjetaDocumento,
  TotalesDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaAsiento, rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoDia } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

import { getDetalleTransferencia } from "./_consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const [transferencia, empresa] = await Promise.all([getDetalleTransferencia(id), getEmpresa()]);
  if (!transferencia) notFound();

  const salida = transferencia.lineas.find((linea) => linea.credito > 0);
  const entrada = transferencia.lineas.find((linea) => linea.debito > 0);
  const montoCentavos = valorACentavos(entrada?.debito ?? salida?.credito ?? 0);
  const esTransferencia = transferencia.origenTipo === "transferencia";
  const cuentaOrigen = esTransferencia ? salida : entrada;
  const cuentaDestino = esTransferencia ? entrada : salida;
  const debitos = transferencia.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = transferencia.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);
  const titulo = `${esTransferencia ? "Transferencia" : "Depósito"} #${transferencia.numero}`;

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "Fecha", valor: formatoDia(transferencia.fecha) },
    {
      etiqueta: "Descripción",
      valor: <span className="whitespace-pre-line">{transferencia.descripcion || "—"}</span>,
    },
    {
      etiqueta: esTransferencia ? "Desde" : "Cuenta destino",
      valor: cuentaOrigen?.cuenta ? (
        <Enlace href={rutaCuenta(cuentaOrigen.cuenta.id)}>
          {cuentaOrigen.cuenta.codigo} · {cuentaOrigen.cuenta.nombre}
        </Enlace>
      ) : (
        "—"
      ),
    },
    {
      etiqueta: esTransferencia ? "Hacia" : "Contrapartida",
      valor: cuentaDestino?.cuenta ? (
        <Enlace href={rutaCuenta(cuentaDestino.cuenta.id)}>
          {cuentaDestino.cuenta.codigo} · {cuentaDestino.cuenta.nombre}
        </Enlace>
      ) : (
        "—"
      ),
    },
    ...(transferencia.numeracionIngreso
      ? [{ etiqueta: "Numeración ingreso", valor: transferencia.numeracionIngreso }]
      : []),
    ...(transferencia.numeracionEgreso
      ? [{ etiqueta: "Numeración egreso", valor: transferencia.numeracionEgreso }]
      : []),
  ];

  return (
    <ContenedorDetalle>
      <EncabezadoPagina
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {titulo}
            <Badge variant="secondary">{esTransferencia ? "Entre cuentas" : "Depósito"}</Badge>
          </span>
        }
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Bancos", href: "/dashboard/bancos" },
          { etiqueta: titulo },
        ]}
        acciones={
          <Button
            variant="outline"
            className={CLASE_BOTON_DOCUMENTO}
            render={<Link href={rutaAsiento(transferencia.id)} prefetch={false} />}
          >
            <BookOpen data-icon="inline-start" />
            Ver asiento
          </Button>
        }
      />

      <TarjetaDocumento empresa={empresa} numeroDocumento={String(transferencia.numero)}>
        <InformacionDocumento titulo="Información del movimiento" campos={informacion} columnas={2} />

        <TablaDocumento
          titulo="Asiento contable"
          columnas={[
            { titulo: "Cuenta" },
            { titulo: "Descripción" },
            { titulo: "Débito", alineadaDerecha: true },
            { titulo: "Crédito", alineadaDerecha: true },
          ]}
          vacio="El movimiento no tiene líneas."
          hayFilas={transferencia.lineas.length > 0}
          pie={
            <TableRow>
              <TableCell colSpan={2} className="h-12 px-4 text-sm font-semibold">
                Totales
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatearRd(debitos)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatearRd(creditos)}
              </TableCell>
            </TableRow>
          }
        >
          {transferencia.lineas.map((linea) => (
            <FilaNavegable key={linea.id} href={linea.cuenta ? rutaCuenta(linea.cuenta.id) : null}>
              <TableCell className="h-12 px-4 text-sm whitespace-normal">
                {linea.cuenta ? (
                  <Enlace href={rutaCuenta(linea.cuenta.id)}>
                    <span className="text-muted-foreground">{linea.cuenta.codigo}</span> {linea.cuenta.nombre}
                  </Enlace>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="h-12 px-4 text-sm whitespace-normal">{linea.descripcion || "—"}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {linea.debito === 0 ? "—" : formatearRd(valorACentavos(linea.debito))}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {linea.credito === 0 ? "—" : formatearRd(valorACentavos(linea.credito))}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>

        <TotalesDocumento
          total={formatearRd(montoCentavos)}
          filas={[]}
          etiquetaTotal={esTransferencia ? "Monto transferido" : "Monto del depósito"}
        />
      </TarjetaDocumento>
    </ContenedorDetalle>
  );
}
