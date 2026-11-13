"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { crearAsientoManual } from "@/lib/asientos/acciones";
import type { ContactoAsiento, CuentaAsiento } from "@/lib/asientos/tipos";
import { rutaAsiento } from "@/lib/enlaces";
import { centavosAValor, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";

interface LineaForm {
  clave: string;
  cuentaId: string;
  contactoId: string;
  debito: string;
  credito: string;
}

interface ItemCombobox {
  value: string;
  label: string;
}

interface Props {
  cuentas: CuentaAsiento[];
  contactos: ContactoAsiento[];
  fechaHoy: string;
}

function lineaVacia(clave: string): LineaForm {
  return { clave, cuentaId: "", contactoId: "", debito: "", credito: "" };
}

function montoCentavos(texto: string): number {
  return parsearCentavos(texto) ?? 0;
}

function tieneUnSoloLado(debito: number, credito: number): boolean {
  const hayDebito = debito > 0;
  const hayCredito = credito > 0;
  return hayDebito !== hayCredito;
}

export function AsientoForm({ cuentas, contactos, fechaHoy }: Props) {
  const router = useRouter();
  const contador = useRef(2);
  const [pendiente, iniciar] = useTransition();

  const [fecha, setFecha] = useState(fechaHoy);
  const [descripcion, setDescripcion] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia("l1"), lineaVacia("l2")]);
  const [error, setError] = useState<string | null>(null);

  const cuentasItems: ItemCombobox[] = cuentas.map((cuenta) => ({
    value: cuenta.id,
    label: `${cuenta.codigo} · ${cuenta.nombre}`,
  }));
  const contactosItems: ItemCombobox[] = contactos.map((contacto) => ({
    value: contacto.id,
    label: contacto.nombre,
  }));

  const debitosCentavos = lineas.reduce((total, linea) => total + montoCentavos(linea.debito), 0);
  const creditosCentavos = lineas.reduce((total, linea) => total + montoCentavos(linea.credito), 0);
  const descuadrado = debitosCentavos !== creditosCentavos;

  function actualizarLinea(clave: string, cambios: Partial<LineaForm>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function agregarLinea() {
    contador.current += 1;
    setLineas((actuales) => [...actuales, lineaVacia(`l${contador.current}`)]);
  }

  function quitarLinea(clave: string) {
    setLineas((actuales) => (actuales.length > 2 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function guardar() {
    setError(null);

    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    if (lineas.length < 2) {
      setError("Un asiento requiere al menos dos líneas.");
      return;
    }
    if (lineas.some((linea) => !linea.cuentaId)) {
      setError("Selecciona la cuenta en todas las líneas.");
      return;
    }
    if (
      lineas.some(
        (linea) =>
          (linea.debito.trim() !== "" && parsearCentavos(linea.debito) == null) ||
          (linea.credito.trim() !== "" && parsearCentavos(linea.credito) == null),
      )
    ) {
      setError("Revisa los montos: usa números con hasta dos decimales.");
      return;
    }
    if (lineas.some((linea) => !tieneUnSoloLado(montoCentavos(linea.debito), montoCentavos(linea.credito)))) {
      setError("Cada línea debe llevar débito o crédito, nunca ambos.");
      return;
    }
    if (debitosCentavos !== creditosCentavos) {
      setError(
        `El asiento está descuadrado: débitos ${formatoMonedaCentavos(debitosCentavos)} y créditos ${formatoMonedaCentavos(creditosCentavos)}.`,
      );
      return;
    }
    if (debitosCentavos <= 0) {
      setError("El asiento debe tener un monto mayor que cero.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearAsientoManual({
        fecha,
        descripcion: descripcion.trim(),
        lineas: lineas.map((linea) => ({
          cuenta_id: linea.cuentaId,
          ...(linea.contactoId ? { contacto_id: linea.contactoId } : {}),
          debito: centavosAValor(montoCentavos(linea.debito)),
          credito: centavosAValor(montoCentavos(linea.credito)),
        })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(rutaAsiento(resultado.id));
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos del asiento</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" type="date" required value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <Label htmlFor="descripcion">Descripción *</Label>
            <Input
              id="descripcion"
              required
              maxLength={500}
              value={descripcion}
              placeholder="Concepto del asiento"
              onChange={(evento) => setDescripcion(evento.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Líneas</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={agregarLinea}>
            <Plus />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-muted-foreground hidden gap-2 px-1 text-xs md:grid md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <span>Cuenta *</span>
            <span>Tercero</span>
            <span className="text-right">Débito</span>
            <span className="text-right">Crédito</span>
            <span className="w-8" />
          </div>

          {lineas.map((linea, indice) => (
            <div
              key={linea.clave}
              className="grid grid-cols-2 items-end gap-2 rounded-lg border p-2 md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:border-0 md:p-0"
            >
              <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`cuenta-${linea.clave}`}>
                  Cuenta {indice === 0 ? "*" : null}
                </Label>
                <Combobox
                  items={cuentasItems}
                  onValueChange={(item: ItemCombobox | null) =>
                    actualizarLinea(linea.clave, { cuentaId: item?.value ?? "" })
                  }
                >
                  <ComboboxInput id={`cuenta-${linea.clave}`} className="w-full" placeholder="Buscar cuenta…" />
                  <ComboboxContent>
                    <ComboboxEmpty>Sin cuentas</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ItemCombobox) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
                <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`tercero-${linea.clave}`}>
                  Tercero
                </Label>
                <Combobox
                  items={contactosItems}
                  onValueChange={(item: ItemCombobox | null) =>
                    actualizarLinea(linea.clave, { contactoId: item?.value ?? "" })
                  }
                >
                  <ComboboxInput id={`tercero-${linea.clave}`} className="w-full" placeholder="Opcional" showClear />
                  <ComboboxContent>
                    <ComboboxEmpty>Sin contactos</ComboboxEmpty>
                    <ComboboxList>
                      {(item: ItemCombobox) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`debito-${linea.clave}`}>
                  Débito
                </Label>
                <Input
                  id={`debito-${linea.clave}`}
                  className="text-right"
                  inputMode="decimal"
                  value={linea.debito}
                  onChange={(evento) => actualizarLinea(linea.clave, { debito: evento.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-muted-foreground text-xs md:hidden" htmlFor={`credito-${linea.clave}`}>
                  Crédito
                </Label>
                <Input
                  id={`credito-${linea.clave}`}
                  className="text-right"
                  inputMode="decimal"
                  value={linea.credito}
                  onChange={(evento) => actualizarLinea(linea.clave, { credito: evento.target.value })}
                />
              </div>

              <div className="col-span-2 flex justify-end md:col-span-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={lineas.length <= 2}
                  onClick={() => quitarLinea(linea.clave)}
                >
                  <Trash2 />
                  <span className="sr-only">Quitar línea</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="bg-muted/50 flex w-full flex-col gap-2 rounded-xl p-4 text-sm md:w-80">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total débitos</span>
            <span className="tabular-nums">{formatoMonedaCentavos(debitosCentavos)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total créditos</span>
            <span className="tabular-nums">{formatoMonedaCentavos(creditosCentavos)}</span>
          </div>
          <div
            className={`flex items-center justify-between border-t pt-2 font-semibold ${
              descuadrado ? "text-destructive" : ""
            }`}
          >
            <span>Diferencia</span>
            <span className="tabular-nums">{formatoMonedaCentavos(Math.abs(debitosCentavos - creditosCentavos))}</span>
          </div>
          {descuadrado ? (
            <p className="text-destructive text-xs">
              El asiento está descuadrado: los débitos y los créditos deben ser iguales para poder guardar.
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/dashboard/contabilidad/asientos" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || descuadrado}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar asiento
        </Button>
      </div>
    </form>
  );
}
