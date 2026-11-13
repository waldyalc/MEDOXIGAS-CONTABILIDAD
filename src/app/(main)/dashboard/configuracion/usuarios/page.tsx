import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getRol } from "@/lib/auth/rol";
import { getPerfilesUsuarios } from "@/lib/configuracion/consultas";
import { formatoFechaHora } from "@/lib/formato";

import { EncabezadoConfiguracion } from "../_components/encabezado";

const ETIQUETA_ROL: Record<string, string> = {
  admin: "Administrador",
  contador: "Contador",
  lector: "Lector",
};

export default async function Page() {
  const rol = await getRol();
  if (rol == null) redirect("/unauthorized");
  if (rol !== "admin") redirect("/dashboard/configuracion");

  const usuarios = await getPerfilesUsuarios();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoConfiguracion
        titulo="Usuarios"
        descripcion="Personas con acceso a la contabilidad y su rol. Solo el administrador puede ver esta lista."
      />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Creado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center whitespace-normal">
                  No hay usuarios registrados.
                </TableCell>
              </TableRow>
            ) : (
              usuarios.map((usuario) => (
                <TableRow key={usuario.user_id}>
                  <TableCell className="font-medium">{usuario.nombre?.trim() || "—"}</TableCell>
                  <TableCell>{usuario.correo ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ETIQUETA_ROL[usuario.rol] ?? usuario.rol}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatoFechaHora(usuario.creado_en)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
