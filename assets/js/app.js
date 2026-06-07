// Runtime state for loaded data, active sorting and local marked selections.
const state = {
  source: null,
  rows: [],
  filtered: [],
  marked: new Set(),
  countries: [],
  continentGroups: {},
  continentByCountry: {},
  sort: {
    field: "pais",
    order: "asc"
  }
};

const MARKED_STORAGE_KEY = "dvw.markedResorts.v1";
const TABLE_COLUMNS = 7;
const HTML_PARSER = new DOMParser();

const CONTINENT_ORDER = [
  "North America",
  "Europe",
  "Caribbean",
  "South America",
  "Central America",
  "Asia",
  "Africa",
  "Oceania",
  "Uncategorized"
];

const ui = {
  continentFilter: document.getElementById("continentFilter"),
  countryFilter: document.getElementById("countryFilter"),
  zoneFilter: document.getElementById("zoneFilter"),
  codeFilter: document.getElementById("codeFilter"),
  nameFilter: document.getElementById("nameFilter"),
  cityFilter: document.getElementById("cityFilter"),
  markedOnlyFilter: document.getElementById("markedOnlyFilter"),
  resetFilters: document.getElementById("resetFilters"),
  exportCsv: document.getElementById("exportCsv"),
  tableWrap: document.querySelector(".table-wrap"),
  resultsBody: document.getElementById("resultsBody"),
  rowTemplate: document.getElementById("rowTemplate"),
  sortHeaders: Array.from(document.querySelectorAll("th[data-sort-field]"))
};

// Normalize text values for case-insensitive matching.
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// Decode HTML entities from source strings.
function decodeHtml(text) {
  const doc = HTML_PARSER.parseFromString(String(text || ""), "text/html");
  return doc.documentElement.textContent || "";
}

// Format counts for labels using Spanish locale.
function fmtNumber(value) {
  return new Intl.NumberFormat("es-ES").format(value);
}

/**
 * Build an internal row model with derived fields for fast render/filter/sort.
 */
function normalizeRow(row) {
  const nombreDecoded = decodeHtml(row.nombre);
  const ubicacionDecoded = decodeHtml(row.ubicacion);
  const zonaDecoded = decodeHtml(row.zona);
  const continente = continentForCountry(row.pais);

  return {
    ...row,
    continente,
    nombreDecoded,
    ubicacionDecoded,
    zonaDecoded,
    _norm: {
      codigo: normalize(row.codigo),
      pais: normalize(row.pais),
      continente: normalize(continente),
      zona: normalize(zonaDecoded),
      nombre: normalize(nombreDecoded),
      ubicacion: normalize(ubicacionDecoded)
    },
    _key: [normalize(row.codigo), normalize(row.pais), normalize(nombreDecoded)].join("|")
  };
}

// Return a stable key for local persistence of marked rows.
function resortKey(row) {
  if (row._key) {
    return row._key;
  }
  return [normalize(row.codigo), normalize(row.pais), normalize(decodeHtml(row.nombre))].join("|");
}

// Load marked rows from local storage.
function loadMarked() {
  try {
    const raw = localStorage.getItem(MARKED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.map((item) => String(item)));
  } catch (err) {
    console.warn("No se pudo leer el almacenamiento local de marcados:", err);
    return new Set();
  }
}

// Persist marked rows to local storage.
function persistMarked() {
  try {
    localStorage.setItem(MARKED_STORAGE_KEY, JSON.stringify([...state.marked]));
  } catch (err) {
    console.warn("No se pudo guardar el almacenamiento local de marcados:", err);
  }
}

// Check whether a given row is marked.
function isMarked(row) {
  return state.marked.has(resortKey(row));
}

// Toggle mark state for a row key and persist changes.
function toggleMarkedByKey(key) {
  if (state.marked.has(key)) {
    state.marked.delete(key);
  } else {
    state.marked.add(key);
  }
  persistMarked();
}

// Remove orphan marks that no longer exist in current dataset.
function syncMarkedWithRows() {
  const availableKeys = new Set(state.rows.map((row) => resortKey(row)));
  state.marked = new Set([...state.marked].filter((key) => availableKeys.has(key)));
  persistMarked();
}

/**
 * Render results with a subtle transition for smoother perceived updates.
 */
function renderWithTransition() {
  if (!ui.tableWrap) {
    render();
    return;
  }

  ui.tableWrap.classList.add("is-updating");
  requestAnimationFrame(() => {
    render();
    requestAnimationFrame(() => {
      ui.tableWrap.classList.remove("is-updating");
    });
  });
}

