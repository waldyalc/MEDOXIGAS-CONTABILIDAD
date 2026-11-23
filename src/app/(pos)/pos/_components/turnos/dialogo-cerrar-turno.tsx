"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { formatoMoneda } from "@/lib/facturacion/formato";
import { cerrarTurno } from "@/lib/pos/acciones";
import { centavosATexto, centavosDeDecimal, compararMontos } from "@/lib/pos/calculo";
import type { CierreTurnoPOS, ResumenTurnoVista } from "@/lib/pos/tipos";

import { capitalizar, textoAMonto } from "../formato-pos";
import { useOfflinePOS } from "../offline-pos-provider";

export function DialogoCerrarTurno({
  abierto,
  onCerrar,
  vista,
  onCerrado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  vista: ResumenTurnoVista;
  onCerrado: (datos: CierreTurnoPOS) => void;
}) {
  const offline = useOfflinePOS();
  const cierreBloqueado =
    !offline.preparado || offline.estado === "offline" || offline.estado === "sincronizando" || offline.pendientes > 0;
  const mensajeOffline =
    offline.pendientes > 0
      ? `Conéctate para subir ${offline.pendientes} ventas antes de cerrar`
      : "Conéctate a internet para cerrar el turno";
  const [real, setReal] = useState("");
  const [registrarDiferencia, setRegistrarDiferencia] = useState(true);
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const esperado = vista.resumen.efectivo.efectivo_esperado;

  useEffect(() => {
    if (!abierto) return;
    setReal("");
    setRegistrarDiferencia(true);
    setObservaciones("");
    setError(null);
  }, [abierto]);

  const realValido = textoAMonto(real);
  const diferenciaCentavos = (centavosDeDecimal(realValido ?? "0") ?? 0) - (centavosDeDecimal(esperado) ?? 0);
  const diferencia = centavosATexto(diferenciaCentavos);
  const hayDiferencia = diferenciaCentavos !== 0;
  const esperadoNegativo = compararMontos(esperado, "0") < 0;

  async function cerrar() {
    if (realValido === null) {
      setError("El efectivo real es obligatorio.");
      return;
    }
    if (Number(realValido) < 0) {
      setError("El efectivo real no puede ser negativo.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const resultado = await offline.conCierreSeguro(() =>
        cerrarTurno({
          turno_id: vista.turno.id,
          efectivo_real: realValido,
          registrar_diferencia: hayDiferencia ? registrarDiferencia : false,
          ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        }),
      );

      if (!resultado.ok) {
        setError(capitalizar(resultado.error));
        return;
      }

      toast.add({ type: "success", title: "Turno cerrado." });
      onCerrado(resultado.data);
      onCerrar();
    } catch {
      setError("No sabemos si el turno se cerró. Revisa Turnos antes de intentarlo de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(nuevo) => (nuevo ? null : onCerrar())}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{`Cerrar turno No ${vista.turno.numero}`}</DialogTitle>
          <DialogDescription>{vista.terminal.nombre}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="bg-muted/40 flex flex-col gap-1 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base inicial</span>
              <span className="tabular-nums">{formatoMoneda(vista.resumen.efectivo.base_inicial)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ventas en efectivo</span>
              <span className="tabular-nums">{formatoMoneda(vista.resumen.ventas.por_metodo.efectivo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ventas con tarjeta</span>
              <span className="tabular-nums">{formatoMoneda(vista.resumen.ventas.por_metodo.tarjeta)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ventas por transferencia</span>
              <span className="tabular-nums">{formatoMoneda(vista.resumen.ventas.por_metodo.transferencia)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Devoluciones en efectivo</span>
              <span className="text-destructive tabular-nums">
                {compararMontos(vista.resumen.devoluciones.efectivo, "0") > 0
                  ? `−${formatoMoneda(vista.resumen.devoluciones.efectivo)}`
                  : formatoMoneda(vista.resumen.devoluciones.efectivo)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ingresos</span>
              <span className="tabular-nums">{formatoMoneda(vista.resumen.ingresos.total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retiros</span>
              <span className="text-destructive tabular-nums">
                {compararMontos(vista.resumen.retiros.total, "0") > 0
                  ? `−${formatoMoneda(vista.resumen.retiros.total)}`
                  : formatoMoneda(vista.resumen.retiros.total)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t pt-1">
              <span className="font-medium">Efectivo esperado en caja</span>
              <span className="text-lg font-semibold tabular-nums">{formatoMoneda(esperado)}</span>
            </div>
          </div>

          {esperadoNegativo ? (
            <Alert variant="destructive">
              <AlertDescription>
                El efectivo esperado es negativo; revisa los pagos y devoluciones del turno antes de cerrar.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="efectivo-real">Dinero en efectivo del cierre</Label>
            <InputGroup className="h-10">
              <InputGroupAddon>
                <InputGroupText>RD$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                id="efectivo-real"
                value={real}
                inputMode="decimal"
                onChange={(evento) => setReal(evento.target.value)}
              />
            </InputGroup>
            <p className="text-muted-foreground text-xs">
              Cuenta el efectivo físico del cajón. El efectivo esperado es solo una referencia.
            </p>
          </div>

          {realValido !== null ? (
            <p className={diferenciaCentavos < 0 ? "text-destructive text-sm font-medium" : "text-sm font-medium"}>
              {diferenciaCentavos > 0
                ? `Sobrante de ${formatoMoneda(diferencia)}`
                : diferenciaCentavos < 0
                  ? `Faltante de ${formatoMoneda(centavosATexto(Math.abs(diferenciaCentavos)))}`
                  : "La caja cuadra."}
            </p>
          ) : null}

          {realValido !== null && hayDiferencia ? (
            <div className="flex items-center gap-3">
              <Switch
                id="registrar-diferencia"
                checked={registrarDiferencia}
                onCheckedChange={setRegistrarDiferencia}
              />
              <div className="flex flex-col">
                <Label htmlFor="registrar-diferencia">Registrar la diferencia en contabilidad</Label>
                <p className="text-muted-foreground text-xs">
                  Crea el asiento de sobrante o faltante. Si lo apagas, la diferencia queda documentada sin asiento.
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1">
            <Label htmlFor="observaciones-cierre">Observaciones</Label>
            <Textarea
              id="observaciones-cierre"
              value={observaciones}
              maxLength={500}
              onChange={(evento) => setObservaciones(evento.target.value)}
            />
          </div>

          <p className="text-muted-foreground text-xs">El turno se cerrará y no se puede reabrir.</p>

          {cierreBloqueado ? (
            <p role="alert">{mensajeOffline}. El cuadre solo incluye operaciones sincronizadas.</p>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            className="h-12"
            onClick={() => void cerrar()}
            disabled={enviando || esperadoNegativo || cierreBloqueado}
          >
            {enviando ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {enviando ? "Cerrando turno…" : "Cerrar turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
