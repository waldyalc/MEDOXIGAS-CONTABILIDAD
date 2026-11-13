import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPerfil } from "@/lib/auth/rol";
import { sidebarItems } from "@/navigation/sidebar/sidebar-items";

const modulosProximamente = sidebarItems.flatMap((grupo) => grupo.items).filter((item) => item.disabled);

export default async function Page() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const nombre = perfil.nombre?.trim() || perfil.correo || "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Medoxigas Contabilidad</h1>
        <p className="text-muted-foreground text-balance">
          {nombre ? `Hola, ${nombre}. ` : "Hola. "}
          Bienvenido al sistema de contabilidad y facturación.
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Próximamente</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modulosProximamente.map((modulo) => {
            const Icon = modulo.icon;

            return (
              <Card key={modulo.id}>
                <CardHeader className="gap-2">
                  {Icon ? <Icon className="text-primary size-5" /> : null}
                  <CardTitle>{modulo.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">Próximamente</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
