import Link from "next/link";

import { cn } from "cn";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CarteraResumen, GrupoCartera } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const CONTEO = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

export function formatearConteo(valor: number): string {
  return CONTEO.format(valor);
}

interface TarjetaCarteraProps {
  titulo: string;
  href: string;
  datos: CarteraResumen;
  className?: string;
}

export function TarjetaCartera({ titulo, href, datos, className }: TarjetaCarteraProps) {
  return (
    <Card
      className={cn(
        "ring-border relative h-full gap-0 rounded-2xl [--card-spacing:--spacing(6)]",
        "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-2",
        className,
      )}
    >
      <CardHeader className="gap-1">
        <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          <Link
            href={href}
            className="hover:text-primary decoration-border underline underline-offset-[3px] after:absolute after:inset-0 focus-visible:outline-none"
          >
            {titulo}
          </Link>
        </CardTitle>
        <p className="text-foreground text-xl leading-7 font-normal tracking-tight tabular-nums">
          {formatearRd(centavos(datos.total))}
        </p>
      </CardHeader>
      <CardContent className="mt-5 flex flex-col gap-4">
        <BarraCartera datos={datos} />
        <div className="grid grid-cols-2 gap-4">
          <DetalleCartera etiqueta="Vigentes" grupo={datos.vigentes} tono="vigente" />
          <DetalleCartera etiqueta="Vencidas" grupo={datos.vencidas} tono="vencida" />
        </div>
      </CardContent>
    </Card>
  );
}

function BarraCartera({ datos }: { datos: CarteraResumen }) {
  const segmentos = [
    { monto: datos.vigentes.monto, color: "bg-emerald-400" },
    { monto: datos.vencidas.monto, color: "bg-red-500" },
  ].filter((segmento) => segmento.monto > 0 && datos.total > 0);

  return (
    <div className="bg-muted flex h-2 w-full items-stretch gap-[2px] overflow-hidden rounded-[2px]" aria-hidden="true">
      {segmentos.map((segmento) => (
        <div
          key={segmento.color}
          className={cn("h-full rounded-[2px]", segmento.color)}
          style={{
            width: `${Math.min(100, Math.max(0, (segmento.monto / datos.total) * 100))}%`,
          }}
        />
      ))}
    </div>
  );
}

interface DetalleCarteraProps {
  etiqueta: string;
  grupo: GrupoCartera;
  tono: "vigente" | "vencida";
}

function DetalleCartera({ etiqueta, grupo, tono }: DetalleCarteraProps) {
  const documentos = `${formatearConteo(grupo.documentos)} ${grupo.documentos === 1 ? "documento" : "documentos"}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-l-4 pl-3",
        tono === "vigente" ? "border-emerald-400" : "border-red-500",
      )}
    >
      <span className="text-xs text-slate-700 dark:text-slate-300">{etiqueta}</span>
      <span
        className={cn(
          "text-base font-normal tabular-nums",
          tono === "vencida" && grupo.monto > 0 && "text-red-600 dark:text-red-400",
        )}
      >
        {formatearRd(centavos(grupo.monto))}
      </span>
      <span className="text-muted-foreground text-xs whitespace-nowrap">{documentos}</span>
    </div>
  );
}

interface TarjetaMetricaProps {
  titulo: string;
  href: string;
  valor: string;
  detalle?: string;
  className?: string;
}

export function TarjetaMetrica({ titulo, href, valor, detalle, className }: TarjetaMetricaProps) {
  return (
    <Card
      className={cn(
        "ring-border relative h-full gap-0 rounded-2xl",
        "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-2",
        className,
      )}
    >
      <CardHeader className="gap-1">
        <CardTitle className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-300">
          <Link
            href={href}
            className="hover:text-primary decoration-border underline underline-offset-[3px] after:absolute after:inset-0 focus-visible:outline-none"
          >
            {titulo}
          </Link>
        </CardTitle>
        {detalle ? <p className="text-muted-foreground text-xs">{detalle}</p> : null}
        <p className="text-foreground mt-2 text-lg leading-7 font-normal tracking-tight tabular-nums">{valor}</p>
      </CardHeader>
    </Card>
  );
}
