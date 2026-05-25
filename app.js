const state = {
  summary: null,
  cases: [],
  files: [],
  findings: [],
  sources: [],
  collections: [],
  officialRecords: [],
  methods: [],
  sightingSummary: null,
  sightings: [],
  mapSightings: [],
  timeline: { historical: [], cases: [] },
  graph: { nodes: [], edges: [] },
  selectedCaseId: null,
  selectedCase: null,
  activeView: "cases",
  search: "",
  category: "",
  agency: "",
  kind: "",
  graphFocus: null
};

const els = {
  snapshotStatus: document.querySelector("#snapshotStatus"),
  statsGrid: document.querySelector("#statsGrid"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  agencyFilter: document.querySelector("#agencyFilter"),
  kindFilter: document.querySelector("#kindFilter"),
  caseList: document.querySelector("#caseList"),
  fileTable: document.querySelector("#fileTable"),
  findingsPanel: document.querySelector("#findingsPanel"),
  collectionsPanel: document.querySelector("#collectionsPanel"),
  recordsPanel: document.querySelector("#recordsPanel"),
  sightingsPanel: document.querySelector("#sightingsPanel"),
  mapPanel: document.querySelector("#mapPanel"),
  sightingMapCanvas: document.querySelector("#sightingMapCanvas"),
  mapShapeFilter: document.querySelector("#mapShapeFilter"),
  mapYearMin: document.querySelector("#mapYearMin"),
  mapYearMax: document.querySelector("#mapYearMax"),
  mapCaption: document.querySelector("#mapCaption"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  timelinePanel: document.querySelector("#timelinePanel"),
  sourceList: document.querySelector("#sourceList"),
  networkCanvas: document.querySelector("#networkCanvas"),
  resetGraph: document.querySelector("#resetGraph")
};

const colors = {
  text: "#eef4f3",
  muted: "#9fb0ad",
  line: "#2d3a42",
  cyan: "#6ed4d8",
  amber: "#e0b45b",
  green: "#7cc891",
  red: "#d97a6c",
  blue: "#82a6df"
};

let staticMode = false;
let staticData = null;
let fullStaticSightingsLoaded = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function clampText(value, max = 190) {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function params(payload) {
  const url = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) url.set(key, value);
  });
  return url.toString();
}

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
}

function parseMaybeJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function countBy(items, key) {
  const counts = new Map();
  items.forEach((item) => {
    const label = item[key] || "Unknown";
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label)));
}

function normalizeStaticRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    topics: parseMaybeJson(row.topics, []),
    tags: parseMaybeJson(row.tags, []),
    details_json: parseMaybeJson(row.details_json, {})
  }));
}

