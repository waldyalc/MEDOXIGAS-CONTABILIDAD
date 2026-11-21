"use client";

import { useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2 } from "lucide-react";

import { FORM_BUTTON, FormActions, FormCard, FormDivider } from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { rutaAjusteInventario } from "@/lib/enlaces";
import { formatoDia } from "@/lib/formato";
import { anularConteo, aplicarConteo, guardarLineasConteo } from "@/lib/inventario/ferreteria/acciones";
import type { ConteoDetalle } from "@/lib/inventario/ferreteria/tipos";

import { EditorLineas } from "../../_components/editor-lineas";
import {
  cantidadACentavos,
  centavosADecimal,
  diferenciaCentavos,
  type LineaConteoFormulario,
  textoDiferencia,
  totalesConteo,
} from "../../_components/tipos-conteo";

function lineasIniciales(conteo: ConteoDetalle): LineaConteoFormulario[] {
  return conteo.lineas.map((linea) => ({
    producto_id: linea.producto_id,
    nombre: linea.producto_nombre,
    referencia: linea.producto_referencia,
    sistema: linea.cantidad_sistema,
    contada: linea.cantidad_contada,
    nota: linea.notas ?? "",
  }));
}

function serializar(lineas: readonly LineaConteoFormulario[]): string {
  return JSON.stringify(
    lineas.map((linea) => ({
      producto_id: linea.producto_id,
      contada: linea.contada,
      nota: linea.nota.trim(),
    })),
  );
}

function payloadLineas(lineas: readonly LineaConteoFormulario[]) {
  return lineas.map((linea) => ({
    producto_id: linea.producto_id,
    cantidad_contada: centavosADecimal(cantidadACentavos(linea.contada) ?? 0),
    ...(linea.nota.trim() ? { notas: linea.nota.trim() } : {}),
  }));
}

function ResumenAjuste({ conteo, lineas }: { conteo: ConteoDetalle; lineas: readonly LineaConteoFormulario[] }) {
  const totales = totalesConteo(lineas);
  const entradas = lineas.filter((linea) => (diferenciaCentavos(linea) ?? 0) > 0).length;
  const salidas = lineas.filter((linea) => (diferenciaCentavos(linea) ?? 0) < 0).length;

  return (
    <div className="border-border bg-muted/40 flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm">
      <p className="text-foreground font-medium">Ajuste que se generará</p>
      {totales.conDiferencia === 0 ? (
        <p className="text-muted-foreground">
          Todas las diferencias son cero: no se creará ajuste y el conteo solo cambiará a «Aplicado».
        </p>
      ) : (
        <>
          <p className="text-muted-foreground tabular-nums">
            Entradas: <span className="text-foreground font-medium">{entradas}</span> línea{entradas === 1 ? "" : "s"} ·{" "}
            <span className="font-medium text-green-700 dark:text-green-400">
              {textoDiferencia(totales.entradasCentavos)}
            </span>
          </p>
          <p className="text-muted-foreground tabular-nums">
            Salidas: <span className="text-foreground font-medium">{salidas}</span> línea{salidas === 1 ? "" : "s"} ·{" "}
            <span className="font-medium text-red-700 dark:text-red-400">
              {textoDiferencia(totales.salidasCentavos)}
            </span>
          </p>
          <p className="text-muted-foreground">
            Fecha {formatoDia(conteo.fecha)} · almacén {conteo.almacen_nombre}. El ajuste mueve el stock y genera su
            asiento contable.
          </p>
        </>
      )}
    </div>
  );
}

