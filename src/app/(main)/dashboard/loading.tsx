import { EsqueletoTarjetas } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl tracking-tight">Medoxigas Contabilidad</h1>
        <p className="text-muted-foreground text-balance">Hola. Este es el resumen del mes en curso.</p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Resumen del mes</h2>
        <EsqueletoTarjetas />
      </section>
    </div>
  );
}
