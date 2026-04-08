/* ══════════════════════════════════════════════
   POKÉCENTRE — script.js
   Retro GBA/CRT Pokédex with:
   - Fetch all 151 Gen I Pokémon
   - Live search, type filter, stat range, sort
   - Shiny sprite toggle per card
   - Paginated "Load More"
   - Detail modal with stats, abilities, info
   ══════════════════════════════════════════════ */

// ── DOM refs ──────────────────────────────────
const grid             = document.getElementById("pokemon-grid");
const loader           = document.getElementById("loader");
const emptyState       = document.getElementById("empty-state");
const searchInput      = document.getElementById("search-input");
const sortDropdown     = document.getElementById("sort-dropdown");
const sortDropdownVal  = document.getElementById("sort-dropdown-value");
const sortDropdownMenu = document.getElementById("sort-dropdown-menu");
const resultCount      = document.getElementById("result-count");
const typeFilters      = document.getElementById("type-filters");
const statMinEl        = document.getElementById("stat-min");
const statMaxEl        = document.getElementById("stat-max");
const statMinVal       = document.getElementById("stat-min-val");
const statMaxVal       = document.getElementById("stat-max-val");
const loadMoreWrap     = document.getElementById("load-more-wrapper");
const loadMoreBtn      = document.getElementById("load-more-btn");
const resetBtn         = document.getElementById("reset-filters");
const modalOverlay     = document.getElementById("modal-overlay");
const modalContent     = document.getElementById("modal-content");
const modalClose       = document.getElementById("modal-close");
const filterPanel      = document.getElementById("filter-panel");
const filterToggleBtn  = document.getElementById("filter-toggle-btn");
const themeToggleBtn   = document.getElementById("theme-toggle-btn");
const themeToggleIcon  = document.getElementById("theme-toggle-icon");

// ── State ─────────────────────────────────────
let allPokemon      = [];   // full dataset, fetched once
let filteredPokemon = [];   // derived from filters
let activeTypes     = new Set();
let searchQuery     = "";
let sortMode        = "id-asc";
let statMin         = 0;
let statMax         = 720;

const PAGE_SIZE     = 24;
let   displayedCount = 0;

// ── Type color map (for stat bar color hint) ──
const TYPE_COLORS = {
  normal:   "#9a9a7a", fire:     "#e8411a", water:    "#4488f0",
  grass:    "#78c840", electric: "#f8d030", ice:      "#98d8d8",
  fighting: "#c03028", poison:   "#a040a0", ground:   "#e0c068",
  flying:   "#a890f0", psychic:  "#f85888", bug:      "#a8b820",
  rock:     "#b8a038", ghost:    "#705898", dragon:   "#7038f8",
  dark:     "#705848", steel:    "#b8b8d0", fairy:    "#ee99ac",
};

// Stat bar color by range
function statColor(val) {
  if (val >= 120) return "#00e5ff";
  if (val >= 80)  return "#78c840";
  if (val >= 50)  return "#f5c400";
  return "#e8411a";
}

// ── All 18 types for filters ───────────────────
const ALL_TYPES = Object.keys(TYPE_COLORS);

// Build type filter buttons
function buildTypeFilters() {
  ALL_TYPES.forEach(type => {
    const btn = document.createElement("button");
    btn.className    = "filter-btn";
    btn.dataset.type = type;
    btn.textContent  = type.toUpperCase();
    btn.id           = `filter-type-${type}`;
    btn.setAttribute("aria-pressed", "false");
    btn.addEventListener("click", () => toggleType(type, btn));
    typeFilters.appendChild(btn);
  });
}

function toggleType(type, btn) {
  if (activeTypes.has(type)) {
    activeTypes.delete(type);
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  } else {
    activeTypes.add(type);
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
  }
  applyFilters();
}

// ── Fetch helpers ─────────────────────────────
async function fetchPokemon(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch #${id}`);
  return res.json();
}

// Compute total base stats for a pokemon object
function totalStats(pokemon) {
  return pokemon.stats.reduce((sum, s) => sum + s.base_stat, 0);
}

