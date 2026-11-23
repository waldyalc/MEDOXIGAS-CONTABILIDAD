# POS de Medoxigas — copia visual de Alegra

Esta carpeta guarda la **guía destilada** del punto de venta de Alegra y las medidas
que usa el POS de Medoxigas para verse igual. Nada de aquí es código de Alegra:
son tablas de medidas, la guía y el informe de comparación. **Las capturas de
Alegra no viven en el repo** (es público): se guardan en `/root/referencias/` del VPS.

## De dónde salió cada cosa

| Material | Origen | ¿Se commitea? |
| --- | --- | --- |
| Capturas de referencia de Alegra (1440×900 y 1024×600) | Captura local del SingleFile `vender/index.html` de la cuenta de prueba **Fiel Ferreteria** (copia local guardada fuera del repo), Chromium headless. | **No**: viven fuera del repo, en `/root/referencias/alegra-pos/diseno-pos/referencia/`. |
| `MEDIDAS.md` | Valores leídos de `styles.css` y del DOM renderizado de esa copia local a 1440×900 y 1024×600. | Sí. |
| `COMPARACION.md` | Comparación propia, pixel a pixel, de esa referencia contra el POS de Medoxigas. Las imágenes del análisis tampoco se commitean. | Sí (solo el texto). |
| `GUIA-POS.md` | Guía de implementación con Tailwind/shadcn y tokens `--pos-*`. | Sí. |
| Capturas del POS de Medoxigas (`docs/diseno/capturas/pos-alegra/antes/` y `despues/`) | POS propio antes del cambio (`4400174`) y después de los Puntos 1 y 3. Son capturas nuestras, no de Alegra. | Sí. |

Las capturas de Alegra (referencia, lado a lado, diferencias y recortes por
componente) se guardan **fuera del repo**, en `/root/referencias/alegra-pos/diseno-pos/`
del VPS. El candado `src/lib/sin-capturas-alegra.test.ts` falla si vuelve a entrar
una imagen de Alegra.

Los exports crudos de Alegra (`index.html`, `styles.css`, `original/` y los scripts
`.py`/`.js` de extracción) **no se commitean**: `AGENTS.md` los prohíbe en el repo
público. Solo se usaron localmente para medir y quedan resumidos en `MEDIDAS.md`.

## Reglas

- El POS copia el diseño de Alegra **exactamente**, con los tokens `--pos-*` de
  `src/app/globals.css` (teal `#00b19d`) y componentes del repo.
- No se copia código, HTML, CSS, selectores, textos largos ni logos de Alegra.
- Los iconos son los del proyecto (`@/components/icons`), aunque su forma no sea
  idéntica a la de Alegra: eso es parte de la diferencia residual del informe.
- La barra superior derecha de Alegra (**Disponible**, sincronizar, portapapeles,
  reloj, cuadrícula de apps y logo de la empresa) **no se copia**: Waldy no la
  quiere y la comparación la excluye.
- El turno vive en la barra inferior, a la derecha (Punto 1 del mega plan), no en
  la línea sobre el buscador como en la captura vieja de Alegra.

## Cómo se ve

- `docs/diseno/capturas/pos-alegra/despues/pos-1440x900-claro.png`
- `docs/diseno/capturas/pos-alegra/despues/pos-1024x600-claro.png`
- `docs/diseno/capturas/pos-alegra/despues/pos-1920x1080-claro.png` (5 columnas)
- `docs/diseno/capturas/pos-alegra/despues/pos-1440x900-oscuro.png`
- `docs/diseno/capturas/pos-alegra/despues/pos-estrecho-ver-factura-claro.png`
