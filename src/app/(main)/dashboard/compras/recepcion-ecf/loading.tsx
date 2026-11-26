import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Recepción de comprobantes electrónicos"
      descripcion="Recibe automáticamente los e-CF emitidos por tus proveedores. Acéptalos o recházalos."
      acciones={0}
      columnas={8}
    />
  );
}