// ── Load all 151 in parallel batches ──────────
async function loadAllPokemon() {
  loader.classList.remove("hidden");
  grid.innerHTML = "";

  // Batch fetches: 30 at a time to avoid rate limiting
  const TOTAL = 151;
  const BATCH = 30;

  for (let start = 1; start <= TOTAL; start += BATCH) {
    const end = Math.min(start + BATCH - 1, TOTAL);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const batch = await Promise.all(ids.map(id => fetchPokemon(id)));
    allPokemon.push(...batch);
  }

  loader.classList.add("hidden");
  applyFilters();
}

// ── Apply filters + sort + render ─────────────
function applyFilters() {
  const q = searchQuery.toLowerCase().trim();

  filteredPokemon = allPokemon.filter(p => {
    // Search (name or id)
    const matchSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      String(p.id).includes(q);

    // Type filter
    const matchType = activeTypes.size === 0 ||
      p.types.some(t => activeTypes.has(t.type.name));

    // Stat total range
    const total = totalStats(p);
    const matchStat = total >= statMin && total <= statMax;

    return matchSearch && matchType && matchStat;
  });

  // Sort
  filteredPokemon.sort((a, b) => {
    switch (sortMode) {
      case "id-asc":    return a.id - b.id;
      case "id-desc":   return b.id - a.id;
      case "name-asc":  return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      default:          return 0;
    }
  });

  // Reset display
  displayedCount = 0;
  grid.innerHTML = "";

  updateResultCount();
  renderNextPage();
}

// ── Render a page of cards ─────────────────────
function renderNextPage() {
  const slice = filteredPokemon.slice(displayedCount, displayedCount + PAGE_SIZE);

  if (slice.length === 0 && displayedCount === 0) {
    emptyState.classList.remove("hidden");
    loadMoreWrap.classList.add("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  slice.forEach((p, i) => {
    const card = createCard(p, displayedCount + i);
    grid.appendChild(card);
  });

  displayedCount += slice.length;

  // Show/hide Load More
  if (displayedCount < filteredPokemon.length) {
    loadMoreWrap.classList.remove("hidden");
  } else {
    loadMoreWrap.classList.add("hidden");
  }

  updateResultCount();
}

function updateResultCount() {
  resultCount.textContent = `${filteredPokemon.length} / ${allPokemon.length}`;
}

// ── Build a card element ───────────────────────
function createCard(pokemon, index) {
  const card = document.createElement("div");
  card.className     = "pokemon-card";
  card.setAttribute("role", "button");
  card.setAttribute("tabindex", "0");
  card.setAttribute("aria-label", `View details for ${pokemon.name}`);
  card.id = `card-pokemon-${pokemon.id}`;

  // Stagger animation delay
  card.style.animationDelay = `${Math.min(index % PAGE_SIZE, 12) * 30}ms`;

  const types = pokemon.types.map(t => t.type.name);
  const primaryType = types[0];
  const bst  = totalStats(pokemon);
  const pct  = Math.min((bst / 720) * 100, 100).toFixed(1);
  const defaultSprite = pokemon.sprites.front_default || "";
  const shinySprite   = pokemon.sprites.front_shiny   || defaultSprite;

  card.innerHTML = `
    <span class="dex-number">#${String(pokemon.id).padStart(3, "0")}</span>
    <button class="shiny-btn" id="shiny-${pokemon.id}" title="Toggle shiny" aria-label="Toggle shiny sprite for ${pokemon.name}" aria-pressed="false">✦</button>
    <div class="card-sprite-area">
      <img
        src="${defaultSprite}"
        alt="${pokemon.name}"
        id="sprite-${pokemon.id}"
        data-default="${defaultSprite}"
        data-shiny="${shinySprite}"
      />
    </div>
    <div class="card-info">
      <p class="pokemon-name">${pokemon.name}</p>
      <div class="type-badges">
        ${types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join("")}
      </div>
      <div class="stat-bar" title="Base Stat Total: ${bst}">
        <div class="stat-bar-fill" style="width: ${pct}%; background: ${TYPE_COLORS[primaryType] || "var(--gold)"}"></div>
      </div>
    </div>
  `;

  // Shiny toggle
  const shinyBtn = card.querySelector(`#shiny-${pokemon.id}`);
  const spriteImg = card.querySelector(`#sprite-${pokemon.id}`);
  shinyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isShiny = shinyBtn.classList.toggle("shiny-active");
    shinyBtn.setAttribute("aria-pressed", String(isShiny));
    spriteImg.src = isShiny ? shinySprite : defaultSprite;
  });

  // Open modal
  const openModal = () => showModal(pokemon);
  card.addEventListener("click", openModal);
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(); }
  });

  return card;
}

