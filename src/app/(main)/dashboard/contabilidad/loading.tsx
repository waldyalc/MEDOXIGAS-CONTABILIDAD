import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Catálogo de cuentas"
      descripcion="Cuentas contables y su saldo actual."
      acciones={2}
      filtros={1}
      columnas={5}
      filas={12}
    />
  );
}
