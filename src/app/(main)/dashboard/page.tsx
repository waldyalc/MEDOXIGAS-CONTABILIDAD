import { Suspense } from "react";

import { redirect } from "next/navigation";

import { Banknote, ChartNoAxesCombined, HandCoins, TrendingUp } from "lucide-react";

import { EsqueletoTarjetas } from "@/components/carga/esqueletos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPerfil } from "@/lib/auth/rol";
import { obtenerKpisInicio } from "@/lib/reportes/consultas";
import { formatearRd } from "@/lib/reportes/dinero";

import { AvisoSaldoNegativo } from "./reportes/_components/aviso-saldo-negativo";

async function Saludo() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const nombre = perfil.nombre?.trim() || perfil.correo || "";

  return (
    <p className="text-muted-foreground text-balance">
      {nombre ? `Hola, ${nombre}. ` : "Hola. "}
      Este es el resumen del mes en curso.
    </p>
  );
}

async function TarjetasResumen() {
  const perfil = await getPerfil();
  if (perfil?.rol == null) redirect("/unauthorized");

  const kpis = await obtenerKpisInicio();

  const tarjetas = [
    {
      titulo: "Ventas del mes",
      valor: kpis.ventas,
      detalle: "Ingresos del mes en curso",
      icon: TrendingUp,
    },
    {
      titulo: "Por cobrar",
      valor: kpis.porCobrar,
      detalle: "Saldo pendiente de clientes",
      icon: HandCoins,
    },
    {
      titulo: "Gastos del mes",
      valor: kpis.gastos,
      detalle: "Gastos registrados en el mes",
      icon: Banknote,
    },
    {
      titulo: "Utilidad del mes",
      valor: kpis.utilidad,
      detalle: "Ingresos menos costos y gastos",
      icon: ChartNoAxesCombined,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tarjetas.map((tarjeta) => {
        const Icon = tarjeta.icon;

        return (
          <Card key={tarjeta.titulo}>
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>{tarjeta.titulo}</CardTitle>
                <Icon className="text-muted-foreground size-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-semibold tabular-nums ${tarjeta.valor < 0 ? "text-destructive" : ""}`}>
                {formatearRd(tarjeta.valor)}
              </p>
              <p className="text-muted-foreground text-sm">{tarjeta.detalle}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Medoxigas Contabilidad</h1>
        <Suspense
          fallback={<p className="text-muted-foreground text-balance">Hola. Este es el resumen del mes en curso.</p>}
        >
          <Saludo />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <AvisoSaldoNegativo />
      </Suspense>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Resumen del mes</h2>
        <Suspense fallback={<EsqueletoTarjetas />}>
          <TarjetasResumen />
        </Suspense>
      </section>
    </div>
  );
}