// Build country-to-continent lookup from grouped source data.
function buildContinentIndex(groups) {
  const index = {};
  Object.entries(groups || {}).forEach(([continent, countriesInContinent]) => {
    (countriesInContinent || []).forEach((country) => {
      index[country] = continent;
    });
  });
  return index;
}

// Resolve continent for country with fallback category.
function continentForCountry(country) {
  return state.continentByCountry[country] || "Uncategorized";
}

// Aggregate countries and their row counts.
function countries(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.pais] = (counts[r.pais] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

// Aggregate zones and their row counts.
function zones(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.zonaDecoded] = (counts[r.zonaDecoded] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => a.zone.localeCompare(b.zone));
}

// Aggregate continents and their row counts.
function continents(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.continente] = (counts[r.continente] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([continent, count]) => ({ continent, count }))
    .sort((a, b) => a.continent.localeCompare(b.continent));
}

// Read all current UI filters into a normalized object.
function buildActiveFilters() {
  return {
    continent: normalize(ui.continentFilter.value),
    country: normalize(ui.countryFilter.value),
    zone: normalize(ui.zoneFilter.value),
    code: normalize(ui.codeFilter.value),
    name: normalize(ui.nameFilter.value),
    city: normalize(ui.cityFilter.value),
    onlyMarked: ui.markedOnlyFilter.checked
  };
}

// Evaluate all active filters in one pass to avoid repeated full-array scans.
function matchesFilters(row, filters) {
  if (filters.continent && row._norm.continente !== filters.continent) {
    return false;
  }
  if (filters.country && row._norm.pais !== filters.country) {
    return false;
  }
  if (filters.zone && row._norm.zona !== filters.zone) {
    return false;
  }
  if (filters.code && row._norm.codigo !== filters.code) {
    return false;
  }
  if (filters.name && !row._norm.nombre.includes(filters.name)) {
    return false;
  }
  if (filters.city && !row._norm.ubicacion.includes(filters.city)) {
    return false;
  }
  if (filters.onlyMarked && !state.marked.has(resortKey(row))) {
    return false;
  }

  return true;
}

/**
 * Build the filtered subset by applying all active filters in one pass.
 */
function filterRows() {
  const activeFilters = buildActiveFilters();
  state.filtered = state.rows.filter((row) => matchesFilters(row, activeFilters));
}

// Keep mark button attributes and text in sync with mark state.
function updateMarkButtonState(button, marked) {
  button.setAttribute("aria-pressed", String(marked));
  button.setAttribute("aria-label", marked ? "Quitar marca" : "Marcar resort");
  button.title = marked ? "Quitar marca" : "Marcar resort";
  button.textContent = marked ? "★" : "☆";
}

/**
 * Sort the filtered rows using current sort field and direction.
 */
function sortRows() {
  const field = state.sort.field;
  const direction = state.sort.order === "asc" ? 1 : -1;

  state.filtered.sort((a, b) => {
    const av = a._norm[field] || normalize(a[field]);
    const bv = b._norm[field] || normalize(b[field]);

    if (av < bv) {
      return -1 * direction;
    }

    if (av > bv) {
      return 1 * direction;
    }

    return 0;
  });
}

// Reflect current sort state in column header accessibility attributes.
function renderSortHeaders() {
  ui.sortHeaders.forEach((th) => {
    const field = th.getAttribute("data-sort-field");
    const trigger = th.querySelector(".sort-trigger");
    const isActive = field === state.sort.field;
    th.setAttribute("aria-sort", isActive ? (state.sort.order === "asc" ? "ascending" : "descending") : "none");
    th.classList.toggle("is-active", isActive);
    if (!trigger) {
      return;
    }
    const suffix = isActive ? (state.sort.order === "asc" ? " (A-Z)" : " (Z-A)") : "";
    trigger.setAttribute("aria-label", `Ordenar por ${trigger.textContent}${suffix}`);
  });
}

// Toggle sorting rules when a sortable header is clicked.
function setSort(field) {
  if (state.sort.field === field) {
    state.sort.order = state.sort.order === "asc" ? "desc" : "asc";
  } else {
    state.sort.field = field;
    state.sort.order = "asc";
  }
}

/**
 * Render table rows based on current filtered and sorted state.
 */
