import { redirect } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getContactosClientes, getEmpresa, getListasPrecios } from "@/lib/facturacion/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";
import { listarCategorias } from "@/lib/inventario/consultas";
import { getNumeraciones } from "@/lib/numeraciones/consultas";
import { getPlantillaImpresion } from "@/lib/plantillas-impresion/consultas";
import { getProductosPOS } from "@/lib/pos/consultas";
import { getVendedoresActivos } from "@/lib/vendedores/consultas";

import { getContextoPOS, getCuentasPOS } from "./_components/servidor";
import { VenderPos } from "./_components/vender/vender-pos";

const TIPOS_VENTA = new Set(["01", "02", "14", "15", "16"]);

export default async function Page() {
  const contexto = await getContextoPOS();
  if (!contexto.perfil) redirect("/login");
  if (!contexto.terminal) return null;

  const terminal = contexto.terminal;
  const [
    empresa,
    productos,
    categorias,
    impuestos,
    numeraciones,
    listas,
    vendedores,
    contactos,
    cuentas,
    plantillaFactura,
    plantillaCotizacion,
  ] = await Promise.all([
    getEmpresa(),
    getProductosPOS({ terminal_id: terminal.id, limit: 50, offset: 0 }),
    listarCategorias(),
    getImpuestosActivos(),
    getNumeraciones(),
    getListasPrecios(),
    getVendedoresActivos(),
    getContactosClientes(),
    getCuentasPOS(),
    getPlantillaImpresion("factura"),
    getPlantillaImpresion("cotizacion"),
  ]);

  const numeracionesVenta = numeraciones.filter(
    (numeracion) => numeracion.activa && TIPOS_VENTA.has(numeracion.tipo_comprobante),
  );

  if (contexto.perfil.rol === "lector") {
    return (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Tu rol es de solo lectura. Puedes consultar el historial, pero no vender.
            <Button variant="outline" render={<a href="/pos/historial" />}>
              Ir al historial
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <VenderPos
      terminal={{
        id: terminal.id,
        nombre: terminal.nombre,
        cuenta_efectivo_id: terminal.cuenta_efectivo_id,
        cuenta_tarjeta_debito_id: terminal.cuenta_tarjeta_debito_id,
        cuenta_tarjeta_credito_id: terminal.cuenta_tarjeta_credito_id,
        cuenta_transferencia_id: terminal.cuenta_transferencia_id,
        contacto_defecto_id: terminal.contacto_defecto_id,
        plantilla_ticket: terminal.plantilla_ticket,
      }}
      turno={contexto.turno ? { id: contexto.turno.id, numero: contexto.turno.numero } : null}
      empresa={empresa}
      productos={productos}
      categorias={categorias
        .filter((categoria) => categoria.activo)
        .map((categoria) => ({ id: categoria.id, nombre: categoria.nombre }))}
      impuestos={impuestos}
      numeraciones={numeracionesVenta}
      listas={listas}
      vendedores={vendedores}
      contactos={contactos}
      cuentas={cuentas.map((cuenta) => ({ id: cuenta.id, nombre: cuenta.nombre }))}
      plantillaFactura={plantillaFactura}
      plantillaCotizacion={plantillaCotizacion}
    />
  );
}
