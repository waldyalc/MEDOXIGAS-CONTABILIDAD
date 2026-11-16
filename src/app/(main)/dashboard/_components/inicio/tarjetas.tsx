import Link from "next/link";

import { cn } from "cn";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CarteraResumen, GrupoCartera } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const CONTEO = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

const VERDE = "#22c55e";
const ROJO = "#ef4444";

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
        "relative h-full justify-between gap-4 rounded-[12px] py-5 sm:col-span-2 lg:col-span-1 lg:row-span-2",
        "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-2",
        className,
      )}
    >
      <CardHeader className="gap-1.5 px-5">
        <CardTitle className="text-[15px] font-medium text-slate-700 dark:text-slate-300">
          <Link
            href={href}
            className="hover:text-primary underline underline-offset-[3px] after:absolute after:inset-0 focus-visible:outline-none"
          >
            {titulo}
          </Link>
        </CardTitle>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatearRd(centavos(datos.total))}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5 px-5">
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
    { monto: datos.vigentes.monto, color: VERDE },
    { monto: datos.vencidas.monto, color: ROJO },
  ].filter((segmento) => segmento.monto > 0 && datos.total > 0);

  return (
    <div className="bg-muted flex h-2 w-full items-stretch gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
      {segmentos.map((segmento) => (
        <div
          key={segmento.color}
          className="h-full"
          style={{
            backgroundColor: segmento.color,
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
        "flex flex-col gap-1 border-l-[3px] pl-3",
        tono === "vigente" ? "border-[#22c55e]" : "border-[#ef4444]",
      )}
    >
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{etiqueta}</span>
      <span
        className={cn(
          "text-sm font-medium tabular-nums",
          tono === "vencida" && grupo.monto > 0 && "text-red-600 dark:text-red-400",
        )}
      >
        {formatearRd(centavos(grupo.monto))}
      </span>
      <span className="text-muted-foreground text-xs">{documentos}</span>
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
        "relative h-full justify-center gap-2.5 rounded-[12px] py-4",
        "has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-2",
        className,
      )}
    >
      <CardTitle className="px-4 text-sm font-medium text-slate-700 dark:text-slate-300">
        <Link
          href={href}
          className="hover:text-primary underline underline-offset-[3px] after:absolute after:inset-0 focus-visible:outline-none"
        >
          {titulo}
        </Link>
      </CardTitle>
      <div className="flex flex-col gap-0.5 px-4">
        <p className="text-xl font-semibold tracking-tight tabular-nums">{valor}</p>
        {detalle ? <p className="text-muted-foreground text-xs">{detalle}</p> : null}
      </div>
    </Card>
  );
}
