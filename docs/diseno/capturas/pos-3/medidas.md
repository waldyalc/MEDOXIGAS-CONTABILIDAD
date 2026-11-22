# Medidas — modal «Pagar factura» (POS 2, Punto 3)

Comparación de la captura de Alegra `06-pagar-alegra.png` contra el modal de Medoxigas antes y después del Punto 3.

- **Escala de la captura de Alegra:** 1920×922 px físicos con zoom 125 %. Se comprobó con el panel de factura de `styles.css` (`width: 550px`): en la captura mide 686 px → factor **1.247**. Las medidas «Alegra» de la tabla ya están convertidas a px CSS (medida física ÷ 1.247).
- **Antes:** `antes-pago-credito.png`, modal a 720×656 CSS (1440×900, DPR 1).
- **Después:** capturas de `docs/diseno/capturas/pos-3/` (1440×900 y 390×844).
- **Medición del después:** `getBoundingClientRect` + `getComputedStyle` en Playwright sobre el modal abierto, no a ojo.

| Parte | Alegra (CSS medido) | Medoxigas antes | Medoxigas después | Diferencia |
|---|---|---|---|---|
| Ventana modal | 641 × 504 px; radio ≈16 px; fondo blanco | 720 × 656 px; radio 14 px | 640 × 512 px; radio 14 px | −1 px de ancho; +8 px de alto por el subtítulo «Caja · Turno» que Alegra no muestra |
| Título «Pagar factura» | 24 px / 600, `#0F172A` | 16 px / 500 | 24 px / 600, token `--pos-texto` (`#212529`) | Tamaño y peso iguales a Alegra; el color usa el token del POS |
| Etiqueta «TOTAL» | 12 px / 500, `#94A3B8`, mayúsculas | 12 px / 500, gris muted | 12 px / 500, `--pos-icono` (`#94A3B8`) | 0 |
| Monto total | 24 px / 600, `#334155` | 30 px / 600 | 24 px / 600, `--pos-texto` (`#212529`) | −6 px; se quitó el `text-3xl` |
| «Por cobrar» | 16 px, etiqueta `#64748B` y monto 16 px / 600 `#E11D48`, a 4 px del total | No existía: bloque «Queda a crédito» + aviso rojo + selector de cliente | Una sola línea de 16 px, monto `#E11D48`; 24 px de alto | Se eliminó el bloque viejo; el rojo es el exacto de Alegra |
| «Cambio» | Solo si sobra dinero, en rojo | Línea de 14 px solo en efectivo | 16 px, rojo `#E11D48`, solo si sobra | +2 px; mismo comportamiento |
| Labels («Valor del pago…») | 14 px, `#334155` | 14 px | 14 px | 0 |
| Input efectivo | 48 px de alto, radio 5 px, borde `#CBD5E1`, foco teal | 40 px, radio 8 px | 48 px, radio 5 px | +8 px de alto; radio de Alegra |
| Vendedor | 48 px de alto, label 14 px, placeholder «Seleccionar», mismo ancho que Observaciones | Selector ya existente dentro de `CamposCobro` (solo se dibuja si hay vendedores activos) | Igual: label «Vendedor», placeholder «Seleccionar», 48 px y mismo ancho que Observaciones | 0. **No aparece en las capturas porque la base no tiene vendedores activos** (verificado en Configuración → Vendedores: «¡Aún no tienes vendedores!»). No se crearon datos |
| Observaciones | 99 px de alto, radio 5 px | 64 px, radio 8 px | 100 px, radio 5 px | +36 px de alto; texto de ayuda igual |
| Footer | Sin banda gris: blanco, botones a la derecha | Fondo `muted/50` y borde superior | Sin fondo ni borde; `p-4` | Se quitó la banda; coincide con Alegra |
| Botón Cancelar | 40 px de alto, radio 8 px, outline | 32 px, radio 10 px | 40 px, radio 8 px | +8 px de alto; radio de Alegra |
| Botón Cobrar | 40 px de alto, radio 8 px, teal `#00B19D` | 44 px, azul `--primary`, **deshabilitado** con Consumidor Final y pago parcial | 40 px, radio 8 px, `--pos-primario` (`#00B19D`), siempre clicable para ese caso | −4 px de alto; se quitó el azul y el bloqueo por cliente |
| Toast de validación | 390 × 83 px; fondo `#FFE4E6`; radio 8 px; título 14 px / 600 `#0F172A`; texto 14 px; icono rojo; cierre; 22 px del borde superior/derecho | No existía | 390 × 85.5 px; fondo `#FFE4E6`; radio 8 px; título 14 px / 600; texto 14 px; `top-5 right-5`; `role="alert"` y botón de cerrar | +2.5 px de alto; cierra sin cerrar el modal y no dispara ninguna petición de venta |
| «Aplicado a la venta» / «Queda a crédito» / «Cliente para el crédito» | No existen | Tres bloques + aviso rojo «No se puede vender a crédito al Consumidor Final…» | Eliminados | Se reemplazaron por la línea «Por cobrar» y el toast |

## Notas de la verificación

- **Toast:** al pulsar «Cobrar» con Consumidor Final y pago parcial se registraron **0 peticiones POST nuevas**; el toast aparece y el modal sigue abierto. Al cerrarlo, el modal permanece. No se completó ninguna venta.
- **Combinado:** la terminal `ZZCAPTURA Caja 1` no tiene cuentas de tarjeta/transferencia activas, así que el método «Combinado» sale deshabilitado y no hay captura `despues-pago-combinado.png`. El resumen viejo (Total recibido / Por cobrar / Cambio) se quitó; si se configura una cuenta, queda solo la línea bajo el TOTAL y el detalle por fila.
- **Vendedor:** el código conserva el selector y su consulta a `vendedores`; no se inventaron datos ni se tocó la base. Con un vendedor activo aparece arriba de Observaciones, como en Alegra.
- **Turno:** al empezar las capturas el turno estaba abierto (Turno No 4); otro proceso lo cerró durante el trabajo. Para poder abrir el modal se abrió un turno con base 0 (operación normal del POS, sin venta) y se dejó abierto, como estaba al inicio.