// ── Detail Modal ───────────────────────────────
function showModal(pokemon) {
  const types  = pokemon.types.map(t => t.type.name);
  const primaryColor = TYPE_COLORS[types[0]] || "var(--gold)";

  const defaultFront = pokemon.sprites.front_default     || "";
  const shinyFront   = pokemon.sprites.front_shiny       || "";
  const defaultBack  = pokemon.sprites.back_default      || "";
  const OASprite     = pokemon.sprites?.other?.["official-artwork"]?.front_default || defaultFront;

  const abilities = pokemon.abilities.map(a => a.ability.name);
  const bst = totalStats(pokemon);

  const STAT_LABELS = {
    hp:               "HP",
    attack:           "ATK",
    defense:          "DEF",
    "special-attack": "SP.ATK",
    "special-defense":"SP.DEF",
    speed:            "SPD",
  };

  modalContent.innerHTML = `
    <div class="modal-pokemon-header">
      <p class="modal-dex-num">#${String(pokemon.id).padStart(3, "0")}</p>
      <h2 class="modal-pokemon-name" id="modal-pokemon-name">${pokemon.name.toUpperCase()}</h2>
      <div class="modal-type-badges">
        ${types.map(t => `<span class="type-badge type-${t}">${t}</span>`).join("")}
      </div>
    </div>

    <div class="modal-sprite-row">
      ${defaultFront ? `
      <div class="modal-sprite-wrapper">
        <img class="modal-sprite" src="${defaultFront}" alt="${pokemon.name} front default" />
        <span class="modal-sprite-label">DEFAULT</span>
      </div>` : ""}
      ${shinyFront ? `
      <div class="modal-sprite-wrapper">
        <img class="modal-sprite" src="${shinyFront}" alt="${pokemon.name} shiny" />
        <span class="modal-sprite-label">✦ SHINY</span>
      </div>` : ""}
      ${defaultBack ? `
      <div class="modal-sprite-wrapper">
        <img class="modal-sprite" src="${defaultBack}" alt="${pokemon.name} back" />
        <span class="modal-sprite-label">BACK</span>
      </div>` : ""}
    </div>

    <hr class="modal-divider" />

    <p class="modal-section-title">INFO</p>
    <div class="modal-info-grid">
      <div class="modal-info-item">
        <p class="modal-info-label">HEIGHT</p>
        <p class="modal-info-value">${(pokemon.height / 10).toFixed(1)} m</p>
      </div>
      <div class="modal-info-item">
        <p class="modal-info-label">WEIGHT</p>
        <p class="modal-info-value">${(pokemon.weight / 10).toFixed(1)} kg</p>
      </div>
      <div class="modal-info-item">
        <p class="modal-info-label">BASE EXP</p>
        <p class="modal-info-value">${pokemon.base_experience ?? "—"}</p>
      </div>
      <div class="modal-info-item">
        <p class="modal-info-label">BST</p>
        <p class="modal-info-value" style="color: var(--cyan)">${bst}</p>
      </div>
    </div>

    <hr class="modal-divider" />

    <p class="modal-section-title">BASE STATS</p>
    ${pokemon.stats.map(s => {
      const label = STAT_LABELS[s.stat.name] || s.stat.name.toUpperCase();
      const pct   = Math.min((s.base_stat / 255) * 100, 100).toFixed(1);
      const color = statColor(s.base_stat);
      return `
      <div class="modal-stat-row">
        <span class="modal-stat-name">${label}</span>
        <span class="modal-stat-val">${s.base_stat}</span>
        <div class="modal-stat-bar">
          <div class="modal-stat-fill" style="width: ${pct}%; background: ${color}"></div>
        </div>
      </div>`;
    }).join("")}

    <hr class="modal-divider" />

    <p class="modal-section-title">ABILITIES</p>
    <div class="modal-abilities">
      ${abilities.map(a => `<span class="ability-tag">${a}</span>`).join("")}
    </div>
  `;

  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  modalClose.focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// ── Search listener ────────────────────────────
searchInput.addEventListener("input", (e) => {
  searchQuery = e.target.value;
  applyFilters();
});

// ── Custom sort dropdown logic ─────────────────────
function openSortDropdown() {
  sortDropdown.classList.add("open");
  sortDropdown.setAttribute("aria-expanded", "true");
}

function closeSortDropdown() {
  sortDropdown.classList.remove("open");
  sortDropdown.setAttribute("aria-expanded", "false");
}

sortDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  sortDropdown.classList.contains("open") ? closeSortDropdown() : openSortDropdown();
});

