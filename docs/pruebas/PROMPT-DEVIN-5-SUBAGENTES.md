Eres el coordinador. Termina las pruebas de carga de Medoxigas Contabilidad usando 5 subagentes en paralelo.

LEE PRIMERO, completos:
1. docs/pruebas/ESTADO-DEVIN.md (dónde quedó la sesión anterior y qué falta)
2. docs/pruebas/INSTRUCCIONES-PRUEBAS.md (reglas; todas siguen vigentes)
3. AGENTS.md

Ya estás en la rama test/pruebas-carga. No la vuelvas a crear. Lo hecho (carga 32k y C1–C7) NO se repite.

REGLAS QUE NO SE ROMPEN (pásalas a cada subagente):
- No borrar datos ni archivos. No usar la clave service_role. No mostrar claves ni contraseñas (están en .env.local y .env.pruebas; léelas solo desde el código).
- No cambiar la app (src/), ni migraciones, ni la base de datos. Solo tests/carga/ y docs/pruebas/.
- Puerto 3005 para la app de esta rama. NO uses ni cierres 3000 (Waldy), 3001 ni 3002 (diseño). No toques otras carpetas ni worktrees.
- Datos nuevos solo con marcador ZZTEST-. Si Supabase avisa de espacio lleno o cuota, paren todos y avisen.
- Nada de push, nada de --no-verify. No le hagas commit a .serena/.

SUBAGENTES (cada uno con su tarea, sin pisarse):
1. «Servidor y pantallas»: pnpm build, luego pnpm start -p 3005 (comprueba que responde y que es ESTA rama). Corre tests/carga/ui.ts contra http://localhost:3005 (5 repeticiones por pantalla). Guarda ui.json y ui-log.txt nuevos en docs/pruebas/resultados/ (reemplaza el ui-log inválido). Avisa al coordinador cuando termine. Solo este subagente levanta el servidor.
2. «C8 varios navegadores»: espera a que el 1 termine la medición y corre tests/carga/c8.ts (5 usuarios zztest a la vez, 3 minutos) contra http://localhost:3005. Guarda c8.json y c8-log.txt.
3. «Cuadre»: corre docs/pruebas/cuadre.sql (solo lectura) y guarda el resultado en docs/pruebas/linea-base-despues.md con una tabla antes/después contra linea-base-antes.md. Explica cada diferencia (por ejemplo, junio 2020 reabierto por C6, D6 inventario).
4. «Por qué tardan las listas»: SOLO LEER el código. Explica por qué facturas, compras, pagos recibidos y la primera apertura de una ficha tardan (consultas, falta de paginación o índices, N+1, cálculos en el cliente). Propón el arreglo de cada una con archivo y línea, sin cambiar nada. Guarda docs/pruebas/resultados/lentitud.md.
5. «Consultas sin paginar»: SOLO LEER. Busca en src/lib todas las lecturas a Supabase que pueden cortarse en 1,000 filas, como el 607 en src/lib/fiscales/consultas.ts (obtenerVentas). Haz una lista con archivo, línea, pantalla o reporte afectado y el arreglo propuesto. Guarda docs/pruebas/resultados/sin-paginar.md.

AL FINAL (tú, el coordinador):
- Cierra el servidor del puerto 3005 (solo ese).
- Escribe docs/pruebas/resultados/RESULTADOS.md en español simple para Waldy: qué se probó, qué pasó y qué falló, con números; los errores encontrados en orden de gravedad (el 607 primero), con el arreglo propuesto; y qué datos ZZTEST quedaron en la base (solo se borran con su OK). Agrega que junio 2020 quedó reabierto.
- pnpm typecheck en verde. Un commit en test/pruebas-carga con tests/carga/ y docs/pruebas/. Sin push.
- Responde con un resumen corto: qué pasó, qué falló y qué archivos quedaron.