function transformStaticData(data) {
  const cases = normalizeStaticRows(data.cases).map((item) => ({
    ...item,
    file_total: data.files.filter((file) => file.case_id === item.id).length
  }));
  const files = normalizeStaticRows(data.files).map((file) => ({
    ...file,
    case_title: cases.find((item) => item.id === file.case_id)?.title || "",
    case_category: cases.find((item) => item.id === file.case_id)?.category || "",
    case_date: cases.find((item) => item.id === file.case_id)?.timeline_date || ""
  }));
  const collections = normalizeStaticRows(data.source_collections);
  const officialRecords = normalizeStaticRows(data.official_records);
  const summary = {
    cases: data.summary.cases,
    files: data.summary.files,
    findings: data.findings.length,
    cross_refs: data.cross_refs.length,
    sources: data.sources.length,
    collections: data.summary.source_collections || collections.length,
    official_records: data.summary.official_records || officialRecords.length,
    public_sightings: data.summary.public_sightings || data.public_sighting_summary?.total || 0,
    osint_methods: data.osint_methods?.length || 0,
    byAgency: (data.summary.agencies || []).map((row) => ({ label: row.agency, value: row.count })),
    byKind: countBy(files, "file_kind"),
    byCategory: countBy(cases, "category"),
    byRelease: (data.summary.releases || []).map((row) => ({ label: row.release_label, value: row.count })),
    byCollectionType: countBy(collections, "source_type"),
    byReliability: countBy(collections, "reliability"),
    byOfficialRecordType: countBy(officialRecords, "record_type"),
    sightingShapes: data.public_sighting_summary?.by_shape || [],
    sightingCountries: data.public_sighting_summary?.by_country || [],
    yearSpread: countBy(cases.map((item) => ({ year: String(item.timeline_date || "").match(/\b(?:19|20)\d{2}\b/)?.[0] || "" })).filter((item) => item.year), "year")
  };
  const nodes = cases.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    timeline_date: item.timeline_date,
    thumbnail_url: item.thumbnail_url,
    file_total: item.file_total
  }));
  const graph = { nodes, edges: (data.cross_refs || []).slice(0, 220) };
  const timeline = { historical: data.historical_references || [], cases };
  const sightingSummary = {
    total: data.public_sighting_summary?.total || 0,
    byShape: data.public_sighting_summary?.by_shape || [],
    byCountry: data.public_sighting_summary?.by_country || [],
    byYear: data.public_sighting_summary?.by_year || []
  };
  return {
    summary,
    cases,
    files,
    findings: data.findings || [],
    sources: data.sources || [],
    collections,
    officialRecords,
    methods: data.osint_methods || [],
    sightingSummary,
    sightings: data.public_sighting_samples || [],
    timeline,
    graph
  };
}

async function loadBaseData() {
  try {
    const [summary, cases, files, findings, sources, collections, officialRecords, methods, sightingSummary, sightings, timeline, graph] = await Promise.all([
      getJson("/api/summary"),
      getJson("/api/cases?limit=120"),
      getJson("/api/files?limit=240"),
      getJson("/api/findings"),
      getJson("/api/sources"),
      getJson("/api/collections?limit=260"),
      getJson("/api/official-records?limit=260"),
      getJson("/api/osint-methods"),
      getJson("/api/sightings/summary"),
      getJson("/api/sightings?limit=80"),
      getJson("/api/timeline"),
      getJson("/api/graph")
    ]);
    Object.assign(state, { summary, cases, files, findings, sources, collections, officialRecords, methods, sightingSummary, sightings, timeline, graph });
  } catch (error) {
    staticMode = true;
    staticData = await getJson("data/uap_findings.json");
    Object.assign(state, transformStaticData(staticData));
  }
  state.selectedCaseId = state.cases[0]?.id || null;
  await selectCase(state.selectedCaseId, false);
  renderAll();
}

function stat(label, value, tone = "") {
  return `<div class="stat ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function renderStats() {
  const s = state.summary;
  els.statsGrid.innerHTML = [
    stat("Case groups", s.cases),
    stat("File records", s.files),
    stat("Videos", s.byKind.find((x) => /video/i.test(x.label))?.value || 0),
    stat("PDFs", s.byKind.find((x) => /pdf/i.test(x.label))?.value || 0),
    stat("Collections", s.collections),
    stat("Official records", s.official_records || 0),
    stat("Public sightings", s.public_sightings),
    stat("Cross refs", s.cross_refs)
  ].join("");
  els.snapshotStatus.textContent = `${s.cases} case groups, ${s.files} files, ${s.collections} collections, ${s.official_records || 0} official records, ${s.public_sightings} public sightings`;
}

function fillSelect(select, rows, allLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${allLabel}</option>` + rows
    .filter((row) => row.label)
    .map((row) => `<option value="${escapeHtml(row.label)}">${escapeHtml(row.label)} (${row.value})</option>`)
    .join("");
  select.value = current;
}

function renderFilters() {
  fillSelect(els.categoryFilter, state.summary.byCategory, "All categories");
  fillSelect(els.agencyFilter, state.summary.byAgency, "All agencies");
  fillSelect(els.kindFilter, state.summary.byKind, "All types");
  fillSelect(els.mapShapeFilter, state.summary.sightingShapes || [], "All reported shapes");
}