sortDropdown.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSortDropdown(); }
  if (e.key === "Escape") closeSortDropdown();
});

sortDropdownMenu.querySelectorAll(".custom-dropdown-item").forEach(item => {
  item.addEventListener("click", (e) => {
    e.stopPropagation();
    const value = item.dataset.value;
    const label = item.textContent;
    // Update display
    sortDropdownVal.textContent = label;
    // Update selected state
    sortDropdownMenu.querySelectorAll(".custom-dropdown-item").forEach(i => {
      i.classList.remove("selected");
      i.setAttribute("aria-selected", "false");
    });
    item.classList.add("selected");
    item.setAttribute("aria-selected", "true");
    // Apply sort
    sortMode = value;
    applyFilters();
    closeSortDropdown();
  });
});

// Close on outside click
document.addEventListener("click", () => closeSortDropdown());

// ── Stat range sliders ─────────────────────────
statMinEl.addEventListener("input", () => {
  statMin = parseInt(statMinEl.value, 10);
  if (statMin > statMax) { statMax = statMin; statMaxEl.value = statMin; }
  statMinVal.textContent = statMin;
  applyFilters();
});

statMaxEl.addEventListener("input", () => {
  statMax = parseInt(statMaxEl.value, 10);
  if (statMax < statMin) { statMin = statMax; statMinEl.value = statMax; }
  statMaxVal.textContent = statMax;
  applyFilters();
});

// ── Load More ──────────────────────────────────
loadMoreBtn.addEventListener("click", renderNextPage);

// ── Reset filters ──────────────────────────────
resetBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchQuery       = "";
  sortSelect.value  = "id-asc";
  sortMode          = "id-asc";
  activeTypes.clear();
  document.querySelectorAll(".filter-btn").forEach(b => {
    b.classList.remove("active");
    b.setAttribute("aria-pressed", "false");
  });
  statMin = 0; statMax = 720;
  statMinEl.value = 0; statMaxEl.value = 720;
  statMinVal.textContent = 0; statMaxVal.textContent = 720;
  applyFilters();
});

// ── Filter panel toggle ────────────────────────
let filtersVisible = false;

filterToggleBtn.addEventListener("click", () => {
  filtersVisible = !filtersVisible;
  filterPanel.classList.toggle("collapsed", !filtersVisible);
  filterToggleBtn.setAttribute("aria-expanded", String(filtersVisible));
  // Swap button label arrow direction via .active class
  filterToggleBtn.classList.toggle("active", !filtersVisible);
});

// ── Theme toggle ────────────────────────────────
const LIGHT_THEME   = "light";
const STORAGE_KEY   = "pokecenter-theme";

function applyTheme(theme) {
  if (theme === LIGHT_THEME) {
    document.documentElement.setAttribute("data-theme", LIGHT_THEME);
    themeToggleIcon.textContent = "DARK";
    themeToggleBtn.title = "Switch to dark mode";
  } else {
    document.documentElement.removeAttribute("data-theme");
    themeToggleIcon.textContent = "LIGHT";
    themeToggleBtn.title = "Switch to light mode";
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

// Load saved preference
const savedTheme = localStorage.getItem(STORAGE_KEY) || "dark";
applyTheme(savedTheme);

themeToggleBtn.addEventListener("click", () => {
  const isLight = document.documentElement.getAttribute("data-theme") === LIGHT_THEME;
  applyTheme(isLight ? "dark" : LIGHT_THEME);
});

// ── Bootstrap ─────────────────────────────────
buildTypeFilters();
loadAllPokemon();