function DialogoAnular({
  conteo,
  abierto,
  onAbierto,
  pendiente,
  error,
  onAnular,
}: {
  conteo: ConteoDetalle;
  abierto: boolean;
  onAbierto: (abierto: boolean) => void;
  pendiente: boolean;
  error: string | null;
  onAnular: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={onAbierto}>
      <AlertDialogTrigger render={<Button variant="destructive" disabled={pendiente} />}>Anular</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Anular el conteo #{conteo.numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            El conteo está en borrador: se anula sin tocar el inventario ni la contabilidad.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={pendiente} onClick={onAnular}>
            {pendiente ? "Anulando…" : "Anular conteo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DialogoAplicar({
  conteo,
  lineas,
  abierto,
  onAbierto,
  pendiente,
  error,
  onAplicar,
}: {
  conteo: ConteoDetalle;
  lineas: readonly LineaConteoFormulario[];
  abierto: boolean;
  onAbierto: (abierto: boolean) => void;
  pendiente: boolean;
  error: string | null;
  onAplicar: () => void;
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={onAbierto}>
      <AlertDialogTrigger render={<Button className={FORM_BUTTON} disabled={pendiente || lineas.length === 0} />}>
        Aplicar conteo
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Aplicar el conteo #{conteo.numero}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se congelan las diferencias contra el stock del momento y el conteo queda aplicado. Esta acción genera el
            ajuste de inventario y no se puede deshacer desde el conteo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ResumenAjuste conteo={conteo} lineas={lineas} />

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={pendiente} onClick={onAplicar}>
            {pendiente ? "Aplicando…" : "Aplicar conteo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AccionesConteo({
  conteo,
  lineas,
  pendiente,
  hayCambios,
  error,
  aplicandoAbierto,
  onAplicandoAbierto,
  anulandoAbierto,
  onAnulandoAbierto,
  onGuardar,
  onAplicar,
  onAnular,
}: {
  conteo: ConteoDetalle;
  lineas: readonly LineaConteoFormulario[];
  pendiente: boolean;
  hayCambios: boolean;
  error: string | null;
  aplicandoAbierto: boolean;
  onAplicandoAbierto: (abierto: boolean) => void;
  anulandoAbierto: boolean;
  onAnulandoAbierto: (abierto: boolean) => void;
  onGuardar: () => void;
  onAplicar: () => void;
  onAnular: () => void;
}) {
  return (
    <>
      <FormDivider />
      <FormActions>
        <DialogoAnular
          conteo={conteo}
          abierto={anulandoAbierto}
          onAbierto={onAnulandoAbierto}
          pendiente={pendiente}
          error={error}
          onAnular={onAnular}
        />
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          disabled={pendiente || !hayCambios}
          onClick={onGuardar}
        >
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar líneas
        </Button>
        <DialogoAplicar
          conteo={conteo}
          lineas={lineas}
          abierto={aplicandoAbierto}
          onAbierto={onAplicandoAbierto}
          pendiente={pendiente}
          error={error}
          onAplicar={onAplicar}
        />
      </FormActions>
    </>
  );
}

function MensajesEstado({ conteo, editable }: { conteo: ConteoDetalle; editable: boolean }) {
  if (editable) return null;

  if (conteo.estado === "borrador") {
    return (
      <Alert>
        <AlertDescription>
          Tu rol es de solo lectura: puedes revisar el conteo, pero no editarlo ni aplicarlo.
        </AlertDescription>
      </Alert>
    );
  }

  if (conteo.estado === "anulado") {
    return (
      <Alert>
        <AlertDescription>Este conteo está anulado y no afectó el inventario.</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <AlertDescription>
        {conteo.ajuste_id ? (
          <>
            Conteo aplicado. Se generó el ajuste de inventario.{" "}
            <Link href={rutaAjusteInventario(conteo.ajuste_id)} prefetch={false} className="underline">
              Ver ajuste
            </Link>
            .
          </>
        ) : (
          "Conteo aplicado sin diferencias: no se generó ajuste de inventario."
        )}
      </AlertDescription>
    </Alert>
  );
}

export function DetalleConteo({ conteo, puedeEscribir }: { conteo: ConteoDetalle; puedeEscribir: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [lineas, setLineas] = useState<LineaConteoFormulario[]>(() => lineasIniciales(conteo));
  const [guardadas, setGuardadas] = useState(() => serializar(lineasIniciales(conteo)));
  const [error, setError] = useState<string | null>(null);
  const [aplicandoAbierto, setAplicandoAbierto] = useState(false);
  const [anulandoAbierto, setAnulandoAbierto] = useState(false);
  const validacion = useValidacionFormulario();

  const editable = conteo.estado === "borrador" && puedeEscribir;
  const hayCambios = serializar(lineas) !== guardadas;
  const totales = totalesConteo(lineas);

  function validarLineas(): boolean {
    return validacion.validar([
      {
        campo: "conteo-lineas",
        invalido: lineas.length === 0,
        mensaje: "Agrega al menos un producto antes de guardar.",
      },
      ...lineas.map((linea) => ({
        campo: `conteo-contada-${linea.producto_id}`,
        invalido: cantidadACentavos(linea.contada) === null,
        mensaje: "Escribe una cantidad de hasta 2 decimales (sin negativos).",
      })),
    ]);
  }

  /** Guarda las líneas y devuelve el error en español, o `null` si quedaron. */
  async function persistirLineas(): Promise<string | null> {
    const resultado = await guardarLineasConteo(conteo.id, { lineas: payloadLineas(lineas) });
    if (!resultado.ok) return resultado.error;

    setGuardadas(serializar(lineas));
    return null;
  }

  function guardar() {
    setError(null);
    if (!validarLineas()) return;

    iniciar(async () => {
      const problema = await persistirLineas();
      if (problema) {
        setError(problema);
        return;
      }

      toast.add({ type: "success", title: "Líneas guardadas" });
      router.refresh();
    });
  }

  function aplicar() {
    setError(null);
    if (!validarLineas()) {
      setAplicandoAbierto(false);
      return;
    }

    iniciar(async () => {
      // Lo que se ve en pantalla es lo que se aplica: primero se guardan las
      // líneas y después la RPC congela sistema/diferencia y crea el ajuste.
      const problema = await persistirLineas();
      if (problema) {
        setError(problema);
        return;
      }

      const resultado = await aplicarConteo(conteo.id);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAplicandoAbierto(false);
      toast.add({
        type: "success",
        title: "Conteo aplicado",
        description: resultado.ajusteId
          ? "Se creó el ajuste de inventario con su asiento contable."
          : "No hubo diferencias: no se creó ajuste.",
      });
      router.refresh();
    });
  }

  function anular() {
    setError(null);

    iniciar(async () => {
      const resultado = await anularConteo(conteo.id);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAnulandoAbierto(false);
      toast.add({ type: "success", title: "Conteo anulado" });
      router.refresh();
    });
  }

  return (
    <FormCard>
      <EditorLineas
        almacenId={conteo.almacen_id}
        lineas={lineas}
        onCambiar={setLineas}
        deshabilitado={pendiente}
        errores={validacion.errores}
        onLimpiarError={validacion.limpiar}
        soloLectura={!editable}
      />

      {validacion.errorDe("conteo-lineas") ? (
        <p role="alert" className="text-destructive text-xs">
          {validacion.errorDe("conteo-lineas")}
        </p>
      ) : null}

      <div className="text-foreground flex items-center justify-between border-t pt-4 text-base font-semibold">
        <span>Diferencia total</span>
        <span className="tabular-nums">{textoDiferencia(totales.diferenciaCentavos)}</span>
      </div>

      {editable ? (
        <AccionesConteo
          conteo={conteo}
          lineas={lineas}
          pendiente={pendiente}
          hayCambios={hayCambios}
          error={error}
          aplicandoAbierto={aplicandoAbierto}
          onAplicandoAbierto={(abierto) => {
            if (abierto) setError(null);
            setAplicandoAbierto(abierto);
          }}
          anulandoAbierto={anulandoAbierto}
          onAnulandoAbierto={(abierto) => {
            if (abierto) setError(null);
            setAnulandoAbierto(abierto);
          }}
          onGuardar={guardar}
          onAplicar={aplicar}
          onAnular={anular}
        />
      ) : null}

      <MensajesEstado conteo={conteo} editable={editable} />

      {error && !aplicandoAbierto && !anulandoAbierto ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </FormCard>
  );
}
