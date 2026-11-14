import { EsqueletoLista } from "@/components/carga/esqueletos";

export default function Loading() {
  return (
    <EsqueletoLista
      titulo="Contactos"
      descripcion="Administra tus clientes y proveedores."
      grande
      acciones={1}
      filtros={2}
      columnas={6}
    />
  );
}
