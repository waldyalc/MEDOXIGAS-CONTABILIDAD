import Link from "next/link";
import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getRol } from "@/lib/auth/rol";
import { getCentrosCostoActivos } from "@/lib/centros-costo/consultas";
import { getContactosClientes, getCuentasCajaBanco, getEmpresa } from "@/lib/facturacion/consultas";
import { type Empresa, TIPOS_COMPROBANTE } from "@/lib/facturacion/tipos";
import { listarAlmacenesActivos, listarListasPreciosActivas } from "@/lib/inventario/consultas";
import { getNumeraciones } from "@/lib/numeraciones/consultas";
import { ErrorPOS, getTerminales } from "@/lib/pos/consultas";
import type { TerminalPOS } from "@/lib/pos/tipos";

import { EncabezadoConfiguracion } from "../_components/encabezado";
import type { CatalogosPos } from "./_components/catalogos";
import { TerminalesPosCliente } from "./_components/terminales-pos-cliente";

type EstadoTerminales =
  | { estado: "ok"; terminales: TerminalPOS[] }
  | { estado: "no-instalado" }
  | { estado: "error"; mensaje: string };

/**
 * El POS es una fase posterior a la base de datos: si la migración de las
 * tablas `pos_*` aún no está aplicada, la primera lectura devuelve `42P01`
 * (tabla inexistente) o `42883` (función inexistente). Eso no es un error del
 * usuario: se muestra como «no instalado» en vez de romper Contabilidad.
 */
async function cargarTerminales(): Promise<EstadoTerminales> {
  try {
    return { estado: "ok", terminales: await getTerminales() };
  } catch (error) {
    if (error instanceof ErrorPOS && (error.codigo === "42P01" || error.codigo === "42883")) {
      return { estado: "no-instalado" };
    }

    return {
      estado: "error",
      mensaje: error instanceof Error ? error.message : "No se pudo cargar la configuración del punto de venta.",
    };
  }
}

async function cargarCatalogos(empresa: Empresa | null): Promise<CatalogosPos> {
  const [almacenes, cuentas, numeraciones, listas, contactos, centrosCosto] = await Promise.all([
    listarAlmacenesActivos(),
    getCuentasCajaBanco(),
    getNumeraciones(),
    listarListasPreciosActivas(),
    getContactosClientes(),
    getCentrosCostoActivos(),
  ]);

  return {
    almacenes: almacenes.map((almacen) => ({
      id: almacen.id,
      nombre: almacen.nombre,
      es_principal: almacen.es_principal,
    })),
    cuentas: cuentas.map((cuenta) => ({ id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre })),
    numeraciones: numeraciones
      .filter(
        (numeracion) =>
          numeracion.activa && (TIPOS_COMPROBANTE as readonly string[]).includes(numeracion.tipo_comprobante),
      )
      .map((numeracion) => ({
        id: numeracion.id,
        nombre: numeracion.nombre,
        tipo_comprobante: numeracion.tipo_comprobante,
        prefijo: numeracion.prefijo,
      })),
    listas: listas.map((lista) => ({ id: lista.id, nombre: lista.nombre, es_principal: lista.es_principal })),
    contactos: contactos.map((contacto) => ({ id: contacto.id, nombre: contacto.nombre })),
    centrosCosto: centrosCosto.map((centro) => ({ id: centro.id, codigo: centro.codigo, nombre: centro.nombre })),
    empresa,
  };
}

export default async function Page() {
  const [rol, empresa, terminales] = await Promise.all([getRol(), getEmpresa(), cargarTerminales()]);
  if (rol == null) redirect("/unauthorized");

  const puedeEditar = rol === "admin" || rol === "contador";
  const catalogos = terminales.estado === "ok" ? await cargarCatalogos(empresa) : null;

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Punto de venta"
        descripcion="Terminales de caja: almacén, cuentas por método de pago, numeración y plantilla del ticket."
      />

      {terminales.estado === "ok" && catalogos ? (
        <TerminalesPosCliente terminales={terminales.terminales} catalogos={catalogos} puedeEditar={puedeEditar} />
      ) : null}

      {terminales.estado === "no-instalado" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-lg font-semibold">El punto de venta no está instalado</p>
            <p className="text-muted-foreground max-w-lg text-sm">
              La base de datos todavía no tiene las tablas <code className="font-mono">pos_terminales</code>,{" "}
              <code className="font-mono">pos_turnos</code> ni sus funciones. Falta aplicar la migración del punto de
              venta (fase 2A) en Supabase; después de aplicarla, esta pantalla queda operativa.
            </p>
            <Button variant="outline" render={<Link href="/dashboard/configuracion" />}>
              Volver a Configuración
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {terminales.estado === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar la configuración del punto de venta</AlertTitle>
          <AlertDescription>{terminales.mensaje}</AlertDescription>
        </Alert>
      ) : null}
    </ContenedorLista>
  );
}