function visibleCases() {
  const q = state.search.toLowerCase();
  return state.cases.filter((item) => {
    const matchesQ = !q || [item.title, item.summary, item.category, item.timeline_date, JSON.stringify(item.topics)]
      .join(" ")
      .toLowerCase()
      .includes(q);
    const matchesCategory = !state.category || item.category === state.category;
    return matchesQ && matchesCategory;
  });
}

function visibleFiles() {
  const q = state.search.toLowerCase();
  return state.files.filter((item) => {
    const matchesQ = !q || [item.title, item.description, item.case_title, item.incident_location, item.agency]
      .join(" ")
      .toLowerCase()
      .includes(q);
    const matchesAgency = !state.agency || item.agency === state.agency;
    const matchesKind = !state.kind || item.file_kind === state.kind;
    return matchesQ && matchesAgency && matchesKind;
  });
}

function caseCard(item) {
  const active = item.id === state.selectedCaseId ? "active" : "";
  const topics = Array.isArray(item.topics) ? item.topics.slice(0, 2) : [];
  return `
    <button class="case-card ${active}" type="button" data-case-id="${escapeHtml(item.id)}">
      <div class="case-thumb">${item.thumbnail_url ? `<img src="${escapeHtml(item.thumbnail_url)}" alt="">` : ""}</div>
      <div class="case-card-body">
        <div class="case-meta">
          <span class="chip cyan">${escapeHtml(item.category || "Case")}</span>
          <span class="chip amber">${escapeHtml(item.timeline_date || "No date")}</span>
          <span class="chip">${escapeHtml(item.file_total || item.file_count || 0)} files</span>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(clampText(item.summary, 160))}</p>
        <div class="case-meta">${topics.map((topic) => `<span class="chip">${escapeHtml(topic)}</span>`).join("")}</div>
      </div>
    </button>
  `;
}

function renderCases() {
  const items = visibleCases();
  els.caseList.innerHTML = items.length
    ? items.map(caseCard).join("")
    : `<div class="empty-state"><h2>No matching cases</h2><p>Try a broader search or clear the category filter.</p></div>`;
  els.caseList.querySelectorAll("[data-case-id]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.caseId));
  });
}

function fileRow(item) {
  return `
    <button class="file-row" type="button" data-file-case="${escapeHtml(item.case_id)}">
      <div>
        <span class="field-label">Asset</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(clampText(item.description || item.case_title, 120))}</p>
      </div>
      <div>
        <span class="field-label">Agency</span>
        <p>${escapeHtml(item.agency || "Unknown")}</p>
      </div>
      <div>
        <span class="field-label">Type</span>
        <p>${escapeHtml(item.file_kind || "File")}</p>
      </div>
      <div>
        <span class="field-label">Case</span>
        <p>${escapeHtml(item.case_title)}</p>
      </div>
    </button>
  `;
}

function renderFiles() {
  const items = visibleFiles();
  els.fileTable.innerHTML = items.length
    ? items.map(fileRow).join("")
    : `<div class="empty-state"><h2>No matching files</h2><p>Try clearing agency or file type filters.</p></div>`;
  els.fileTable.querySelectorAll("[data-file-case]").forEach((row) => {
    row.addEventListener("click", () => selectCase(row.dataset.fileCase));
  });
}

function renderFindings() {
  els.findingsPanel.innerHTML = state.findings.map((item) => `
    <article class="finding">
      <div class="case-meta">
        <span class="chip cyan">${escapeHtml(item.finding_type)}</span>
        <span class="chip amber">${escapeHtml(item.confidence)} confidence</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `).join("");
}

