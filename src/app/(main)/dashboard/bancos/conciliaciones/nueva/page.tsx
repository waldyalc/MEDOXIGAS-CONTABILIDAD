import Link from "next/link";
import { redirect } from "next/navigation";

import { ContenedorFormulario } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { getDatosNuevaConciliacion } from "@/lib/bancos/conciliaciones";
import { hoyRD } from "@/lib/facturacion/formato";

import { FormNuevaConciliacion } from "./_components/form-nueva-conciliacion";

export default async function Page({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");

  const busqueda = await searchParams;
  const datos = await getDatosNuevaConciliacion();
  const cuentaInicial = datos.cuentas.find((cuenta) => cuenta.id === busqueda.cuenta)?.id ?? datos.cuentas[0]?.id ?? "";

  return (
    <ContenedorFormulario>
      <EncabezadoPagina
        titulo="Nueva conciliación"
        subtitulo="Elige la cuenta, la fecha de corte y el saldo que aparece en el extracto del banco."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Bancos", href: "/dashboard/bancos" },
          { etiqueta: "Conciliaciones", href: "/dashboard/bancos/conciliaciones" },
          { etiqueta: "Nueva conciliación" },
        ]}
      />

      {datos.cuentas.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay cuentas de caja o banco activas. Crea una desde{" "}
          <Link href="/dashboard/bancos" className="text-primary underline-offset-4 hover:underline">
            Bancos
          </Link>
          .
        </p>
      ) : (
        <FormNuevaConciliacion
          cuentas={datos.cuentas}
          borradores={datos.borradores}
          cuentaInicial={cuentaInicial}
          fechaHoy={hoyRD()}
        />
      )}
    </ContenedorFormulario>
  );
}
