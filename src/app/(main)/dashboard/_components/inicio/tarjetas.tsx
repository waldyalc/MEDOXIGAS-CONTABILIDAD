import Link from "next/link";

import { cn } from "cn";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CarteraResumen } from "@/lib/inicio/consultas";
import { centavos, formatearRd } from "@/lib/reportes/dinero";

const CONTEO = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 2 });

export function formatearConteo(valor: number): string {
  return CONTEO.format(valor);
}

interface TarjetaCarteraProps {
  titulo: string;
  href: string;
  datos: CarteraResumen;
}

export function TarjetaCartera({ titulo, href, datos }: TarjetaCarteraProps) {
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>
          <Link href={href} className="hover:text-primary underline-offset-4 hover:underline">
            {titulo}
          </Link>
        </CardTitle>
        <p className="text-2xl font-semibold tabular-nums">{formatearRd(centavos(datos.total))}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <FilaCartera
          etiqueta="Vigentes"
          monto={datos.vigentes.monto}
          documentos={datos.vigentes.documentos}
          total={datos.total}
          tono="vigente"
        />
        <FilaCartera
          etiqueta="Vencidas"
          monto={datos.vencidas.monto}
          documentos={datos.vencidas.documentos}
          total={datos.total}
          tono="vencida"
        />
      </CardContent>
    </Card>
  );
}

interface FilaCarteraProps {
  etiqueta: string;
  monto: number;
  documentos: number;
  total: number;
  tono: "vigente" | "vencida";
}

function FilaCartera({ etiqueta, monto, documentos, total, tono }: FilaCarteraProps) {
  const proporcion = total > 0 ? Math.min(100, Math.max(0, (monto / total) * 100)) : 0;
  const colorPunto = tono === "vigente" ? "bg-emerald-500 dark:bg-emerald-400" : "bg-red-500 dark:bg-red-400";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className={cn("size-2 rounded-full", colorPunto)} aria-hidden="true" />
          {etiqueta}
        </span>
        <span className="text-sm font-medium tabular-nums">{formatearRd(centavos(monto))}</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div className={cn("h-full rounded-full", colorPunto)} style={{ width: `${proporcion}%` }} />
      </div>
      <p className="text-muted-foreground text-xs">
        {documentos} {documentos === 1 ? "documento" : "documentos"}
      </p>
    </div>
  );
}

interface TarjetaMetricaProps {
  titulo: string;
  href?: string;
  valor: string;
  detalle?: string;
}

export function TarjetaMetrica({ titulo, href, valor, detalle }: TarjetaMetricaProps) {
  return (
    <Card size="sm" className="h-full justify-center">
      <CardHeader className="gap-0.5">
        <CardTitle className="text-sm">
          {href ? (
            <Link href={href} className="hover:text-primary underline-offset-4 hover:underline">
              {titulo}
            </Link>
          ) : (
            titulo
          )}
        </CardTitle>
        <p className="text-xl font-semibold tabular-nums">{valor}</p>
        {detalle ? <p className="text-muted-foreground text-xs">{detalle}</p> : null}
      </CardHeader>
    </Card>
  );
}