function renderTable() {
  ui.resultsBody.innerHTML = "";

  if (!state.filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="${TABLE_COLUMNS}" class="empty">No hay resultados con los filtros actuales.</td>`;
    ui.resultsBody.appendChild(tr);
  } else {
    state.filtered.forEach((row) => {
      const node = ui.rowTemplate.content.firstElementChild.cloneNode(true);
      const key = resortKey(row);
      const markButton = node.querySelector(".mark-toggle");
      const marked = isMarked(row);

      if (markButton) {
        markButton.dataset.rowKey = key;
        updateMarkButtonState(markButton, marked);
      }

      node.querySelector(".code").textContent = row.codigo;
      node.querySelector(".name").textContent = row.nombreDecoded;
      node.querySelector(".location").textContent = row.ubicacionDecoded;
      node.querySelector(".zone").textContent = row.zonaDecoded;
      node.querySelector(".country").textContent = row.pais;
      node.querySelector(".continent").textContent = row.continente;
      ui.resultsBody.appendChild(node);
    });
  }

}

// Escape and quote a value for CSV output.
function toCsvCell(value) {
  const normalized = String(value || "").replace(/"/g, '""');
  return `"${normalized}"`;
}

/**
 * Export current filtered view as a CSV file.
 */
function exportFilteredCsv() {
  if (!state.filtered.length) {
    return;
  }

  const header = ["codigo", "nombre", "ubicacion", "zona", "pais", "continente"];
  const lines = [header.join(",")];

  state.filtered.forEach((row) => {
    lines.push([
      toCsvCell(row.codigo),
      toCsvCell(row.nombreDecoded),
      toCsvCell(row.ubicacionDecoded),
      toCsvCell(row.zonaDecoded),
      toCsvCell(row.pais),
      toCsvCell(row.continente)
    ].join(","));
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const ts = new Date().toISOString().replace(/[\W]/g, "").slice(0, 14);
  const link = document.createElement("a");
  link.href = url;
  link.download = `resorts_filtrados_${ts}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Run the full render pipeline and update action states.
 */
function render() {
  // Keep render deterministic: filter, sort, then paint.
  filterRows();
  sortRows();
  renderSortHeaders();
  renderTable();
  ui.exportCsv.disabled = state.filtered.length === 0;
}

/**
 * Reset all filters and restore default sorting.
 */
function resetFilters() {
  ui.continentFilter.value = "";
  ui.countryFilter.value = "";
  ui.zoneFilter.value = "";
  mountCountryFilter();
  mountZoneFilter();
  ui.codeFilter.value = "";
  ui.nameFilter.value = "";
  ui.cityFilter.value = "";
  ui.markedOnlyFilter.checked = false;
  state.sort.field = "nombre";
  state.sort.order = "asc";
}

/**
 * Populate continent filter options with aggregated counts.
 */
function mountContinentFilter() {
  ui.continentFilter.innerHTML = '<option value="">Todos</option>';
  const data = continents();

  CONTINENT_ORDER.forEach((continent) => {
    const entry = data.find((x) => x.continent === continent);
    if (!entry) {
      return;
    }

    const opt = document.createElement("option");
    opt.value = entry.continent;
    opt.textContent = `${entry.continent} (${fmtNumber(entry.count)})`;
    ui.continentFilter.appendChild(opt);
  });
}

/**
 * Populate country filter options, grouped by continent when no continent is selected.
 */
function mountCountryFilter() {
  const selectedContinent = ui.continentFilter.value;
  const previousCountry = ui.countryFilter.value;
  ui.countryFilter.innerHTML = '<option value="">Todos</option>';

  if (selectedContinent) {
    state.countries
      .filter((entry) => continentForCountry(entry.country) === selectedContinent)
      .sort((a, b) => a.country.localeCompare(b.country))
      .forEach((entry) => {
        const opt = document.createElement("option");
        opt.value = entry.country;
        opt.textContent = `${entry.country} (${fmtNumber(entry.count)})`;
        ui.countryFilter.appendChild(opt);
      });
  } else {
    const grouped = {};

    state.countries.forEach((entry) => {
      const continent = continentForCountry(entry.country);
      if (!grouped[continent]) {
        grouped[continent] = [];
      }
      grouped[continent].push(entry);
    });

    CONTINENT_ORDER.forEach((continent) => {
      const items = grouped[continent] || [];
      if (!items.length) {
        return;
      }

      const optGroup = document.createElement("optgroup");
      optGroup.label = continent;
      items
        .sort((a, b) => a.country.localeCompare(b.country))
        .forEach((entry) => {
          const opt = document.createElement("option");
          opt.value = entry.country;
          opt.textContent = `${entry.country} (${fmtNumber(entry.count)})`;
          optGroup.appendChild(opt);
        });

      ui.countryFilter.appendChild(optGroup);
    });
  }

  const countryStillAvailable = Array.from(ui.countryFilter.options).some((opt) => opt.value === previousCountry);
  ui.countryFilter.value = countryStillAvailable ? previousCountry : "";
}

/**
 * Populate zone filter options based on selected continent/country scope.
 */
function mountZoneFilter() {
  const previousZone = ui.zoneFilter.value;
  const selectedContinent = ui.continentFilter.value;
  const selectedCountry = ui.countryFilter.value;

  let scopedRows = state.rows;
  if (selectedContinent) {
    scopedRows = scopedRows.filter((r) => r.continente === selectedContinent);
  }
  if (selectedCountry) {
    scopedRows = scopedRows.filter((r) => r.pais === selectedCountry);
  }

  const availableZones = zones(scopedRows);
  ui.zoneFilter.innerHTML = '<option value="">Todas</option>';

  availableZones.forEach((entry) => {
    const opt = document.createElement("option");
    opt.value = entry.zone;
    opt.textContent = `${entry.zone} (${fmtNumber(entry.count)})`;
    ui.zoneFilter.appendChild(opt);
  });

  const zoneStillAvailable = Array.from(ui.zoneFilter.options).some((opt) => opt.value === previousZone);
  ui.zoneFilter.value = zoneStillAvailable ? previousZone : "";
}

/**
 * Attach UI event handlers for filters, sorting, marking and export actions.
 */
function bindEvents() {
  const onContinentChange = () => {
    mountCountryFilter();
    mountZoneFilter();
    render();
  };

  const onCountryChange = () => {
    mountZoneFilter();
    render();
  };

  const onDirectFilterChange = () => {
    render();
  };

  ui.continentFilter.addEventListener("change", onContinentChange);
  ui.countryFilter.addEventListener("change", onCountryChange);
  ui.zoneFilter.addEventListener("change", onDirectFilterChange);
  ui.codeFilter.addEventListener("input", onDirectFilterChange);
  ui.nameFilter.addEventListener("input", onDirectFilterChange);
  ui.cityFilter.addEventListener("input", onDirectFilterChange);

  ui.markedOnlyFilter.addEventListener("change", () => {
    renderWithTransition();
  });

  ui.sortHeaders.forEach((th) => {
    const field = th.getAttribute("data-sort-field");
    const trigger = th.querySelector(".sort-trigger");
    if (!field || !trigger) {
      return;
    }

    trigger.addEventListener("click", () => {
      setSort(field);
      render();
    });
  });

  ui.exportCsv.addEventListener("click", () => {
    exportFilteredCsv();
  });

  ui.resultsBody.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest("button.mark-toggle");
    if (!button) {
      return;
    }

    const key = button.dataset.rowKey;
    if (!key) {
      return;
    }

    toggleMarkedByKey(key);
    updateMarkButtonState(button, state.marked.has(key));

    if (ui.markedOnlyFilter.checked) {
      render();
    }
  });

  ui.resetFilters.addEventListener("click", () => {
    resetFilters();
    render();
  });
}

