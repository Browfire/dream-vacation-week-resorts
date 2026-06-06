const state = {
  source: null,
  rows: [],
  filtered: [],
  countries: [],
  continentGroups: {},
  continentByCountry: {},
  sort: {
    field: "pais",
    order: "asc"
  }
};

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
  resetFilters: document.getElementById("resetFilters"),
  exportCsv: document.getElementById("exportCsv"),
  resultsBody: document.getElementById("resultsBody"),
  rowTemplate: document.getElementById("rowTemplate"),
  sortHeaders: Array.from(document.querySelectorAll("th[data-sort-field]"))
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function decodeHtml(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(text || ""), "text/html");
  return doc.documentElement.textContent || "";
}

function fmtNumber(value) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function byCountry(country) {
  const key = normalize(country);
  return state.rows.filter((r) => normalize(r.pais) === key);
}

function byZone(zone) {
  const key = normalize(zone);
  return state.rows.filter((r) => normalize(r.zona) === key);
}

function byContinent(continent) {
  const key = normalize(continent);
  return state.rows.filter((r) => normalize(r.continente) === key);
}

function byName(name) {
  const key = normalize(name);
  return state.rows.filter((r) => normalize(r.nombre).includes(key));
}

function byCity(city) {
  const key = normalize(city);
  return state.rows.filter((r) => normalize(r.ubicacion).includes(key));
}

function byCode(code) {
  const key = normalize(code);
  return state.rows.filter((r) => normalize(r.codigo) === key);
}

function buildContinentIndex(groups) {
  const index = {};
  Object.entries(groups || {}).forEach(([continent, countriesInContinent]) => {
    (countriesInContinent || []).forEach((country) => {
      index[country] = continent;
    });
  });
  return index;
}

function continentForCountry(country) {
  return state.continentByCountry[country] || "Uncategorized";
}

function countries(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.pais] = (counts[r.pais] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

function zones(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.zona] = (counts[r.zona] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([zone, count]) => ({ zone, count }))
    .sort((a, b) => a.zone.localeCompare(b.zone));
}

function continents(rows = state.rows) {
  const counts = {};
  rows.forEach((r) => {
    counts[r.continente] = (counts[r.continente] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([continent, count]) => ({ continent, count }))
    .sort((a, b) => a.continent.localeCompare(b.continent));
}

function intersectMany(base, groups) {
  if (!groups.length) {
    return base;
  }

  let output = base;
  groups.forEach((group) => {
    const bucket = new Set(group);
    output = output.filter((item) => bucket.has(item));
  });
  return output;
}

function filterRows() {
  const continentTerm = normalize(ui.continentFilter.value);
  const countryTerm = normalize(ui.countryFilter.value);
  const zoneTerm = normalize(ui.zoneFilter.value);
  const codeTerm = normalize(ui.codeFilter.value);
  const nameTerm = normalize(ui.nameFilter.value);
  const cityTerm = normalize(ui.cityFilter.value);

  const subset = state.rows;

  const specific = [];
  if (continentTerm) {
    specific.push(byContinent(continentTerm));
  }
  if (countryTerm) {
    specific.push(byCountry(countryTerm));
  }
  if (zoneTerm) {
    specific.push(byZone(zoneTerm));
  }
  if (codeTerm) {
    specific.push(byCode(codeTerm));
  }
  if (nameTerm) {
    specific.push(byName(nameTerm));
  }
  if (cityTerm) {
    specific.push(byCity(cityTerm));
  }

  state.filtered = intersectMany(subset, specific);
}

function sortRows() {
  const field = state.sort.field;
  const direction = state.sort.order === "asc" ? 1 : -1;

  state.filtered.sort((a, b) => {
    const av = normalize(a[field]);
    const bv = normalize(b[field]);

    if (av < bv) {
      return -1 * direction;
    }

    if (av > bv) {
      return 1 * direction;
    }

    return 0;
  });
}

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

function setSort(field) {
  if (state.sort.field === field) {
    state.sort.order = state.sort.order === "asc" ? "desc" : "asc";
  } else {
    state.sort.field = field;
    state.sort.order = "asc";
  }
}

function renderTable() {
  ui.resultsBody.innerHTML = "";

  if (!state.filtered.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = '<td colspan="6" class="empty">No hay resultados con los filtros actuales.</td>';
    ui.resultsBody.appendChild(tr);
  } else {
    state.filtered.forEach((row) => {
      const node = ui.rowTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".code").textContent = row.codigo;
      node.querySelector(".name").textContent = decodeHtml(row.nombre);
      node.querySelector(".location").textContent = decodeHtml(row.ubicacion);
      node.querySelector(".zone").textContent = decodeHtml(row.zona);
      node.querySelector(".country").textContent = row.pais;
      node.querySelector(".continent").textContent = row.continente;
      ui.resultsBody.appendChild(node);
    });
  }

}

function toCsvCell(value) {
  const normalized = String(value || "").replace(/"/g, '""');
  return `"${normalized}"`;
}

function exportFilteredCsv() {
  if (!state.filtered.length) {
    return;
  }

  const header = ["codigo", "nombre", "ubicacion", "zona", "pais", "continente"];
  const lines = [header.join(",")];

  state.filtered.forEach((row) => {
    lines.push([
      toCsvCell(row.codigo),
      toCsvCell(decodeHtml(row.nombre)),
      toCsvCell(decodeHtml(row.ubicacion)),
      toCsvCell(decodeHtml(row.zona)),
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

function render() {
  filterRows();
  sortRows();
  renderSortHeaders();
  renderTable();
  ui.exportCsv.disabled = state.filtered.length === 0;
}

function resetFilters() {
  ui.continentFilter.value = "";
  ui.countryFilter.value = "";
  ui.zoneFilter.value = "";
  mountCountryFilter();
  mountZoneFilter();
  ui.codeFilter.value = "";
  ui.nameFilter.value = "";
  ui.cityFilter.value = "";
  state.sort.field = "nombre";
  state.sort.order = "asc";
}

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

function bindEvents() {
  [
    ui.continentFilter,
    ui.countryFilter,
    ui.zoneFilter,
    ui.codeFilter,
    ui.nameFilter,
    ui.cityFilter
  ].forEach((el) => {
    el.addEventListener("input", () => {
      if (el === ui.continentFilter) {
        mountCountryFilter();
        mountZoneFilter();
      }
      if (el === ui.countryFilter) {
        mountZoneFilter();
      }
      render();
    });
    el.addEventListener("change", () => {
      if (el === ui.continentFilter) {
        mountCountryFilter();
        mountZoneFilter();
      }
      if (el === ui.countryFilter) {
        mountZoneFilter();
      }
      render();
    });
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

  ui.resetFilters.addEventListener("click", () => {
    resetFilters();
    render();
  });
}

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
    ? payload.resorts.map((row) => ({
      ...row,
      continente: continentForCountry(row.pais)
    }))
    : [];
  state.filtered = [...state.rows];
  state.countries = countries();

  const unmapped = [...new Set(state.rows.filter((r) => r.continente === "Uncategorized").map((r) => r.pais))];
  if (unmapped.length) {
    console.warn("Países sin continente mapeado:", unmapped);
  }
}

async function bootstrap() {
  try {
    await loadData();
    mountContinentFilter();
    mountCountryFilter();
    mountZoneFilter();
    bindEvents();
    render();
  } catch (err) {
    ui.resultsBody.innerHTML = `<tr><td colspan="6" class="empty">Error: ${err.message}</td></tr>`;
  }
}

bootstrap();
