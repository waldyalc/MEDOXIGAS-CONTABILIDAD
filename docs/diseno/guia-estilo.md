# Guía de estilo

(Se llena con lo que Waldy decida. Base actual: shadcn/ui + Studio Admin.)

- Colores:
- Letra:
- Tablas: `src/components/dashboardblocks/` (bloque `@dashboardblocks/data-table`, TanStack Table v9). Barra superior: `DataTableSearch` + `DataTableFacetFilter` (botón ⊕ con menú y conteos) + `DataTableReset` ("Limpiar") + `DataTableViewOptions` ("Columnas"). Checkbox por fila (`createDataTableSelectColumn`); la fila entera abre el detalle con `DataTableRowLink` + `LinkProvider`. Estado con `StatusLabel` (punto de color, sin borde pesado). Pie: `DataTablePagination` (12/24/48 por página). Todo dentro de la tarjeta `bg-card ring-foreground/10 rounded-xl ring-1`. Primera aplicada: Facturación; replicar en las demás listas.
- Botones:
- Formularios: