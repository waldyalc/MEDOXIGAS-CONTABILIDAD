import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getPerfil } from "@/lib/auth/rol";
import { hoyRD } from "@/lib/facturacion/formato";
import { getDatosFormularioGasto } from "@/lib/gastos/consultas";
import { getImpuestosActivos } from "@/lib/impuestos/consultas";

import { GastoForm } from "./_components/gasto-form";

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nuevo gasto menor"
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Compras", href: "/dashboard/compras" },
          { etiqueta: "Gastos menores", href: "/dashboard/gastos" },
          { etiqueta: "Nuevo gasto menor" },
        ]}
      />

      {perfil.rol === "lector" ? (
        <Alert variant="destructive">
          <AlertDescription>Tu rol es de solo lectura. No puedes crear gastos.</AlertDescription>
        </Alert>
      ) : (
        <GastoContenido />
      )}
    </ContenedorFormulario>
  );
}

async function GastoContenido() {
  const [datos, impuestos] = await Promise.all([getDatosFormularioGasto(), getImpuestosActivos()]);

  return (
    <GastoForm
      cuentas={datos.cuentas}
      cuentasCajaBanco={datos.cuentasCajaBanco}
      proveedores={datos.proveedores}
      cuentaPorDefecto={datos.cuentaPorDefecto}
      cuentaPagoPorDefecto={datos.cuentaPagoPorDefecto}
      impuestos={impuestos}
      fechaHoy={hoyRD()}
    />
  );
}
