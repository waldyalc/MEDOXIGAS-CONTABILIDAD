import { redirect } from "next/navigation";

import { ContenedorDetalle } from "@/components/pagina/contenedor-pagina";
import { EncabezadoPagina } from "@/components/pagina/encabezado-pagina";
import { getPerfil } from "@/lib/auth/rol";
import { createClient } from "@/lib/supabase/server";

import { PerfilSeguridadCliente } from "./_components/perfil-seguridad-cliente";

function leerProveedores(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const datos = metadata as { provider?: unknown; providers?: unknown };

  if (Array.isArray(datos.providers)) {
    return datos.providers.filter((proveedor): proveedor is string => typeof proveedor === "string");
  }
  if (typeof datos.provider === "string") return [datos.provider];
  return [];
}

export default async function Page() {
  const perfil = await getPerfil();
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");
  if (!perfil?.rol) redirect("/unauthorized");

  return (
    <ContenedorDetalle className="gap-6">
      <EncabezadoPagina
        titulo="Mi perfil y seguridad"
        subtitulo="Administra tu información de acceso, contraseña, apariencia y sesiones."
        migas={[{ etiqueta: "Inicio", href: "/dashboard" }, { etiqueta: "Mi perfil y seguridad" }]}
      />
      <PerfilSeguridadCliente
        nombre={perfil.nombre}
        correo={perfil.correo ?? user.email ?? null}
        rol={perfil.rol}
        creadoEn={user.created_at ?? null}
        ultimoAcceso={user.last_sign_in_at ?? null}
        proveedores={leerProveedores(user.app_metadata)}
      />
    </ContenedorDetalle>
  );
}
