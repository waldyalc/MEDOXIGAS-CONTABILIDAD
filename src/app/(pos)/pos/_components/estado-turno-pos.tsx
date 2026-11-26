import { cn } from "cn";

import { EnlacePos } from "./enlace-pos";
import { itemMenuColapsado } from "./menu-pos-estilos";

type TurnoBadge = { numero: number; estado: "abierto" | "cerrado"; abierto_en: string } | null;

function textoDe(turno: TurnoBadge): { abierto: boolean; corto: string; largo: string } {
  if (!turno) return { abierto: false, corto: "Sin turno", largo: "Sin turno abierto" };
  const abierto = turno.estado === "abierto";
  return {
    abierto,
    corto: `No ${turno.numero}`,
    largo: `Turno No ${turno.numero} · ${abierto ? "Abierto" : "Cerrado"}`,
  };
}

function tituloDe(turno: TurnoBadge, largo: string): string {
  if (!turno?.abierto_en) return largo;
  return `${largo} desde ${hora(turno.abierto_en)}`;
}

function PuntoEstado({ turno, abierto }: { turno: TurnoBadge; abierto: boolean }) {
  let clase = "bg-muted-foreground";
  if (turno) clase = abierto ? "bg-primary" : "bg-destructive";
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", clase)} />;
}

function PillEstado({ abierto }: { abierto: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold tracking-wide uppercase",
        abierto ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
      )}
    >
      {abierto ? "Abierto" : "Cerrado"}
    </span>
  );
}

/**
 * Insignia del turno en el pie del menú del POS: punto de color + «Turno No N»
 * + pill ABIERTO/CERRADO, como en Alegra. En el riel colapsado queda solo el
 * punto; `compacto` (barra móvil) muestra la forma corta.
 */
export function EstadoTurnoPos({
  turno,
  colapsado = false,
  compacto = false,
  onNavegar,
}: {
  turno: TurnoBadge;
  colapsado?: boolean;
  compacto?: boolean;
  onNavegar?: () => void;
}) {
  const { abierto, corto, largo } = textoDe(turno);
  const titulo = tituloDe(turno, largo);

  if (colapsado) {
    return (
      <EnlacePos
        href="/pos/turnos"
        title={titulo}
        aria-label={largo}
        className={cn(itemMenuColapsado, "flex h-8 w-full items-center")}
        onClick={onNavegar}
      >
        <PuntoEstado turno={turno} abierto={abierto} />
      </EnlacePos>
    );
  }

  return (
    <EnlacePos
      href="/pos/turnos"
      title={titulo}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-sm",
        "text-slate-700 hover:bg-slate-200/45 hover:text-slate-900 active:bg-slate-200/70",
        "dark:text-sidebar-foreground/85 dark:hover:text-sidebar-foreground dark:hover:bg-white/[0.06]",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none",
      )}
      onClick={onNavegar}
    >
      <PuntoEstado turno={turno} abierto={abierto} />
      <span className="min-w-0 flex-1 truncate">{compacto && turno ? corto : largo}</span>
      {turno ? <PillEstado abierto={abierto} /> : null}
    </EnlacePos>
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
