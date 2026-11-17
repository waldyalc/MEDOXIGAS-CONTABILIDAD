import { redirect } from "next/navigation";

import { Users } from "lucide-react";

import {
  type ColumnaLista,
  ContenedorLista,
  PillEstado,
  TablaLista,
  TarjetaLista,
} from "@/components/listas/tabla-lista";
import { getRol } from "@/lib/auth/rol";
import { getPerfilesUsuarios } from "@/lib/configuracion/consultas";
import type { PerfilUsuario } from "@/lib/configuracion/tipos";
import { formatoFechaHora } from "@/lib/formato";

import { EncabezadoConfiguracion } from "../_components/encabezado";

const ETIQUETA_ROL: Record<string, string> = {
  admin: "Administrador",
  contador: "Contador",
  lector: "Lector",
};

const columnas: readonly ColumnaLista<PerfilUsuario>[] = [
  {
    clave: "nombre",
    encabezado: "Nombre",
    celda: (usuario) => <span className="font-medium">{usuario.nombre?.trim() || "—"}</span>,
  },
  {
    clave: "correo",
    encabezado: "Correo",
    celda: (usuario) => usuario.correo ?? "—",
  },
  {
    clave: "rol",
    encabezado: "Rol",
    celda: (usuario) => <PillEstado tono="neutro">{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</PillEstado>,
  },
  {
    clave: "creado",
    encabezado: "Creado",
    celda: (usuario) => <span className="text-muted-foreground">{formatoFechaHora(usuario.creado_en)}</span>,
  },
];

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol !== "admin") redirect("/dashboard/configuracion");

  const usuarios = await getPerfilesUsuarios();

  return (
    <ContenedorLista>
      <EncabezadoConfiguracion
        titulo="Usuarios"
        descripcion="Personas con acceso a la contabilidad y su rol. Solo el administrador puede ver esta lista."
      />

      <TarjetaLista data-lista="configuracion-usuarios">
        <TablaLista
          columnas={columnas}
          filas={usuarios}
          claveFila={(usuario) => usuario.user_id}
          vacio={{
            titulo: "Sin usuarios",
            descripcion: "No hay usuarios registrados.",
            icono: <Users className="size-10" />,
          }}
        />
      </TarjetaLista>
    </ContenedorLista>
  );
}
