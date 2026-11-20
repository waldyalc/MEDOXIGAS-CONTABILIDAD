# Decisiones de Waldy sobre el reporte de investigación (20 nov 2026)

Fuente: sesión del Orquestador tras comparar
[reporte-investigacion-alegra.md](./reporte-investigacion-alegra.md) contra el código.
Estas decisiones gobiernan las tareas F1/F2 de inventario y reportes DGII.

1. **Formato de los TXT: copiar Alegra literal.** Encabezado 606 de 4 campos
   (`606|RNC|AAAAMM|cantidad`), 607 sin "Total monto facturado"
   (`607|RNC|AAAAMM|cantidad`), `tipo de ingreso` a 1 dígito (`1`) y `tipo de
   anulación` a 1 dígito, tal como salen en la prueba real del 19–20 nov.
2. **Exportación: descarga directa, sin portal.** Modal de exportación
   (Periodo + Tipo de archivo) que al confirmar descarga el archivo en el
   momento. Sin ZIP, sin "Historial de exportables", sin lista de descargas.
   Si el tipo es Excel, un único `.xlsx` que se descarga automáticamente (con
   los "Documentos no incluidos" como hoja). La tabla en pantalla se mantiene
   para revisar.
3. **Mapeo motivo→código del 608: instructivo DGII oficial.** Devolución de
   productos = `06`. La prueba de Alegra exportó `7` para ese motivo
   (discrepancia observada); se documenta en la migración y la tabla queda
   editable por SQL para corregir el mapeo si la DGII real lo pide.
4. **Ajustes de inventario: solo Anular.** No se añade borrado real
   ("Eliminar" de Alegra). La anulación con asiento de reversa deja pista de
   auditoría y el efecto en cantidad/costo es idéntico (ambos → 596.15 en la
   prueba).
5. **El asiento de inventario inicial (`II`) se muta en el lugar** al editar
   cantidad/costo del producto, como hace Alegra (Prueba 2), en vez de crear
   reversiones. La auditoría vigila los UPDATE de asientos.
