import Link from "next/link";

import { cn } from "cn";

import { CircleX, Clock } from "@/components/icons";
import type { FiltroEmisionFactura } from "@/lib/facturacion/emision-ecf";
import { type ParametrosLista, urlLista } from "@/lib/listas/parametros";

function TarjetaEmision({
  href,
  activa,
  icono,
  etiqueta,
  total,
}: {
  href: string;
  activa: boolean;
  icono: React.ReactNode;
  etiqueta: string;
  total: number;
}) {
  return (
    <Link
      href={href}
      aria-pressed={activa}
      className={cn(
        "bg-card flex min-h-[68px] w-full items-center gap-4 rounded-2xl border px-5 py-3.5 shadow-none transition-colors sm:w-[250px]",
        activa ? "border-primary ring-primary/20 ring-1" : "border-border hover:border-slate-300 hover:bg-slate-50/60",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          etiqueta === "Sin emisión"
            ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            : "bg-primary/10 text-primary",
        )}
      >
        {icono}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-foreground/80 text-sm leading-5">{etiqueta}</span>
        <span className="text-foreground text-2xl leading-7 font-semibold tabular-nums">{total}</span>
      </span>
    </Link>
  );
}

export function TarjetasEmision({
  params,
  activa,
  sinEmision,
  enProceso,
}: {
  params: ParametrosLista;
  activa?: FiltroEmisionFactura;
  sinEmision: number;
  enProceso: number;
}) {
  return (
    <section className="flex flex-col gap-3 sm:flex-row" aria-label="Resumen de emisión electrónica">
      <TarjetaEmision
        href={urlLista("/dashboard/facturacion", params, {
          emision: activa === "sin_emision" ? null : "sin_emision",
          pagina: null,
        })}
        activa={activa === "sin_emision"}
        icono={<CircleX className="size-5" />}
        etiqueta="Sin emisión"
        total={sinEmision}
      />
      <TarjetaEmision
        href={urlLista("/dashboard/facturacion", params, {
          emision: activa === "en_proceso" ? null : "en_proceso",
          pagina: null,
        })}
        activa={activa === "en_proceso"}
        icono={<Clock className="size-5" />}
        etiqueta="En proceso"
        total={enProceso}
      />
    </section>
  );
}
