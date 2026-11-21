"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { CheckCircle2, ChevronDown, Loader2, Scale } from "@/components/icons";
import { type ColumnaLista, PillEstado, TablaLista } from "@/components/listas/tabla-lista";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { conciliarCuenta, guardarConciliacionBorrador } from "@/lib/bancos/acciones";
import { resumenConciliacion } from "@/lib/bancos/conciliacion";
import type { MovimientoBanco } from "@/lib/bancos/movimientos";
import { validarConciliacion } from "@/lib/bancos/validacion";
import { rutaAsiento, rutaContacto } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoDia, formatoFechaHora } from "@/lib/formato";
import { formatearRd } from "@/lib/reportes/dinero";

interface Props {
  conciliacionId: string;
  cuentaId: string;
  fechaDesde: string;
  fechaHasta: string;
  saldoCentavos: number;
  gastosCentavos: number;
  entradasBancariasCentavos: number;
  estado: string;
  movimientos: MovimientoBanco[];
  seleccionados: string[];
  bloqueados: Record<string, string>;
  saldoAnteriorCentavos: number;
  asientoId: string | null;
  asientoNumero: number | null;
  conciliadoEn: string | null;
  soloLectura: boolean;
}

function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

function EntradaMonto({
  id,
  etiqueta,
  valor,
  onChange,
  disabled,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onChange: (valor: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{etiqueta}</Label>
      <InputGroup className="w-44">
        <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
          RD$
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          inputMode="decimal"
          value={valor}
          onChange={(evento) => onChange(evento.target.value)}
          disabled={disabled}
        />
      </InputGroup>
    </div>
  );
}

function AjustesBancarios({
  saldo,
  gastos,
  entradas,
  onSaldo,
  onGastos,
  onEntradas,
  pendiente,
}: {
  saldo: string;
  gastos: string;
  entradas: string;
  onSaldo: (valor: string) => void;
  onGastos: (valor: string) => void;
  onEntradas: (valor: string) => void;
  pendiente: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 px-(--card-spacing) pb-4">
      <EntradaMonto
        id="conciliacion-saldo-extracto"
        etiqueta="Saldo del extracto *"
        valor={saldo}
        onChange={onSaldo}
        disabled={pendiente}
      />
      <Collapsible className="flex-1">
        <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
          Ajustes bancarios
          <ChevronDown className="size-4" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-3 pt-2 sm:grid-cols-2">
            <EntradaMonto
              id="conciliacion-gastos"
              etiqueta="Gastos bancarios"
              valor={gastos}
              onChange={onGastos}
              disabled={pendiente}
            />
            <EntradaMonto
              id="conciliacion-entradas"
              etiqueta="Entradas bancarias"
              valor={entradas}
              onChange={onEntradas}
              disabled={pendiente}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function AccionesConciliacion({
  cuadra,
  puedeConciliar,
  error,
  pendiente,
  procesando,
  onGuardar,
}: {
  cuadra: boolean;
  puedeConciliar: boolean;
  error: string | null;
  pendiente: boolean;
  procesando: "borrador" | "conciliar" | null;
  onGuardar: (conciliar: boolean) => void;
}) {
  return (
    <>
      {!cuadra ? (
        <Alert>
          <Scale />
          <AlertDescription>
            La diferencia debe ser RD$0.00 para conciliar. Revisa los movimientos marcados o los ajustes bancarios.
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => onGuardar(false)} disabled={pendiente}>
          {procesando === "borrador" ? <Loader2 className="animate-spin" /> : null}
          Guardar borrador
        </Button>
        <Button onClick={() => onGuardar(true)} disabled={!puedeConciliar || pendiente}>
          {procesando === "conciliar" ? <Loader2 className="animate-spin" /> : null}
          Conciliar
        </Button>
      </div>
    </>
  );
}

export function PanelConciliacion({
  conciliacionId,
  cuentaId,
  fechaDesde,
  fechaHasta,
  saldoCentavos,
  gastosCentavos,
  entradasBancariasCentavos,
  estado,
  movimientos,
  seleccionados,
  bloqueados,
  saldoAnteriorCentavos,
  asientoId,
  asientoNumero,
  conciliadoEn,
  soloLectura,
}: Props) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState(() => new Set(seleccionados));
  const [saldo, setSaldo] = useState(() => aTexto(saldoCentavos));
  const [gastos, setGastos] = useState(() => aTexto(gastosCentavos));
  const [entradas, setEntradas] = useState(() => aTexto(entradasBancariasCentavos));
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<"borrador" | "conciliar" | null>(null);
  const [pendiente, iniciar] = useTransition();

  const conciliada = estado === "conciliada";
  const movimientosVisibles = conciliada
    ? movimientos.filter((movimiento) => seleccion.has(movimiento.id))
    : movimientos;
  const seleccionables = movimientosVisibles.filter((movimiento) => !(movimiento.id in bloqueados));
  const todosSeleccionados = seleccionables.length > 0 && seleccionables.every((m) => seleccion.has(m.id));

  const saldoExtractoCentavos = parsearCentavos(saldo) ?? 0;
  const resumen = resumenConciliacion({
    saldoAnteriorCentavos,
    saldoExtractoCentavos,
    movimientos,
    seleccionados: seleccion,
    gastosAjusteCentavos: parsearCentavos(gastos) ?? 0,
    entradasAjusteCentavos: parsearCentavos(entradas) ?? 0,
  });

  function alternar(id: string) {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function alternarTodos() {
    setSeleccion((actual) => {
      const siguiente = new Set(actual);
      if (todosSeleccionados) {
        for (const movimiento of seleccionables) siguiente.delete(movimiento.id);
      } else {
        for (const movimiento of seleccionables) siguiente.add(movimiento.id);
      }
      return siguiente;
    });
  }

  const columnas: readonly ColumnaLista<MovimientoBanco>[] = [
    {
      clave: "fecha",
      encabezado: "Fecha",
      celda: (movimiento) => <span className="tabular-nums">{formatoDia(movimiento.fecha)}</span>,
    },
    {
      clave: "documento",
      encabezado: "Documento",
      celda: (movimiento) => (
        <span className="flex flex-col gap-0.5 whitespace-normal">
          {movimiento.documento.href ? (
            <Link href={movimiento.documento.href} className="text-primary underline-offset-4 hover:underline">
              {movimiento.documento.etiqueta}
            </Link>
          ) : (
            <span>{movimiento.documento.etiqueta}</span>
          )}
          <Link
            href={rutaAsiento(movimiento.asientoId)}
            className="text-muted-foreground text-xs underline-offset-4 hover:underline"
          >
            Asiento #{movimiento.asientoNumero}
          </Link>
          {movimiento.id in bloqueados ? (
            <PillEstado tono="neutro">
              <span className="mt-0.5 w-fit text-[10px]">En otra conciliación</span>
            </PillEstado>
          ) : null}
        </span>
      ),
    },
    {
      clave: "tercero",
      encabezado: "Tercero",
      celda: (movimiento) =>
        movimiento.tercero ? (
          <Link href={rutaContacto(movimiento.tercero.id)} className="text-primary underline-offset-4 hover:underline">
            {movimiento.tercero.nombre}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      clave: "entrada",
      encabezado: "Entrada",
      alineacion: "derecha",
      celda: (movimiento) => (movimiento.entradaCentavos === 0 ? "—" : formatearRd(movimiento.entradaCentavos)),
    },
    {
      clave: "salida",
      encabezado: "Salida",
      alineacion: "derecha",
      celda: (movimiento) => (movimiento.salidaCentavos === 0 ? "—" : formatearRd(movimiento.salidaCentavos)),
    },
  ];

  function guardar(conciliar: boolean) {
    setError(null);
    const saldoCent = parsearCentavos(saldo);
    const errorValidacion = validarConciliacion({
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      saldoCentavos: saldoCent,
      lineas: [...seleccion],
      requiereMovimientos: conciliar,
    });
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    const gastosCent = parsearCentavos(gastos) ?? 0;
    const entradasCent = parsearCentavos(entradas) ?? 0;
    const entrada = {
      conciliacion_id: conciliacionId,
      cuenta_id: cuentaId,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta,
      saldo_bancario: centavosAValor(saldoCent ?? 0),
      gastos_bancarios: centavosAValor(gastosCent),
      entradas_bancarias: centavosAValor(entradasCent),
      lineas: [...seleccion],
    };

    setProcesando(conciliar ? "conciliar" : "borrador");
    iniciar(async () => {
      const resultado = conciliar ? await conciliarCuenta(entrada) : await guardarConciliacionBorrador(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        setProcesando(null);
        return;
      }

      toast.add({
        type: "success",
        title: conciliar ? "Conciliación guardada" : "Borrador guardado",
        description: conciliar ? "La conciliación quedó marcada como conciliada." : "Puedes terminarla más tarde.",
      });
      setProcesando(null);
      router.refresh();
    });
  }

  const puedeConciliar = !pendiente && seleccion.size > 0 && resumen.cuadra;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Resumen etiqueta="Saldo anterior" valor={formatearRd(saldoAnteriorCentavos)} />
        <Resumen etiqueta="Entradas" valor={formatearRd(resumen.entradasCentavos)} />
        <Resumen etiqueta="Salidas" valor={formatearRd(resumen.salidasCentavos)} />
        <Resumen etiqueta="Saldo total" valor={formatearRd(resumen.saldoTotalCentavos)} />
        <Resumen
          etiqueta="Diferencia"
          valor={formatearRd(resumen.diferenciaCentavos)}
          destacado={resumen.cuadra ? "ok" : "pendiente"}
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Movimientos del período</CardTitle>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              <span className="tabular-nums">
                {formatoDia(fechaDesde)} — {formatoDia(fechaHasta)}
              </span>
              {conciliada ? (
                <PillEstado tono="exito">Conciliada</PillEstado>
              ) : (
                <PillEstado tono="pendiente">Borrador</PillEstado>
              )}
              {conciliadoEn ? <span>· {formatoFechaHora(conciliadoEn)}</span> : null}
              {asientoId ? (
                <Link href={rutaAsiento(asientoId)} className="text-primary underline-offset-4 hover:underline">
                  Asiento #{asientoNumero ?? "—"}
                </Link>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {!soloLectura && !conciliada ? (
            <AjustesBancarios
              saldo={saldo}
              gastos={gastos}
              entradas={entradas}
              onSaldo={setSaldo}
              onGastos={setGastos}
              onEntradas={setEntradas}
              pendiente={pendiente}
            />
          ) : null}

          <TablaLista
            columnas={columnas}
            filas={movimientosVisibles}
            claveFila={(movimiento) => movimiento.id}
            seleccion={{
              cabecera:
                !soloLectura && !conciliada ? (
                  <Checkbox
                    checked={todosSeleccionados}
                    onCheckedChange={alternarTodos}
                    disabled={pendiente || seleccionables.length === 0}
                    aria-label="Seleccionar todos los movimientos"
                  />
                ) : (
                  <CheckCircle2 className="text-muted-foreground size-4" />
                ),
              celda: (movimiento) =>
                !soloLectura && !conciliada ? (
                  <Checkbox
                    checked={seleccion.has(movimiento.id)}
                    onCheckedChange={() => alternar(movimiento.id)}
                    disabled={pendiente || movimiento.id in bloqueados}
                    aria-label={`Marcar movimiento del ${formatoDia(movimiento.fecha)}`}
                  />
                ) : (
                  <CheckCircle2
                    className={
                      seleccion.has(movimiento.id) ? "size-4 text-emerald-600" : "text-muted-foreground size-4"
                    }
                  />
                ),
            }}
            vacio={{
              filtrada: true,
              titulo: "Sin movimientos",
              descripcion: "No hay movimientos en el período.",
            }}
          />
        </CardContent>
      </Card>

      {!soloLectura && !conciliada ? (
        <AccionesConciliacion
          cuadra={resumen.cuadra}
          puedeConciliar={puedeConciliar}
          error={error}
          pendiente={pendiente}
          procesando={procesando}
          onGuardar={guardar}
        />
      ) : null}

      {error && (soloLectura || conciliada) ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function Resumen({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: "ok" | "pendiente" }) {
  let color = "";
  if (destacado === "ok") color = "text-emerald-600 dark:text-emerald-400";
  if (destacado === "pendiente") color = "text-amber-600 dark:text-amber-400";

  return (
    <div className="bg-card ring-foreground/10 flex flex-col gap-1 rounded-xl p-4 ring-1">
      <span className="text-muted-foreground text-xs">{etiqueta}</span>
      <span className={`text-lg font-semibold tabular-nums ${color}`}>{valor}</span>
    </div>
  );
}