function renderCollections() {
  const q = state.search.toLowerCase();
  const items = state.collections.filter((item) => {
    return !q || [item.title, item.source_name, item.source_type, item.reliability, item.summary, JSON.stringify(item.tags)]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  els.collectionsPanel.innerHTML = `
    <div class="collection-grid">
      ${items.map((item) => `
        <article class="collection-item">
          <div class="case-meta">
            <span class="chip cyan">${escapeHtml(item.reliability || "source")}</span>
            <span class="chip">${escapeHtml(item.source_name || "collection")}</span>
            <span class="chip amber">${escapeHtml(item.source_type || "record")}</span>
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(clampText(item.summary, 210))}</p>
          <div class="case-meta">
            ${item.row_count ? `<span class="chip">${escapeHtml(item.row_count)} rows</span>` : ""}
            ${item.file_size ? `<span class="chip">${escapeHtml(item.file_size)}</span>` : ""}
            <a class="chip amber" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open</a>
            ${item.metadata_url ? `<a class="chip" href="${escapeHtml(item.metadata_url)}" target="_blank" rel="noreferrer">Metadata</a>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderOfficialRecords() {
  const q = state.search.toLowerCase();
  const items = state.officialRecords.filter((item) => {
    return !q || [item.title, item.creator, item.record_type, item.summary, item.subjects, item.media_types]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  els.recordsPanel.innerHTML = `
    <div class="record-grid">
      ${items.map((item) => `
        <article class="record-item">
          <div class="case-meta">
            <span class="chip cyan">${escapeHtml(item.source_name || "official")}</span>
            <span class="chip amber">${escapeHtml(item.record_type || "record")}</span>
            ${item.start_date ? `<span class="chip">${escapeHtml(item.start_date)}${item.end_date ? ` - ${escapeHtml(item.end_date)}` : ""}</span>` : ""}
          </div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(clampText(item.creator || item.summary || item.media_types, 240))}</p>
          <div class="case-meta">
            ${item.item_count ? `<span class="chip">${escapeHtml(item.item_count)} items</span>` : ""}
            ${item.digital_object_count ? `<span class="chip">${escapeHtml(item.digital_object_count)} digital objects</span>` : ""}
            ${item.media_types ? `<span class="chip">${escapeHtml(clampText(item.media_types, 36))}</span>` : ""}
            <a class="chip amber" href="${escapeHtml(item.catalog_url || item.metadata_url)}" target="_blank" rel="noreferrer">Catalog</a>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSightings() {
  const q = state.search.toLowerCase();
  const items = state.sightings.filter((item) => {
    return !q || [item.city, item.state, item.country, item.shape, item.summary, item.year]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
  const shapeMax = Math.max(...(state.sightingSummary?.byShape || []).map((row) => row.value), 1);
  const shapeChart = (state.sightingSummary?.byShape || []).slice(0, 10).map((row) => `
    <div class="bar">
      <span>${escapeHtml(row.label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, row.value / shapeMax * 100)}%"></span></span>
      <span>${escapeHtml(row.value)}</span>
    </div>
  `).join("");
  els.sightingsPanel.innerHTML = `
    <div class="detail-block">
      <h4>Public report shape distribution</h4>
      <div class="bar-chart">${shapeChart}</div>
      <p class="caption">Crowdsourced reports are OSINT leads and social/reporting signals, not official event validation.</p>
    </div>
    <div class="sighting-grid">
      ${items.slice(0, 60).map((item) => `
        <article class="sighting-item">
          <div class="case-meta">
            <span class="chip cyan">${escapeHtml(item.shape || "unknown")}</span>
            <span class="chip amber">${escapeHtml(item.year || "no year")}</span>
            <span class="chip">${escapeHtml([item.city, item.state, item.country].filter(Boolean).join(", ") || "unknown")}</span>
          </div>
          <h3>${escapeHtml(item.occurred || "Public sighting report")}</h3>
          <p>${escapeHtml(clampText(item.summary, 210))}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function shapeColor(shape) {
  const value = String(shape || "").toLowerCase();
  if (value.includes("triangle")) return "#e0b45b";
  if (value.includes("sphere") || value.includes("circle") || value.includes("round")) return "#6ed4d8";
  if (value.includes("light") || value.includes("fireball")) return "#f3e58b";
  if (value.includes("disk") || value.includes("disc")) return "#82a6df";
  if (value.includes("cigar") || value.includes("cylinder")) return "#d97a6c";
  return "#7cc891";
}

function mapVisibleSightings() {
  const q = state.search.toLowerCase();
  const shape = els.mapShapeFilter?.value || "";
  const minYear = Number(els.mapYearMin?.value || 1900);
  const maxYear = Number(els.mapYearMax?.value || 2030);
  const source = state.mapSightings.length ? state.mapSightings : state.sightings;
  return source.filter((item) => {
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
    if (shape && item.shape !== shape) return false;
    if (Number.isFinite(minYear) && item.year && item.year < minYear) return false;
    if (Number.isFinite(maxYear) && item.year && item.year > maxYear) return false;
    return !q || [item.city, item.state, item.country, item.shape, item.year, item.summary]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });
}

function drawSightingMap() {
  const canvas = els.sightingMapCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(720, Math.floor(rect.width || 900));
  const height = Math.floor(width * 0.56);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#071014";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(159,176,173,0.16)";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(36,48,57,0.82)";
  [
    [0.12, 0.28, 0.2, 0.26], [0.32, 0.34, 0.13, 0.22], [0.46, 0.25, 0.18, 0.22],
    [0.59, 0.36, 0.12, 0.3], [0.72, 0.32, 0.16, 0.18], [0.78, 0.62, 0.1, 0.1]
  ].forEach(([x, y, w, h]) => {
    ctx.beginPath();
    ctx.ellipse(x * width, y * height, w * width, h * height, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  const points = mapVisibleSightings();
  const maxPoints = Math.min(points.length, 50000);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < maxPoints; i++) {
    const item = points[i];
    const x = ((Number(item.longitude) + 180) / 360) * width;
    const y = ((90 - Number(item.latitude)) / 180) * height;
    if (x < 0 || x > width || y < 0 || y > height) continue;
    ctx.fillStyle = shapeColor(item.shape);
    ctx.globalAlpha = 0.42;
    ctx.beginPath();
    ctx.arc(x, y, 1.35, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = colors.text;
  ctx.font = "700 14px system-ui, sans-serif";
  ctx.fillText(`${points.length.toLocaleString()} mapped public reports`, 16, 28);
  ctx.fillStyle = colors.muted;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("Equirectangular plot: longitude vs latitude. Not all reports are validated events.", 16, 48);
  if (els.mapCaption) {
    els.mapCaption.textContent = `${points.length.toLocaleString()} reports match the current filters. Colors represent reported shape/type.`;
  }
}

function switchView(view) {
  state.activeView = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  els.caseList.classList.toggle("hidden", view !== "cases");
  els.fileTable.classList.toggle("hidden", view !== "files");
  els.findingsPanel.classList.toggle("hidden", view !== "findings");
  els.collectionsPanel.classList.toggle("hidden", view !== "collections");
  els.recordsPanel.classList.toggle("hidden", view !== "records");
  els.sightingsPanel.classList.toggle("hidden", view !== "sightings");
  els.mapPanel.classList.toggle("hidden", view !== "map");
  if (view === "sightings" && staticMode && !fullStaticSightingsLoaded) {
    loadStaticSightings();
  }
  if (view === "map") {
    loadMapSightings();
    requestAnimationFrame(drawSightingMap);
  }
}

async function loadStaticSightings() {
  fullStaticSightingsLoaded = true;
  try {
    state.sightings = await getJson("data/public_sightings_lite.json");
    renderSightings();
  } catch (error) {
    console.warn("Full static sighting dataset could not be loaded", error);
  }
}

async function loadMapSightings() {
  if (state.mapSightings.length) return;
  try {
    state.mapSightings = staticMode
      ? await getJson("data/public_sightings_lite.json")
      : await getJson("/api/sightings/map");
    if (staticMode) state.sightings = state.mapSightings;
    drawSightingMap();
  } catch (error) {
    console.warn("Map sighting data could not be loaded", error);
  }
}

async function loadCaseDetail(caseId) {
  if (!staticMode) {
    return getJson(`/api/cases/${encodeURIComponent(caseId)}`);
  }
  const item = state.cases.find((entry) => entry.id === caseId);
  if (!item) return null;
  const files = state.files.filter((file) => file.case_id === caseId);
  const caseMap = new Map(state.cases.map((entry) => [entry.id, entry]));
  const outgoing = (staticData.cross_refs || [])
    .filter((edge) => edge.from_case_id === caseId)
    .slice(0, 10)
    .map((edge) => {
      const target = caseMap.get(edge.to_case_id) || {};
      return {
        ...edge,
        target_title: target.title || edge.to_case_id,
        target_category: target.category || "",
        target_date: target.timeline_date || ""
      };
    });
  const incoming = (staticData.cross_refs || [])
    .filter((edge) => edge.to_case_id === caseId)
    .slice(0, 10)
    .map((edge) => {
      const source = caseMap.get(edge.from_case_id) || {};
      return {
        ...edge,
        source_title: source.title || edge.from_case_id,
        source_category: source.category || "",
        source_date: source.timeline_date || ""
      };
    });
  return { case: item, files, outgoing, incoming };
}

async function selectCase(caseId, shouldRender = true) {
  if (!caseId) return;
  state.selectedCaseId = caseId;
  state.graphFocus = caseId;
  state.selectedCase = await loadCaseDetail(caseId);
  if (shouldRender) {
    renderCases();
    renderDetail();
    drawGraph();
  }
}

function renderDetail() {
  const detail = state.selectedCase;
  if (!detail) return;
  const item = detail.case;
  els.detailEmpty.classList.add("hidden");
  els.detailContent.classList.remove("hidden");
  const files = detail.files.map((file) => `
    <article class="file-item">
      <div class="case-meta">
        <span class="chip cyan">${escapeHtml(file.file_kind)}</span>
        <span class="chip">${escapeHtml(file.agency)}</span>
      </div>
      <h5>${escapeHtml(file.title)}</h5>
      <p>${escapeHtml(clampText(file.description || file.official_note, 220))}</p>
      <div class="case-meta">
        ${file.original_url ? `<a class="chip amber" href="${escapeHtml(file.original_url)}" target="_blank" rel="noreferrer">Open original</a>` : ""}
        ${file.source_page_url ? `<a class="chip" href="${escapeHtml(file.source_page_url)}" target="_blank" rel="noreferrer">Source page</a>` : ""}
      </div>
    </article>
  `).join("");
  const related = detail.outgoing.map((edge) => `
    <button class="related-item" type="button" data-related-id="${escapeHtml(edge.to_case_id)}">
      <h5>${escapeHtml(edge.target_title)}</h5>
      <p>${escapeHtml(edge.basis)}. Weight ${escapeHtml(edge.weight)}.</p>
    </button>
  `).join("");
  els.detailContent.innerHTML = `
    <div class="detail-hero">
      ${item.thumbnail_url ? `<img src="${escapeHtml(item.thumbnail_url)}" alt="">` : ""}
      <div>
        <p class="eyebrow">Selected case</p>
        <h3>${escapeHtml(item.title)}</h3>
      </div>
      <div class="detail-meta">
        <span class="chip cyan">${escapeHtml(item.category)}</span>
        <span class="chip amber">${escapeHtml(item.timeline_date || "No date")}</span>
        <span class="chip">${escapeHtml(item.status || "Source records")}</span>
        <span class="chip">${escapeHtml(detail.files.length)} files</span>
      </div>
      <p>${escapeHtml(item.summary)}</p>
      <a href="${escapeHtml(item.case_url)}" target="_blank" rel="noreferrer">Open mirrored case page</a>
    </div>
    <div class="detail-block">
      <h4>Released Files</h4>
      <div class="file-list">${files || "<p>No file details were crawled for this case.</p>"}</div>
    </div>
    <div class="detail-block">
      <h4>Cross References</h4>
      <div class="related-list">${related || "<p>No generated cross-references passed the threshold.</p>"}</div>
    </div>
  `;
  els.detailContent.querySelectorAll("[data-related-id]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.relatedId));
  });
}

function renderTimeline() {
  const historical = state.timeline.historical.map((item) => `
    <article class="timeline-item">
      <span class="chip amber">${escapeHtml(item.date)}</span>
      <h5>${escapeHtml(item.title)}</h5>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `);
  const cases = state.timeline.cases.slice(-16).map((item) => `
    <button class="timeline-item case" type="button" data-timeline-case="${escapeHtml(item.id)}">
      <span class="chip cyan">${escapeHtml(item.timeline_date)}</span>
      <h5>${escapeHtml(item.title)}</h5>
      <p>${escapeHtml(clampText(item.summary, 130))}</p>
    </button>
  `);
  els.timelinePanel.innerHTML = [...historical, ...cases].join("");
  els.timelinePanel.querySelectorAll("[data-timeline-case]").forEach((button) => {
    button.addEventListener("click", () => selectCase(button.dataset.timelineCase));
  });
}

function renderSources() {
  const sourceHtml = state.sources.map((item) => `
    <article class="source-item">
      <div class="case-meta">
        <span class="chip cyan">${escapeHtml(item.reliability)}</span>
        <span class="chip">${escapeHtml(item.publisher)}</span>
        ${item.date ? `<span class="chip amber">${escapeHtml(item.date)}</span>` : ""}
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open source</a>
    </article>
  `).join("");
  const methodHtml = state.methods.map((item) => `
    <article class="source-item">
      <div class="case-meta">
        <span class="chip cyan">OSINT method</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <p><span class="field-label">Useful tools</span>${escapeHtml(item.tools)}</p>
    </article>
  `).join("");
  els.sourceList.innerHTML = sourceHtml + methodHtml;
}

function renderCharts() {
  const charts = [
    ["Agencies", state.summary.byAgency],
    ["File types", state.summary.byKind],
    ["Categories", state.summary.byCategory],
    ["Source reliability", state.summary.byReliability || []],
    ["Public report shapes", state.summary.sightingShapes || []]
  ];
  const html = charts.map(([title, rows]) => {
    const max = Math.max(...rows.map((row) => row.value), 1);
    return `
      <div class="detail-block">
        <h4>${escapeHtml(title)}</h4>
        <div class="bar-chart">
          ${rows.map((row) => `
            <div class="bar">
              <span>${escapeHtml(row.label)}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${Math.max(4, row.value / max * 100)}%"></span></span>
              <span>${escapeHtml(row.value)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");
  const firstFinding = els.findingsPanel.querySelector(".finding");
  if (firstFinding && !els.findingsPanel.querySelector(".bar-chart")) {
    firstFinding.insertAdjacentHTML("afterend", html);
  }
}

function graphColor(category) {
  if (/video/i.test(category)) return colors.cyan;
  if (/modern/i.test(category)) return colors.green;
  if (/scan|archive|historical/i.test(category)) return colors.amber;
  return colors.blue;
}

function drawGraph() {
  const canvas = els.networkCanvas;
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(720, Math.floor(rect.width * dpr));
  canvas.height = Math.floor(Math.min(520, Math.max(360, rect.width * 0.58)) * dpr);
  ctx.scale(dpr, dpr);
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;
  ctx.clearRect(0, 0, width, height);

  const nodes = state.graph.nodes;
  const edges = state.graph.edges;
  if (!nodes.length) return;
  const focus = state.graphFocus || state.selectedCaseId;
  const categories = [...new Set(nodes.map((node) => node.category))];
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const positions = new Map();

  nodes.forEach((node, index) => {
    const categoryIndex = categories.indexOf(node.category);
    const ring = 0.64 + (categoryIndex % 3) * 0.14;
    const angle = (index / nodes.length) * Math.PI * 2 + categoryIndex * 0.42;
    positions.set(node.id, {
      x: cx + Math.cos(angle) * radius * ring,
      y: cy + Math.sin(angle) * radius * ring,
      r: Math.max(4, Math.min(12, 3 + Math.sqrt(node.file_total || 1) * 1.7))
    });
  });

  ctx.lineWidth = 1;
  edges.forEach((edge) => {
    const a = positions.get(edge.from_case_id);
    const b = positions.get(edge.to_case_id);
    if (!a || !b) return;
    const isFocus = focus && (edge.from_case_id === focus || edge.to_case_id === focus);
    ctx.strokeStyle = isFocus ? "rgba(110, 212, 216, 0.62)" : "rgba(159, 176, 173, 0.14)";
    ctx.lineWidth = isFocus ? Math.min(4, 1 + edge.weight / 6) : Math.min(2, 0.5 + edge.weight / 18);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  nodes.forEach((node) => {
    const pos = positions.get(node.id);
    const isFocus = node.id === focus;
    ctx.beginPath();
    ctx.fillStyle = isFocus ? colors.text : graphColor(node.category);
    ctx.arc(pos.x, pos.y, isFocus ? pos.r + 4 : pos.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isFocus ? colors.cyan : "#0b1013";
    ctx.lineWidth = isFocus ? 3 : 1.5;
    ctx.stroke();
  });

  const selected = nodes.find((node) => node.id === focus);
  if (selected) {
    ctx.fillStyle = colors.text;
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(clampText(selected.title, 46), cx, height - 24);
  }
}

function setupGraphInteraction() {
  els.networkCanvas.addEventListener("click", (event) => {
    const rect = els.networkCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const width = rect.width;
    const height = Math.min(520, Math.max(360, width * 0.58));
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.38;
    const categories = [...new Set(state.graph.nodes.map((node) => node.category))];
    let closest = null;
    let closestDistance = Infinity;
    state.graph.nodes.forEach((node, index) => {
      const categoryIndex = categories.indexOf(node.category);
      const ring = 0.64 + (categoryIndex % 3) * 0.14;
      const angle = (index / state.graph.nodes.length) * Math.PI * 2 + categoryIndex * 0.42;
      const px = cx + Math.cos(angle) * radius * ring;
      const py = cy + Math.sin(angle) * radius * ring;
      const distance = Math.hypot(px - x, py - y);
      if (distance < closestDistance) {
        closest = node;
        closestDistance = distance;
      }
    });
    if (closest && closestDistance < 18) selectCase(closest.id);
  });
  els.resetGraph.addEventListener("click", () => {
    state.graphFocus = state.selectedCaseId;
    drawGraph();
  });
}

function renderAll() {
  renderStats();
  renderFilters();
  renderCases();
  renderFiles();
  renderFindings();
  renderCollections();
  renderOfficialRecords();
  renderSightings();
  renderCharts();
  renderDetail();
  renderTimeline();
  renderSources();
  switchView(state.activeView);
  requestAnimationFrame(drawGraph);
}

function debounce(fn, delay = 140) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function bindEvents() {
  els.searchInput.addEventListener("input", debounce((event) => {
    state.search = event.target.value.trim();
    renderCases();
    renderFiles();
    renderCollections();
    renderOfficialRecords();
    renderSightings();
    drawSightingMap();
  }));
  els.categoryFilter.addEventListener("change", (event) => {
    state.category = event.target.value;
    renderCases();
  });
  els.agencyFilter.addEventListener("change", (event) => {
    state.agency = event.target.value;
    renderFiles();
  });
  els.kindFilter.addEventListener("change", (event) => {
    state.kind = event.target.value;
    renderFiles();
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });
  [els.mapShapeFilter, els.mapYearMin, els.mapYearMax].forEach((control) => {
    control?.addEventListener("input", debounce(drawSightingMap, 120));
    control?.addEventListener("change", debounce(drawSightingMap, 120));
  });
  window.addEventListener("resize", debounce(() => {
    drawGraph();
    drawSightingMap();
  }, 120));
  setupGraphInteraction();
}

bindEvents();
loadBaseData().catch((error) => {
  console.error(error);
  els.snapshotStatus.textContent = "Could not load local database";
  els.caseList.innerHTML = `<div class="empty-state"><h2>Database load failed</h2><p>${escapeHtml(error.message)}</p></div>`;
});
