"use client";

import { type FormEvent, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Pencil, Plus } from "lucide-react";

import { FORM_INPUT, FORM_SELECT, FormField } from "@/components/formularios/formulario";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { actualizarListaPrecio, crearListaPrecio } from "@/lib/inventario/acciones";
import { etiquetaTipoLista } from "@/lib/inventario/precios";
import type { ListaPrecio, TipoListaPrecio } from "@/lib/inventario/tipos";

const OPCIONES_TIPO: { value: TipoListaPrecio; label: string }[] = [
  { value: "fijo", label: "Valor fijo" },
  { value: "porcentaje", label: "Porcentaje sobre el precio" },
];

export function ListasPreciosCliente({ listas, puedeEditar }: { listas: ListaPrecio[]; puedeEditar: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<ListaPrecio | null>(null);
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TipoListaPrecio>("fijo");
  const [principal, setPrincipal] = useState(false);
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const esPrincipal = editando?.es_principal ?? false;

  function abrirNueva() {
    setEditando(null);
    setNombre("");
    setTipo("fijo");
    setPrincipal(false);
    setActivo(true);
    setError(null);
    setAbierto(true);
  }

  function abrirEditar(lista: ListaPrecio) {
    setEditando(lista);
    setNombre(lista.nombre);
    setTipo(lista.tipo);
    setPrincipal(lista.es_principal);
    setActivo(lista.activo);
    setError(null);
    setAbierto(true);
  }

  function cambiarAbierto(abrir: boolean) {
    setAbierto(abrir);
    if (!abrir) {
      setEditando(null);
      setError(null);
    }
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);

    const entrada = {
      nombre: nombre.trim(),
      tipo,
      es_principal: principal,
      activo,
    };

    iniciar(async () => {
      const resultado = editando ? await actualizarListaPrecio(editando.id, entrada) : await crearListaPrecio(entrada);

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setAbierto(false);
      setEditando(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl tracking-tight">Listas de precios</h1>
          <p className="text-muted-foreground text-sm">
            Precio fijo o porcentaje sobre el precio del producto. La principal se sugiere en las ventas.
          </p>
        </div>
        {puedeEditar ? (
          <Button type="button" onClick={abrirNueva}>
            <Plus />
            Nueva lista
          </Button>
        ) : null}
      </div>

      <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Principal</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              {puedeEditar ? (
                <TableHead className="w-10">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {listas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={puedeEditar ? 5 : 4} className="text-muted-foreground py-10 text-center">
                  No hay listas de precios configuradas.
                </TableCell>
              </TableRow>
            ) : (
              listas.map((lista) => (
                <TableRow key={lista.id}>
                  <TableCell className="font-medium">{lista.nombre}</TableCell>
                  <TableCell>{lista.es_principal ? <Badge variant="default">Principal</Badge> : "—"}</TableCell>
                  <TableCell>{etiquetaTipoLista(lista.tipo)}</TableCell>
                  <TableCell>
                    <Badge variant={lista.activo ? "secondary" : "destructive"}>
                      {lista.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </TableCell>
                  {puedeEditar ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${lista.nombre}`}
                        onClick={() => abrirEditar(lista)}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={cambiarAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar lista de precios" : "Nueva lista de precios"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={enviar} className="flex flex-col gap-4">
            <FormField htmlFor="lista-nombre" label="Nombre" required>
              <Input
                id="lista-nombre"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                maxLength={120}
                required
                disabled={pendiente}
                className={FORM_INPUT}
              />
            </FormField>
            <FormField htmlFor="lista-tipo" label="Tipo" required>
              <Select
                value={tipo}
                onValueChange={(valor: string | null) => setTipo(valor === "porcentaje" ? "porcentaje" : "fijo")}
                items={OPCIONES_TIPO}
              >
                <SelectTrigger id="lista-tipo" className={FORM_SELECT}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPCIONES_TIPO.map((opcion) => (
                    <SelectItem key={opcion.value} value={opcion.value}>
                      {opcion.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <Label htmlFor="lista-principal">Principal</Label>
                {esPrincipal ? (
                  <span className="text-muted-foreground text-xs">Debe existir una lista principal.</span>
                ) : null}
              </div>
              <Switch
                id="lista-principal"
                checked={esPrincipal ? true : principal}
                onCheckedChange={setPrincipal}
                disabled={pendiente || esPrincipal}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="lista-activo">Activa</Label>
              <Switch id="lista-activo" checked={activo} onCheckedChange={setActivo} disabled={pendiente} />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={pendiente} className="h-11 rounded-[12px] px-6" />
                }
              >
                Cancelar
              </DialogClose>
              <Button type="submit" disabled={pendiente} className="h-11 rounded-[12px] px-6">
                {pendiente ? <Loader2 className="animate-spin" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
