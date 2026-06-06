# DVW Resort Explorer

Aplicacion web estatica para explorar resorts de DreamVacationWeek de forma rapida, visual y sin backend.

## Demo en produccion

- GitHub Pages: [https://browfire.github.io/dream-vacation-week-resorts/](https://browfire.github.io/dream-vacation-week-resorts/)

## Objetivo del proyecto

El proyecto permite consultar un catalogo de resorts en una tabla interactiva para facilitar la busqueda de destinos por diferentes criterios de negocio y ubicacion.

Esta pensado para uso operativo y consulta diaria:

- Filtrar resultados por diferentes campos.
- Ordenar rapidamente por cualquier columna clave.
- Exportar la vista filtrada a CSV para compartir o analizar fuera de la aplicacion.

## Que puedes hacer en la app

1. Filtrar por:
   - Continente
   - Pais
   - Zona
   - Codigo exacto
   - Nombre (coincidencia parcial)
   - Ciudad/ubicacion (coincidencia parcial)
2. Ordenar por columnas:
   - Codigo
   - Nombre
   - Ubicacion
   - Zona
   - Pais
   - Continente
3. Limpiar todos los filtros con un solo clic.
4. Exportar en CSV solo los resultados visibles tras aplicar filtros y orden.

## Como funciona internamente

La aplicacion es 100% cliente (frontend):

- `index.html` define la estructura de la interfaz.
- `assets/css/styles.css` contiene estilos y layout.
- `assets/js/app.js` implementa:
  - carga de datos JSON via `fetch`
  - logica de filtros y ordenamiento
  - renderizado dinamico de la tabla
  - exportacion de resultados en CSV

En el inicio se cargan dos fuentes de datos:

- `data/resorts.json`: listado principal de resorts.
- `data/continents.json`: mapeo de pais a continente.

Con ese mapeo se agrega el continente a cada resort y se habilitan filtros dependientes (por ejemplo, paises por continente y zonas por contexto seleccionado).

## Estructura del repositorio

```text
.
  index.html
  LICENSE
  assets/
    css/styles.css
    js/app.js
  data/
    resorts.json
    continents.json
  README.md
```

## Ejecucion local

No abras la app con `file://` porque el navegador puede bloquear la lectura de JSON local.

Desde esta carpeta, levanta un servidor estatico:

```bash
python -m http.server 8000
```

Luego abre:

```text
http://localhost:8000/
```

## Despliegue en GitHub Pages

El proyecto es compatible con GitHub Pages porque usa rutas relativas (`./assets/...`, `./data/...`).

Configuracion usada:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`

## Licencia

Este proyecto esta licenciado bajo GNU General Public License v3.0 (GPL-3.0).

- Texto completo: [LICENSE](LICENSE)
- Referencia oficial: [https://www.gnu.org/licenses/gpl-3.0.html](https://www.gnu.org/licenses/gpl-3.0.html)
