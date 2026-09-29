# Drink League 2026 — sitio de resultados

Sitio estático que lee tu liga de Sleeper en vivo (se actualiza solo cada 90 s durante la semana).

## Archivos
| Archivo | Qué es |
|---|---|
| `index.html`, `styles.css`, `app.js` | El sitio. No hace falta tocarlos. |
| `datos.js` | **Lo único que editas**: League ID, inscripciones pagadas y premios pagados. |
| `demo.js` | Datos falsos para previsualizar: abre `index.html?demo=1` (o `?demo=1&semana=99` para ver una temporada terminada). |
| `logo.png`, `favicon.png`, `apple-touch-icon.png` | Logo e íconos. |

## 1. Configurar
En `datos.js`, pega tu League ID (el número de `sleeper.com/leagues/XXXXXXXX`) en `leagueId`.

Para marcar pagos escribe la fecha entre comillas; si no ha pagado, deja `null`:
```js
inscripciones: {
  "usuario_sleeper": { ronda1: "2026-09-05", ronda2: null },
},
semanales: {
  1: "2026-09-16",                                   // semana normal
  2: { ganador: "2026-09-23", segundo: "2026-09-23" } // semana con Bad Beat ($800 / $200)
},
adicionales: { record: null, puntos: null, baba: null },
playoffs: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null },
```
La llave de inscripciones es el usuario de Sleeper (el @, sin la @). En el sitio aparece debajo del nombre de cada equipo.

## 2. Publicar (gratis)
**GitHub Pages (recomendado, se edita desde el celular):**
1. Crea un repositorio público en github.com y sube el contenido de esta carpeta.
2. Settings → Pages → Branch `main` / root → Save.
3. Comparte el link `https://TU_USUARIO.github.io/NOMBRE_REPO/` en el grupo.
4. Para marcar un pago: abre `datos.js` en github.com → ✏️ editar → Commit. El sitio se actualiza en ~1 minuto.

**Netlify Drop (lo más rápido):** arrastra la carpeta `sitio` a app.netlify.com/drop. Para actualizar pagos vuelves a arrastrarla.

## Cómo calcula cada cosa
- **Semana cerrada**: cuando Sleeper ya procesó los resultados (`last_scored_leg`). Antes de eso aparece "en vivo" o "por confirmar".
- **Premio semanal**: mayor puntaje de las semanas 1–14. Si el 1ro y el 2do se enfrentaron → Bad Beat $800 / $200. Si empatan exacto en el 1er lugar → $500 cada uno (el One Pager no cubre ese caso).
- **Carrera a Playoffs**: victorias y luego puntos a favor. "Clasificado" y "Eliminado" se marcan solo cuando ya es matemáticamente seguro.
- **Récord semanal**: puntaje individual más alto de la temporada regular.
- **Más puntos**: suma de puntos de la temporada regular.
- **Playoffs (1ro–6to) y Baba Bowl**: salen de los brackets de Sleeper (juegos por el 1ro, 3ro y 5to lugar; final del bracket de perdedores).
