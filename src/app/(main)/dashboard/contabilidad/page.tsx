import { NuevaCuenta } from "@/components/contabilidad/cuenta-formulario";
import { Enlace } from "@/components/enlace";
import { BookOpen, TriangleAlert } from "@/components/icons";
import { type ColumnaLista, ContenedorLista, TablaLista, TarjetaLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { getRol } from "@/lib/auth/rol";
import { CONFIGURACION_CONTABLE } from "@/lib/contabilidad/catalogo";
import { rutaCuenta } from "@/lib/enlaces";
import { obtenerCatalogoContable } from "@/lib/reportes/consultas";
import { hoyRd } from "@/lib/reportes/fechas";
import type { CuentaContable } from "@/lib/reportes/tipos";

import { CatalogoCuentas } from "./_components/catalogo-cuentas";
import { SaldosIniciales } from "./_components/saldos-iniciales-dialogo";

interface FilaConfiguracion {
  clave: string;
  etiqueta: string;
  cuenta: CuentaContable | undefined;
}

const columnasConfiguracion: readonly ColumnaLista<FilaConfiguracion>[] = [
  {
    clave: "concepto",
    encabezado: "Concepto",
    celda: (fila) => fila.etiqueta,
  },
  {
    clave: "clave",
    encabezado: "Clave",
    celda: (fila) => <span className="text-muted-foreground">{fila.clave}</span>,
  },
  {
    clave: "cuenta",
    encabezado: "Cuenta contable",
    celda: (fila) =>
      fila.cuenta == null ? (
        "—"
      ) : (
        <Enlace href={rutaCuenta(fila.cuenta.id)}>
          <span className="text-muted-foreground">{fila.cuenta.codigo}</span> {fila.cuenta.nombre}
        </Enlace>
      ),
  },
];

export default async function Page() {
  const [{ cuentas, configuracion, saldos, error }, rol] = await Promise.all([obtenerCatalogoContable(), getRol()]);
  const cuentasPorId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta]));
  const configuracionPorClave = new Map(configuracion.map((fila) => [fila.clave, fila]));
  const puedeEditar = rol === "admin" || rol === "contador";

  const filasConfiguracion: FilaConfiguracion[] = CONFIGURACION_CONTABLE.map((config) => {
    const fila = configuracionPorClave.get(config.clave);
    return {
      clave: config.clave,
      etiqueta: config.etiqueta,
      cuenta: fila == null ? undefined : cuentasPorId.get(fila.cuenta_id),
    };
  });

  return (
    <ContenedorLista>
      <EncabezadoPagina
        titulo="Contabilidad"
        subtitulo="Catálogo de cuentas y configuración contable del motor. Las cuentas las usa automáticamente cada documento."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Contabilidad" }]}
        acciones={
          puedeEditar ? (
            <div className="flex flex-wrap items-center gap-2">
              <SaldosIniciales
                cuentas={cuentas}
                cuentaAjustesId={configuracionPorClave.get("ajustes_iniciales")?.cuenta_id ?? null}
                fechaHoy={hoyRd()}
              />
              <NuevaCuenta cuentas={cuentas} />
            </div>
          ) : undefined
        }
      />

      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>No se pudo cargar la contabilidad</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {cuentas.length === 0 ? (
        <Card>
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <BookOpen />
                </EmptyMedia>
                <EmptyTitle>Sin cuentas</EmptyTitle>
                <EmptyDescription>No hay cuentas contables registradas.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        <CatalogoCuentas cuentas={cuentas} saldos={saldos} configuracion={configuracion} puedeEditar={puedeEditar} />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Configuración contable</h2>
        <TarjetaLista data-lista="contabilidad-configuracion">
          <TablaLista
            columnas={columnasConfiguracion}
            filas={filasConfiguracion}
            claveFila={(fila) => fila.clave}
            filaHref={(fila) => (fila.cuenta ? rutaCuenta(fila.cuenta.id) : null)}
            vacio={{
              titulo: "Sin configuración contable",
              descripcion: "No hay conceptos configurados.",
            }}
          />
        </TarjetaLista>
      </section>
    </ContenedorLista>
  );
}
