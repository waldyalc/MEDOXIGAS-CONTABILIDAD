import { redirect } from "next/navigation";

import { ContenedorLista } from "@/components/listas/tabla-lista";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getRol } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import { configuracionEcfPublicaDesdeFila, type FilaConfigEcf } from "./_components/ecf-portal-tipos";
import { EMPRESAS_PILOTO_ECF, type EmisorEcf, type NumeracionEcf } from "./_components/pasos-habilitacion";
import { PortalEcfCliente } from "./_components/portal-ecf-cliente";

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol === "lector") redirect("/dashboard/configuracion");

  const supabase = await createClient();
  const rncsPilotos = Object.values(EMPRESAS_PILOTO_ECF).map((piloto) => piloto.rnc);
  const [empresaRes, numeracionesRes, configsRes] = await Promise.all([
    supabase
      .from("empresa")
      .select("nombre, rnc, direccion, telefono, correo")
      .eq("id", 1)
      .maybeSingle()
      .returns<EmisorEcf | null>(),
    supabase
      .from("numeraciones")
      .select("id, tipo_comprobante, prefijo, nombre, siguiente, hasta, vence, activa")
      .eq("activa", true)
      .order("tipo_comprobante")
      .order("prefijo")
      .returns<NumeracionEcf[]>(),
    supabase
      .from("ecf_config")
      .select(
        "rnc, razon_social, ambiente, activo, dominio_base, cert_titular, cert_numero_serie, cert_valido_hasta, cert_huella_sha256",
      )
      .in("rnc", rncsPilotos)
      .returns<FilaConfigEcf[]>(),
  ]);

  if (empresaRes.error) throw new Error(empresaRes.error.message);
  if (numeracionesRes.error) throw new Error(numeracionesRes.error.message);
  if (configsRes.error) throw new Error(configsRes.error.message);

  const configsIniciales = (configsRes.data ?? []).map((fila) => configuracionEcfPublicaDesdeFila(fila));

  return (
    <ContenedorLista className="gap-5">
      <EncabezadoPagina
        titulo="Facturación electrónica"
        subtitulo="Habilitación e-CF ante la DGII, certificado digital, pruebas de simulación y migración desde Alegra."
        migas={[
          { etiqueta: "Inicio", href: "/dashboard" },
          { etiqueta: "Configuración", href: "/dashboard/configuracion" },
          { etiqueta: "Facturación electrónica" },
        ]}
      />
      <PortalEcfCliente
        empresa={empresaRes.data}
        numeraciones={numeracionesRes.data ?? []}
        configsIniciales={configsIniciales}
        claveMaestraConfigurada={Boolean(process.env.ECF_ENCRYPTION_KEY?.trim())}
      />
    </ContenedorLista>
  );
}
