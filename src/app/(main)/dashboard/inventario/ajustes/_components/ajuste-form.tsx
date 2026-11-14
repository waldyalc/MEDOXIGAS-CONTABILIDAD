"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_INPUT_GROUP,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormDivider,
  FormField,
  FormSectionTitle,
  FormTotal,
} from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { centavosAValor, parsearCantidad, parsearCentavos } from "@/lib/facturacion/calculo";
import { formatoMonedaCentavos } from "@/lib/facturacion/formato";
import { crearAjusteInventario } from "@/lib/inventario/acciones";
import { calcularTotalAjusteCentavos, totalLineaAjusteCentavos } from "@/lib/inventario/calculo";
import type { Almacen, ProductoInventario } from "@/lib/inventario/tipos";
import { TIPOS_AJUSTE, type TipoAjuste, validarAjuste } from "@/lib/inventario/validacion";
import { formatoCantidad } from "@/lib/productos/productos";

const OPCIONES_TIPO = TIPOS_AJUSTE.map((tipo) => ({
  value: tipo,
  label: tipo === "entrada" ? "Entrada" : "Salida",
}));

interface LineaFormulario {
  clave: number;
  productoId: string;
  tipo: TipoAjuste;
  cantidad: string;
  costo: string;
}

export function AjusteForm({
  almacenes,
  productos,
  almacenPorDefecto,
  fechaHoy,
}: {
  almacenes: Almacen[];
  productos: ProductoInventario[];
  almacenPorDefecto: string;
  fechaHoy: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const siguienteClave = useRef(1);

  const [fecha, setFecha] = useState(fechaHoy);
  const [almacenId, setAlmacenId] = useState(almacenPorDefecto);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>([
    { clave: 0, productoId: "", tipo: "entrada", cantidad: "1", costo: "" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const productosItems = productos.map((producto) => ({
    value: producto.id,
    label: `${producto.nombre}${producto.referencia ? ` · ${producto.referencia}` : ""} (exist. ${formatoCantidad(producto.cantidad)})`,
  }));
  const almacenesItems = almacenes.map((almacen) => ({
    value: almacen.id,
    label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
  }));

  const totalCentavos = calcularTotalAjusteCentavos(
    lineas.map((linea) => ({
      cantidad: parsearCantidad(linea.cantidad),
      costoCentavos: parsearCentavos(linea.costo) ?? 0,
    })),
  );

  function agregarLinea() {
    const clave = siguienteClave.current;
    siguienteClave.current += 1;
    setLineas((actuales) => [...actuales, { clave, productoId: "", tipo: "entrada", cantidad: "1", costo: "" }]);
  }

  function quitarLinea(clave: number) {
    setLineas((actuales) => (actuales.length > 1 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function actualizarLinea(clave: number, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function seleccionarProducto(clave: number, productoId: string) {
    const producto = productos.find((item) => item.id === productoId);
    actualizarLinea(clave, {
      productoId,
      ...(producto ? { costo: String(producto.costo) } : {}),
    });
  }

  function guardar() {
    setError(null);

    const validables = lineas.map((linea) => ({
      producto_id: linea.productoId,
      cantidad: parsearCantidad(linea.cantidad),
      costoCentavos: parsearCentavos(linea.costo),
    }));
    const errorValidacion = validarAjuste({ almacen_id: almacenId, lineas: validables });
    if (errorValidacion) {
      setError(errorValidacion);
      return;
    }

    iniciar(async () => {
      const resultado = await crearAjusteInventario({
        fecha,
        almacen_id: almacenId,
        ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
        lineas: lineas.map((linea) => ({
          producto_id: linea.productoId,
          tipo: linea.tipo,
          cantidad: parsearCantidad(linea.cantidad),
          costo_unitario: centavosAValor(parsearCentavos(linea.costo) ?? 0),
        })),
      });

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/inventario/ajustes/${resultado.id}`);
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6"
    >
      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos del ajuste</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <FormField htmlFor="almacen" label="Almacén" required>
              <Select
                items={almacenesItems}
                value={almacenId}
                onValueChange={(valor: string | null) => setAlmacenId(valor ?? "")}
              >
                <SelectTrigger id="almacen" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  {almacenesItems.map((almacen) => (
                    <SelectItem key={almacen.value} value={almacen.value}>
                      {almacen.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField htmlFor="fecha" label="Fecha" required>
              <DatePicker id="fecha" value={fecha} onChange={setFecha} />
            </FormField>

            <FormField htmlFor="observaciones" label="Observaciones" className="sm:col-span-2">
              <Textarea
                id="observaciones"
                placeholder="Ej. Conteo físico de fin de mes"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                maxLength={2000}
                className={FORM_TEXTAREA}
              />
            </FormField>
          </div>
        </section>

        <FormDivider />

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <FormSectionTitle>Productos</FormSectionTitle>
            <Button type="button" variant="outline" size="sm" onClick={agregarLinea} disabled={pendiente}>
              <Plus />
              Agregar línea
            </Button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[240px]">Producto</TableHead>
                  <TableHead className="min-w-[130px]">Tipo</TableHead>
                  <TableHead className="min-w-[110px] text-right">Cantidad</TableHead>
                  <TableHead className="min-w-[150px] text-right">Costo unitario</TableHead>
                  <TableHead className="min-w-[130px] text-right">Total</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((linea, indice) => {
                  const totalLinea = totalLineaAjusteCentavos({
                    cantidad: parsearCantidad(linea.cantidad),
                    costoCentavos: parsearCentavos(linea.costo) ?? 0,
                  });

                  return (
                    <TableRow key={linea.clave}>
                      <TableCell>
                        <Select
                          items={productosItems}
                          value={linea.productoId === "" ? null : linea.productoId}
                          onValueChange={(valor: string | null) => seleccionarProducto(linea.clave, valor ?? "")}
                        >
                          <SelectTrigger
                            className={FORM_SELECT}
                            aria-label={`Producto de la línea ${indice + 1}`}
                            disabled={pendiente}
                          >
                            <SelectValue placeholder="Selecciona un producto…" />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            {productosItems.map((producto) => (
                              <SelectItem key={producto.value} value={producto.value}>
                                {producto.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          items={OPCIONES_TIPO}
                          value={linea.tipo}
                          onValueChange={(valor: string | null) => {
                            if (valor) actualizarLinea(linea.clave, { tipo: valor as TipoAjuste });
                          }}
                        >
                          <SelectTrigger
                            className={FORM_SELECT}
                            aria-label={`Tipo de la línea ${indice + 1}`}
                            disabled={pendiente}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent alignItemWithTrigger={false}>
                            {OPCIONES_TIPO.map((opcion) => (
                              <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          inputMode="decimal"
                          value={linea.cantidad}
                          onChange={(evento) => actualizarLinea(linea.clave, { cantidad: evento.target.value })}
                          aria-label={`Cantidad de la línea ${indice + 1}`}
                          disabled={pendiente}
                          className={FORM_INPUT}
                        />
                      </TableCell>
                      <TableCell>
                        <InputGroup className={FORM_INPUT_GROUP}>
                          <InputGroupAddon align="inline-start" className="pr-0 pl-2 text-sm text-slate-500">
                            RD$
                          </InputGroupAddon>
                          <InputGroupInput
                            inputMode="decimal"
                            value={linea.costo}
                            onChange={(evento) => actualizarLinea(linea.clave, { costo: evento.target.value })}
                            aria-label={`Costo unitario de la línea ${indice + 1}`}
                            disabled={pendiente}
                          />
                        </InputGroup>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatoMonedaCentavos(totalLinea)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar línea ${indice + 1}`}
                          onClick={() => quitarLinea(linea.clave)}
                          disabled={pendiente || lineas.length === 1}
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground mt-2 text-xs">
            La entrada recalcula el costo promedio del producto; la salida usa el costo indicado.
          </p>
        </section>

        <FormTotal>
          <div className="flex items-center justify-between text-xl leading-7 font-semibold text-slate-900">
            <span>Total ajustado</span>
            <span className="tabular-nums">{formatoMonedaCentavos(totalCentavos)}</span>
          </div>
        </FormTotal>
      </FormCard>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FormActions>
        <Button
          type="button"
          variant="outline"
          className={FORM_BUTTON}
          render={<Link href="/dashboard/inventario/ajustes" />}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pendiente || productos.length === 0 || almacenes.length === 0}
          className={FORM_BUTTON}
        >
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar ajuste
        </Button>
      </FormActions>

      {productos.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No hay productos que controlen inventario. Activa «Controlar inventario» en un producto para ajustarlo.
        </p>
      ) : null}
    </form>
  );
}
