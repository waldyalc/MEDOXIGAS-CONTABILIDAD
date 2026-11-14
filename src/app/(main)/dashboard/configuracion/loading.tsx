import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Configuración"
      descripcion="Empresa, facturación, impuestos y contabilidad."
      columnas={3}
      filas={6}
    />
  );
}
