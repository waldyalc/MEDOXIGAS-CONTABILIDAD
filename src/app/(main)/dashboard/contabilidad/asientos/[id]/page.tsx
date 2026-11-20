import { notFound, redirect } from "next/navigation";

import {
  type CampoInformacionDocumento,
  CLASE_BOTON_DOCUMENTO,
  DocumentoDetalle,
  type EstadoDetalle,
  InformacionDocumento,
  TablaDocumento,
  TarjetaDocumento,
} from "@/components/documento/documento-detalle";
import { Enlace } from "@/components/enlace";
import { AsientoPapel } from "@/components/impresion/asiento-papel";
import { FilaNavegable } from "@/components/listas/fila-navegable";
import { TableCell, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { rutaContacto, rutaCuenta } from "@/lib/enlaces";
import { valorACentavos } from "@/lib/facturacion/calculo";
import { getEmpresa } from "@/lib/facturacion/consultas";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { formatoDia } from "@/lib/formato";

import { obtenerAsientoDetalle } from "./_consultas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rol, asiento, empresa] = await Promise.all([getRol(), obtenerAsientoDetalle(id), getEmpresa()]);
  if (rol == null) redirect("/unauthorized");
  if (!asiento) notFound();

  const debitos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.debito), 0);
  const creditos = asiento.lineas.reduce((total, linea) => total + valorACentavos(linea.credito), 0);
  const codigo = asiento.codigo ?? `#${asiento.numero}`;

  const estado: EstadoDetalle =
    debitos === creditos ? { etiqueta: "Cuadrado ✓", tono: "green" } : { etiqueta: "Descuadrado", tono: "red" };

  const informacion: CampoInformacionDocumento[] = [
    { etiqueta: "Código", valor: codigo },
    { etiqueta: "Tipo de entrada", valor: asiento.tipoEntrada ?? "—" },
    { etiqueta: "Número interno", valor: `#${asiento.numero}` },
    { etiqueta: "Fecha", valor: formatoDia(asiento.fecha) },
    {
      etiqueta: "Descripción",
      valor: <span className="whitespace-pre-line">{asiento.descripcion || "—"}</span>,
    },
    {
      etiqueta: "Documento de origen",
      valor: asiento.origen.href ? (
        <Enlace href={asiento.origen.href}>{asiento.origen.etiqueta}</Enlace>
      ) : (
        asiento.origen.etiqueta
      ),
    },
  ];

  return (
    <DocumentoDetalle
      rutaVolver="/dashboard/contabilidad/asientos"
      etiquetaVolver="Volver a asientos"
      titulo={`Asiento contable ${codigo}`}
      estado={estado}
      acciones={<AsientoPapel asiento={asiento} empresa={empresa} classNameBoton={CLASE_BOTON_DOCUMENTO} />}
    >
      <TarjetaDocumento empresa={empresa} numeroDocumento={codigo}>
        <InformacionDocumento titulo="Información del asiento" campos={informacion} />

        <TablaDocumento
          titulo="Movimientos"
          columnas={[
            { titulo: "Cuenta" },
            { titulo: "Tercero" },
            { titulo: "Descripción" },
            { titulo: "Débito", alineadaDerecha: true },
            { titulo: "Crédito", alineadaDerecha: true },
          ]}
          vacio="El asiento no tiene líneas."
          hayFilas={asiento.lineas.length > 0}
          pie={
            <TableRow>
              <TableCell colSpan={3} className="h-12 px-4 text-sm font-semibold">
                Totales
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatoMoneda(debitos / 100)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm font-semibold tabular-nums">
                {formatoMoneda(creditos / 100)}
              </TableCell>
            </TableRow>
          }
        >
          {asiento.lineas.map((linea) => (
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
              <TableCell className="h-12 px-4 text-sm whitespace-normal">
                {linea.contacto ? <Enlace href={rutaContacto(linea.contacto.id)}>{linea.contacto.nombre}</Enlace> : "—"}
              </TableCell>
              <TableCell className="h-12 px-4 text-sm whitespace-normal">{linea.descripcion || "—"}</TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {linea.debito === 0 ? "—" : formatoMoneda(linea.debito)}
              </TableCell>
              <TableCell className="h-12 px-4 text-right text-sm tabular-nums">
                {linea.credito === 0 ? "—" : formatoMoneda(linea.credito)}
              </TableCell>
            </FilaNavegable>
          ))}
        </TablaDocumento>
      </TarjetaDocumento>
    </DocumentoDetalle>
  );
}
