import Link from "next/link";

import { cn } from "cn";

export function EstadoTurnoPos({
  turno,
}: {
  turno: { numero: number; estado: "abierto" | "cerrado"; abierto_en: string } | null;
}) {
  const clase = turno
    ? turno.estado === "abierto"
      ? "bg-primary/10 text-primary"
      : "bg-destructive/10 text-destructive"
    : "bg-muted text-muted-foreground";

  const etiqueta = turno
    ? `Turno No ${turno.numero} · ${turno.estado === "abierto" ? "Abierto" : "Cerrado"}`
    : "Sin turno";

  return (
    <Link
      href="/pos/turnos"
      title={turno ? `${etiqueta}${turno.abierto_en ? ` desde ${hora(turno.abierto_en)}` : ""}` : "Sin turno abierto"}
      className={cn("flex h-10 max-w-[190px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium", clase)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          turno?.estado === "abierto" ? "bg-primary" : turno ? "bg-destructive" : "bg-muted-foreground",
        )}
      />
      <span className="truncate xl:hidden">{turno ? `No ${turno.numero}` : "Sin turno"}</span>
      <span className="hidden truncate xl:inline">{etiqueta}</span>
    </Link>
  );
}

function hora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  return new Intl.DateTimeFormat("es-DO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santo_Domingo",
  }).format(fecha);
}