/**
 * Load remote datasets, normalize rows and initialize runtime state.
 */
async function loadData() {
  const [resortsResponse, continentsResponse] = await Promise.all([
    fetch("./data/resorts.json", { cache: "no-store" }),
    fetch("./data/continents.json", { cache: "no-store" })
  ]);

  if (!resortsResponse.ok) {
    throw new Error(`No se pudo cargar resorts.json (HTTP ${resortsResponse.status})`);
  }

  if (!continentsResponse.ok) {
    throw new Error(`No se pudo cargar continents.json (HTTP ${continentsResponse.status})`);
  }

  const [payload, continents] = await Promise.all([
    resortsResponse.json(),
    continentsResponse.json()
  ]);

  state.source = payload;
  state.continentGroups = continents;
  state.continentByCountry = buildContinentIndex(continents);
  state.rows = Array.isArray(payload.resorts)
    ? payload.resorts.map((row) => normalizeRow(row))
    : [];
  state.filtered = [...state.rows];
  state.countries = countries();
  state.marked = loadMarked();
  syncMarkedWithRows();

  const unmapped = [...new Set(state.rows.filter((r) => r.continente === "Uncategorized").map((r) => r.pais))];
  if (unmapped.length) {
    console.warn("Países sin continente mapeado:", unmapped);
  }
}

/**
 * App entrypoint: load data, mount controls, bind events and render.
 */
async function bootstrap() {
  try {
    await loadData();
    mountContinentFilter();
    mountCountryFilter();
    mountZoneFilter();
    bindEvents();
    render();
  } catch (err) {
    ui.resultsBody.innerHTML = `<tr><td colspan="${TABLE_COLUMNS}" class="empty">Error: ${err.message}</td></tr>`;
  }
}

bootstrap();
