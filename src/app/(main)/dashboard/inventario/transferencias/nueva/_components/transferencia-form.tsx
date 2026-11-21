"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { DatePicker } from "@/components/date-picker";
import { CampoFormulario } from "@/components/formularios/campo-formulario";
import {
  FORM_BUTTON,
  FORM_INPUT,
  FORM_SELECT,
  FORM_TEXTAREA,
  FormActions,
  FormCard,
  FormDivider,
  FormSectionTitle,
} from "@/components/formularios/formulario";
import { useValidacionFormulario } from "@/components/formularios/validacion";
import { Loader2, Plus, Trash2 } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { parsearCantidad } from "@/lib/facturacion/calculo";
import { requerido } from "@/lib/formularios/validacion";
import { crearTransferencia } from "@/lib/inventario/acciones";
import type { Almacen, ProductoInventario } from "@/lib/inventario/tipos";
import { transferenciaSchema } from "@/lib/inventario/validacion";
import { formatoCantidad } from "@/lib/productos/productos";

interface LineaFormulario {
  clave: number;
  productoId: string;
  cantidad: string;
}

export function TransferenciaForm({
  almacenes,
  productos,
  origenPorDefecto,
  destinoPorDefecto,
  fechaHoy,
}: {
  almacenes: Almacen[];
  productos: ProductoInventario[];
  origenPorDefecto: string;
  destinoPorDefecto: string;
  fechaHoy: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const siguienteClave = useRef(1);

  const [fecha, setFecha] = useState(fechaHoy);
  const [origenId, setOrigenId] = useState(origenPorDefecto);
  const [destinoId, setDestinoId] = useState(destinoPorDefecto);
  const [observaciones, setObservaciones] = useState("");
  const [lineas, setLineas] = useState<LineaFormulario[]>([{ clave: 0, productoId: "", cantidad: "1" }]);
  const [error, setError] = useState<string | null>(null);
  const validacion = useValidacionFormulario();

  const almacenesItems = almacenes.map((almacen) => ({
    value: almacen.id,
    label: almacen.es_principal ? `${almacen.nombre} (principal)` : almacen.nombre,
  }));
  const productosItems = productos.map((producto) => ({
    value: producto.id,
    label: `${producto.nombre}${producto.referencia ? ` · ${producto.referencia}` : ""} (exist. ${formatoCantidad(producto.cantidad)})`,
  }));

  function agregarLinea() {
    const clave = siguienteClave.current;
    siguienteClave.current += 1;
    setLineas((actuales) => [...actuales, { clave, productoId: "", cantidad: "1" }]);
  }

  function quitarLinea(clave: number) {
    setLineas((actuales) => (actuales.length > 1 ? actuales.filter((linea) => linea.clave !== clave) : actuales));
  }

  function actualizarLinea(clave: number, cambios: Partial<LineaFormulario>) {
    setLineas((actuales) => actuales.map((linea) => (linea.clave === clave ? { ...linea, ...cambios } : linea)));
  }

  function guardar() {
    setError(null);

    const entrada = {
      fecha,
      origen_id: origenId,
      destino_id: destinoId,
      ...(observaciones.trim() ? { observaciones: observaciones.trim() } : {}),
      lineas: lineas.map((linea) => ({
        producto_id: linea.productoId,
        cantidad: parsearCantidad(linea.cantidad),
      })),
    };

    const reglas = [
      requerido("origen", origenId, "El almacén de origen es requerido."),
      requerido("destino", destinoId, "El almacén de destino es requerido."),
      requerido("fecha", fecha, "La fecha es requerida."),
      ...lineas.flatMap((linea) => {
        const cantidad = parsearCantidad(linea.cantidad);
        return [
          requerido(`transferencia-producto-${linea.clave}`, linea.productoId, "Seleccione un producto."),
          {
            campo: `transferencia-cantidad-${linea.clave}`,
            invalido: !Number.isFinite(cantidad) || cantidad <= 0,
            mensaje: "La cantidad debe ser mayor que cero.",
          },
        ];
      }),
      {
        campo: "destino",
        invalido: origenId !== "" && origenId === destinoId,
        mensaje: "El almacén de destino debe ser distinto al de origen.",
      },
    ];

    if (!validacion.validar(reglas)) return;

    const resultadoValidacion = transferenciaSchema.safeParse(entrada);
    if (!resultadoValidacion.success) {
      setError(resultadoValidacion.error.issues[0]?.message ?? "Revisa los datos de la transferencia.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearTransferencia(resultadoValidacion.data);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/inventario/transferencias/${resultado.id}`);
    });
  }

  return (
    <form
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
      className="mx-auto flex w-full max-w-[1040px] flex-col gap-6"
    >
      <FormCard>
        <section>
          <FormSectionTitle className="mb-4">Datos de la transferencia</FormSectionTitle>
          <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <CampoFormulario htmlFor="origen" label="Almacén de origen" required error={validacion.errorDe("origen")}>
              <Select
                items={almacenesItems}
                value={origenId}
                onValueChange={(valor: string | null) => {
                  setOrigenId(valor ?? "");
                  validacion.limpiar("origen");
                }}
              >
                <SelectTrigger id="origen" className={FORM_SELECT}>
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
            </CampoFormulario>
            <CampoFormulario
              htmlFor="destino"
              label="Almacén de destino"
              required
              error={validacion.errorDe("destino")}
            >
              <Select
                items={almacenesItems}
                value={destinoId}
                onValueChange={(valor: string | null) => {
                  setDestinoId(valor ?? "");
                  validacion.limpiar("destino");
                }}
              >
                <SelectTrigger id="destino" className={FORM_SELECT}>
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
            </CampoFormulario>
            <CampoFormulario htmlFor="fecha" label="Fecha" required error={validacion.errorDe("fecha")}>
              <DatePicker
                id="fecha"
                value={fecha}
                onChange={(valor) => {
                  setFecha(valor);
                  validacion.limpiar("fecha");
                }}
              />
            </CampoFormulario>
            <CampoFormulario htmlFor="observaciones" label="Observaciones">
              <Textarea
                id="observaciones"
                placeholder="Ej. Traslado a la sucursal"
                value={observaciones}
                onChange={(evento) => setObservaciones(evento.target.value)}
                maxLength={2000}
                className={FORM_TEXTAREA}
              />
            </CampoFormulario>
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
                  <TableHead className="min-w-[110px] text-right">Cantidad</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineas.map((linea, indice) => (
                  <TableRow key={linea.clave}>
                    <TableCell>
                      <Select
                        items={productosItems}
                        value={linea.productoId === "" ? null : linea.productoId}
                        onValueChange={(valor: string | null) =>
                          actualizarLinea(linea.clave, { productoId: valor ?? "" })
                        }
                      >
                        <SelectTrigger
                          id={`transferencia-producto-${linea.clave}`}
                          className={FORM_SELECT}
                          aria-label={`Producto de la línea ${indice + 1}`}
                          aria-invalid={Boolean(validacion.errorDe(`transferencia-producto-${linea.clave}`))}
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
                      {validacion.errorDe(`transferencia-producto-${linea.clave}`) ? (
                        <p role="alert" className="text-destructive mt-1 text-xs">
                          {validacion.errorDe(`transferencia-producto-${linea.clave}`)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        id={`transferencia-cantidad-${linea.clave}`}
                        inputMode="decimal"
                        className={`${FORM_INPUT} text-right`}
                        value={linea.cantidad}
                        onChange={(evento) => {
                          actualizarLinea(linea.clave, { cantidad: evento.target.value });
                          validacion.limpiar(`transferencia-cantidad-${linea.clave}`);
                        }}
                        aria-label={`Cantidad de la línea ${indice + 1}`}
                        aria-invalid={Boolean(validacion.errorDe(`transferencia-cantidad-${linea.clave}`))}
                        disabled={pendiente}
                      />
                      {validacion.errorDe(`transferencia-cantidad-${linea.clave}`) ? (
                        <p role="alert" className="text-destructive mt-1 text-xs">
                          {validacion.errorDe(`transferencia-cantidad-${linea.clave}`)}
                        </p>
                      ) : null}
                    </TableCell>
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
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            La transferencia no genera asiento contable: el costo total no cambia.
          </p>
        </section>
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
          render={<Link href="/dashboard/inventario/transferencias" />}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={pendiente || productos.length === 0 || almacenes.length < 2}
          className={FORM_BUTTON}
        >
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar transferencia
        </Button>
      </FormActions>

      {almacenes.length < 2 ? (
        <p className="text-muted-foreground text-sm">Necesitas al menos dos almacenes activos para transferir.</p>
      ) : null}
    </form>
  );
}
