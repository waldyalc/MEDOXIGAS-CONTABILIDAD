"use client";

import { useRef, useState, useTransition } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Loader2, Plus, Trash2 } from "lucide-react";

import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { parsearCantidad } from "@/lib/facturacion/calculo";
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

    const validacion = transferenciaSchema.safeParse(entrada);
    if (!validacion.success) {
      setError(validacion.error.issues[0]?.message ?? "Revisa los datos de la transferencia.");
      return;
    }

    iniciar(async () => {
      const resultado = await crearTransferencia(validacion.data);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      router.push(`/dashboard/inventario/transferencias/${resultado.id}`);
    });
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        guardar();
      }}
      className="flex flex-col gap-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos de la transferencia</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="origen">Almacén de origen *</Label>
            <Select
              items={almacenesItems}
              value={origenId}
              onValueChange={(valor: string | null) => setOrigenId(valor ?? "")}
            >
              <SelectTrigger id="origen" className="w-full">
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="destino">Almacén de destino *</Label>
            <Select
              items={almacenesItems}
              value={destinoId}
              onValueChange={(valor: string | null) => setDestinoId(valor ?? "")}
            >
              <SelectTrigger id="destino" className="w-full">
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
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <DatePicker id="fecha" value={fecha} onChange={setFecha} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              placeholder="Ej. Traslado a la sucursal"
              value={observaciones}
              onChange={(evento) => setObservaciones(evento.target.value)}
              maxLength={2000}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Productos</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={agregarLinea} disabled={pendiente}>
            <Plus />
            Agregar línea
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
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
                          className="w-full"
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
                      <Input
                        inputMode="decimal"
                        className="text-right"
                        value={linea.cantidad}
                        onChange={(evento) => actualizarLinea(linea.clave, { cantidad: evento.target.value })}
                        aria-label={`Cantidad de la línea ${indice + 1}`}
                        disabled={pendiente}
                      />
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
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" render={<Link href="/dashboard/inventario/transferencias" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendiente || productos.length === 0 || almacenes.length < 2}>
          {pendiente ? <Loader2 className="animate-spin" /> : null}
          Guardar transferencia
        </Button>
      </div>

      {almacenes.length < 2 ? (
        <p className="text-muted-foreground text-sm">Necesitas al menos dos almacenes activos para transferir.</p>
      ) : null}
    </form>
  );
}
