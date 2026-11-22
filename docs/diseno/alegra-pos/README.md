# POS de Medoxigas — copia visual de Alegra

Esta carpeta guarda la **guía destilada** del punto de venta de Alegra y las medidas
que usa el POS de Medoxigas para verse igual. Nada de aquí es código de Alegra:
son tablas de medidas, capturas de referencia y el informe de comparación.

## De dónde salió cada cosa

| Material | Origen | ¿Se commitea? |
| --- | --- | --- |
| `referencia/alegra-1440x900.png` | Captura local del SingleFile `vender/index.html` de la cuenta de prueba **Fiel Ferreteria** (copia local guardada fuera del repo), Chromium headless a 1440×900. | Sí (es una captura). |
| `referencia/alegra-1024x600.png` | La misma copia local a 1024×600. | Sí. |
| `MEDIDAS.md` | Valores leídos de `styles.css` y del DOM renderizado de esa copia local a 1440×900 y 1024×600. | Sí. |
| `COMPARACION.md` + `comparacion/` | Comparación propia, pixel a pixel, de esa referencia contra el POS de Medoxigas. | Sí. |
| `GUIA-POS.md` | Guía de implementación con Tailwind/shadcn y tokens `--pos-*`. | Sí. |
| `docs/diseno/capturas/pos-alegra/antes/` | POS de Medoxigas antes del cambio (`4400174`), mismo viewport. | Sí. |
| `docs/diseno/capturas/pos-alegra/despues/` | POS de Medoxigas con los Puntos 1 y 3. | Sí. |

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
