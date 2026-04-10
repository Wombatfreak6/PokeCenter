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
const navDex           = document.getElementById("nav-dex");
const navBattle        = document.getElementById("nav-battle");
const pokedexView      = document.getElementById("pokedex-view");
const battleView       = document.getElementById("battle-view");

// ── View Router ───────────────────────────────
function showView(view) {
  if (view === "dex") {
    pokedexView.classList.remove("hidden");
    battleView.classList.add("hidden");
    navDex.classList.add("active");
    navBattle.classList.remove("active");
  } else {
    battleView.classList.remove("hidden");
    pokedexView.classList.add("hidden");
    navBattle.classList.add("active");
    navDex.classList.remove("active");
  }
}

navDex.addEventListener("click", (e) => { e.preventDefault(); showView("dex"); });
navBattle.addEventListener("click", (e) => { e.preventDefault(); showView("battle"); });

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

/* ══════════════════════════════════════════════
   BATTLE SETUP — TEAM BUILDER
   ══════════════════════════════════════════════ */

// ── DOM refs (battle page) ───────────────────
const battleSearchInput   = document.getElementById("battle-search-input");
const battleAddBtn        = document.getElementById("battle-add-btn");
const battleClearBtn      = document.getElementById("battle-clear-btn");
const targetPlayerBtn     = document.getElementById("target-player");
const targetOpponentBtn   = document.getElementById("target-opponent");
const playerTeamGrid      = document.getElementById("player-team-grid");
const opponentTeamGrid    = document.getElementById("opponent-team-grid");
const playerHint          = document.getElementById("player-hint");
const opponentHint        = document.getElementById("opponent-hint");
const battleError         = document.getElementById("battle-error");
const battleErrorText     = document.getElementById("battle-error-text");
const battleLoader        = document.getElementById("battle-loader");
const battleLoaderText    = document.getElementById("battle-loader-text");
const fightBtn            = document.getElementById("fight-btn");

// Fighter preview
const playerFighterSprite  = document.getElementById("player-fighter-sprite");
const playerFighterName    = document.getElementById("player-fighter-name");
const playerFighterTypes   = document.getElementById("player-fighter-types");
const opponentFighterSprite = document.getElementById("opponent-fighter-sprite");
const opponentFighterName  = document.getElementById("opponent-fighter-name");
const opponentFighterTypes = document.getElementById("opponent-fighter-types");

// ── Battle State ─────────────────────────────
const MAX_TEAM = 6;
let playerTeam    = [];   // array of pokemon objects
let opponentTeam  = [];
let playerActive  = null; // pokemon object of active fighter
let opponentActive = null;
let addTarget     = "player"; // "player" | "opponent"

// ── Target selector toggle ───────────────────
targetPlayerBtn.addEventListener("click", () => {
  addTarget = "player";
  targetPlayerBtn.classList.add("active");
  targetPlayerBtn.setAttribute("aria-pressed", "true");
  targetOpponentBtn.classList.remove("active");
  targetOpponentBtn.setAttribute("aria-pressed", "false");
});

targetOpponentBtn.addEventListener("click", () => {
  addTarget = "opponent";
  targetOpponentBtn.classList.add("active");
  targetOpponentBtn.setAttribute("aria-pressed", "true");
  targetPlayerBtn.classList.remove("active");
  targetPlayerBtn.setAttribute("aria-pressed", "false");
});

// ── Show / hide battle loader ─────────────────
function setBattleLoading(visible, text = "LOADING…") {
  battleLoaderText.textContent = text;
  battleLoader.classList.toggle("hidden", !visible);
}

// ── Show / hide battle error ──────────────────
function showBattleError(msg) {
  battleErrorText.textContent = msg;
  battleError.classList.remove("hidden");
  // Re-trigger animation by cloning node
  const clone = battleError.cloneNode(true);
  battleError.parentNode.replaceChild(clone, battleError);
  // Re-assign reference for subsequent calls
  Object.assign(document.getElementById("battle-error").style, {});
  setTimeout(() => document.getElementById("battle-error").classList.add("hidden"), 3500);
}

// ── Fetch a single Pokémon (reuses cache if loaded) ──
async function fetchBattlePokemon(nameOrId) {
  const norm = String(nameOrId).toLowerCase().trim();
  // Check already-loaded Pokédex data first
  const cached = allPokemon.find(p => p.name === norm || String(p.id) === norm);
  if (cached) return cached;
  // Fallback: fresh fetch
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${norm}`);
  if (!res.ok) throw new Error(`"${norm}" not found`);
  return res.json();
}

// ── Add Pokémon to a team ─────────────────────
async function addToTeam(nameOrId, side) {
  const team = side === "player" ? playerTeam : opponentTeam;
  if (team.length >= MAX_TEAM) {
    showBattleError(`TEAM FULL! MAX ${MAX_TEAM} POKÉMON PER SIDE.`);
    return;
  }
  setBattleLoading(true, `FETCHING ${String(nameOrId).toUpperCase()}…`);
  try {
    const pokemon = await fetchBattlePokemon(nameOrId);
    // Prevent duplicates on same side
    if (team.some(p => p.id === pokemon.id)) {
      showBattleError(`${pokemon.name.toUpperCase()} IS ALREADY ON THIS TEAM!`);
      return;
    }
    team.push(pokemon);
    // Auto-select as active if first on that side
    if (side === "player"  && !playerActive)   setActiveFighter("player",   pokemon);
    if (side === "opponent" && !opponentActive) setActiveFighter("opponent", pokemon);
    renderTeam(side);
    battleSearchInput.value = "";
  } catch (err) {
    showBattleError(`POKÉMON NOT FOUND: "${String(nameOrId).toUpperCase()}"`);
  } finally {
    setBattleLoading(false);
  }
}

// ── Render a team grid ────────────────────────
function renderTeam(side) {
  const team    = side === "player" ? playerTeam    : opponentTeam;
  const grid    = side === "player" ? playerTeamGrid : opponentTeamGrid;
  const hint    = side === "player" ? playerHint    : opponentHint;
  const active  = side === "player" ? playerActive  : opponentActive;

  grid.innerHTML = "";

  team.forEach((pokemon, idx) => {
    const card = document.createElement("div");
    card.className = "team-mini-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Select ${pokemon.name} as active fighter`);
    card.id = `team-card-${side}-${pokemon.id}`;

    if (active && active.id === pokemon.id) card.classList.add("active-fighter");

    const sprite = pokemon.sprites.front_default || "";
    card.innerHTML = `
      <button class="team-mini-remove" aria-label="Remove ${pokemon.name}" tabindex="0">✕</button>
      <img class="team-mini-sprite" src="${sprite}" alt="${pokemon.name}" />
      <p class="team-mini-name">${pokemon.name}</p>
    `;

    // Click to set as active fighter
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("team-mini-remove")) return;
      setActiveFighter(side, pokemon);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (!e.target.classList.contains("team-mini-remove")) setActiveFighter(side, pokemon);
      }
    });

    // Remove button
    const removeBtn = card.querySelector(".team-mini-remove");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromTeam(side, pokemon.id);
    });

    grid.appendChild(card);
  });

  // Hint text
  hint.textContent = team.length >= MAX_TEAM
    ? "TEAM FULL"
    : `ADD UP TO ${MAX_TEAM} POKÉMON`;

  updateFightButton();
}

// ── Remove a Pokémon from a team ──────────────
function removeFromTeam(side, pokemonId) {
  if (side === "player") {
    playerTeam = playerTeam.filter(p => p.id !== pokemonId);
    if (playerActive && playerActive.id === pokemonId) {
      playerActive = playerTeam[0] || null;
      updatePreview("player");
    }
  } else {
    opponentTeam = opponentTeam.filter(p => p.id !== pokemonId);
    if (opponentActive && opponentActive.id === pokemonId) {
      opponentActive = opponentTeam[0] || null;
      updatePreview("opponent");
    }
  }
  renderTeam(side);
}

// ── Set active fighter & update preview ───────
function setActiveFighter(side, pokemon) {
  if (side === "player") {
    playerActive = pokemon;
  } else {
    opponentActive = pokemon;
  }
  renderTeam(side);        // re-render to update active border
  updatePreview(side);
}

// ── Update the fighter preview strip ─────────
function updatePreview(side) {
  const pokemon = side === "player" ? playerActive : opponentActive;
  const sprite  = side === "player" ? playerFighterSprite  : opponentFighterSprite;
  const nameEl  = side === "player" ? playerFighterName    : opponentFighterName;
  const typesEl = side === "player" ? playerFighterTypes   : opponentFighterTypes;

  if (!pokemon) {
    sprite.src         = "";
    sprite.alt         = "";
    nameEl.textContent = "—";
    typesEl.innerHTML  = "";
    updateFightButton();
    return;
  }

  sprite.src         = pokemon.sprites.front_default || "";
  sprite.alt         = pokemon.name;
  nameEl.textContent = pokemon.name.toUpperCase();
  const types = pokemon.types.map(t => t.type.name);
  typesEl.innerHTML = types
    .map(t => `<span class="type-badge type-${t}">${t.toUpperCase()}</span>`)
    .join("");
  updateFightButton();
}

// ── Enable/disable FIGHT! button ──────────────
function updateFightButton() {
  const ready = !!(playerActive && opponentActive);
  fightBtn.disabled = !ready;
  fightBtn.setAttribute("aria-disabled", String(!ready));
}

// ── Clear all teams ───────────────────────────
function clearAllTeams() {
  playerTeam     = [];
  opponentTeam   = [];
  playerActive   = null;
  opponentActive = null;
  renderTeam("player");
  renderTeam("opponent");
  updatePreview("player");
  updatePreview("opponent");
}

// ── Wire up buttons ───────────────────────────
battleAddBtn.addEventListener("click", () => {
  const val = battleSearchInput.value.trim();
  if (!val) { showBattleError("PLEASE ENTER A POKÉMON NAME!"); return; }
  addToTeam(val, addTarget);
});

battleSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = battleSearchInput.value.trim();
    if (!val) { showBattleError("PLEASE ENTER A POKÉMON NAME!"); return; }
    addToTeam(val, addTarget);
  }
});

battleClearBtn.addEventListener("click", clearAllTeams);

// ── Battle Arena Refs ───────────────────────────
const battleSetupContainer = document.getElementById("battle-setup-container");
const battleArenaContainer = document.getElementById("battle-arena-container");

const arenaOppName = document.getElementById("arena-opp-name");
const arenaOppHpFill = document.getElementById("arena-opp-hp-fill");
const arenaOppHpText = document.getElementById("arena-opp-hp-text");
const arenaOppSprite = document.getElementById("arena-opp-sprite");

const arenaPlayerName = document.getElementById("arena-player-name");
const arenaPlayerHpFill = document.getElementById("arena-player-hp-fill");
const arenaPlayerHpText = document.getElementById("arena-player-hp-text");
const arenaPlayerSprite = document.getElementById("arena-player-sprite");

const arenaDialogueText = document.getElementById("arena-dialogue-text");
const arenaMovesGrid = document.getElementById("arena-moves-grid");
const arenaRunBtn = document.getElementById("arena-run-btn");

let playerFighterState = null;
let oppFighterState = null;
let isBattleOver = false;

// Simplified Type Chart
const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, grass: 0.5, electric: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, water: 1, grass: 0.5, electric: 2, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { grass: 2, electric: 0.5, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, ground: 1, dragon: 2, dark: 2, steel: 0.5 }
};

function getMultiplier(moveType, defTypes) {
  let mult = 1;
  const attackMap = TYPE_CHART[moveType];
  if (!attackMap) return 1;
  defTypes.forEach(t => {
    if (attackMap[t.type.name] !== undefined) mult *= attackMap[t.type.name];
  });
  return mult;
}

// Prepare fighter stats and fetch moves
async function buildFighter(pokemon, isPlayer) {
  const hpStat = pokemon.stats.find(s=>s.stat.name==="hp").base_stat;
  const maxHp = hpStat + 60; // faux Lv50 HP calculation

  // Fetch first 4 valid moves (with power) to make demo interesting
  const moveUrls = [];
  for (const m of pokemon.moves) {
    if (moveUrls.length >= 4) break;
    moveUrls.push(m.move.url);
  }

  const movesData = await Promise.all(moveUrls.map(url => fetch(url).then(r=>r.json())));
  const activeMoves = movesData.map(m => ({
    name: m.name,
    type: m.type.name,
    power: m.power || 40,
    pp: m.pp || 15,
    maxPp: m.pp || 15
  }));

  // Ensure they have fallback moves if needed
  if (activeMoves.length === 0) {
    activeMoves.push({ name: "tackle", type: "normal", power: 40, pp: 35, maxPp: 35 });
  }

  return {
    ...pokemon,
    maxHp,
    currentHp: maxHp,
    activeMoves,
    isPlayer
  };
}

// ── Calculate Damage ──
function calculateDamage(move, attacker, defender) {
  if (move.power === 0) return { damage: 0, mult: 1 };
  
  const atk = attacker.stats.find(s=>s.stat.name==="attack").base_stat;
  const def = defender.stats.find(s=>s.stat.name==="defense").base_stat;
  
  const isStab = attacker.types.some(t=>t.type.name===move.type);
  const stabMult = isStab ? 1.5 : 1;
  const typeMult = getMultiplier(move.type, defender.types);
  
  const random = (Math.floor(Math.random() * (255 - 217 + 1)) + 217) / 255;
  let damage = Math.floor(((((2 * 50 / 5) + 2) * move.power * atk / def) / 50 + 2) * stabMult * typeMult * random);
  
  return { damage: Math.max(1, damage), mult: typeMult };
}

// ── Update UI Status ──
function updateArenaUI() {
  // Opponent UI
  arenaOppName.textContent = cleanName(oppFighterState.name).toUpperCase();
  arenaOppHpText.textContent = `${oppFighterState.currentHp}/${oppFighterState.maxHp}`;
  const oppPct = Math.max(0, (oppFighterState.currentHp / oppFighterState.maxHp) * 100);
  arenaOppHpFill.style.width = oppPct + "%";
  arenaOppHpFill.style.background = oppPct > 50 ? "#78c840" : oppPct > 20 ? "#f8d030" : "#e8411a";
  arenaOppSprite.src = oppFighterState.sprites.front_default || "";

  // Player UI
  arenaPlayerName.textContent = cleanName(playerFighterState.name).toUpperCase();
  arenaPlayerHpText.textContent = `${playerFighterState.currentHp}/${playerFighterState.maxHp}`;
  const pPct = Math.max(0, (playerFighterState.currentHp / playerFighterState.maxHp) * 100);
  arenaPlayerHpFill.style.width = pPct + "%";
  arenaPlayerHpFill.style.background = pPct > 50 ? "#78c840" : pPct > 20 ? "#f8d030" : "#e8411a";
  // Attempt to use back sprite
  arenaPlayerSprite.src = playerFighterState.sprites.back_default || playerFighterState.sprites.front_default || "";
}

function cleanName(str) {
  if (!str) return "";
  return str.split("-").join(" ");
}

let currentTypeInterval = null;

function typeMessage(text) {
  if (currentTypeInterval) clearInterval(currentTypeInterval);
  arenaDialogueText.innerHTML = "";
  let i = 0;
  return new Promise(resolve => {
    currentTypeInterval = setInterval(() => {
      arenaDialogueText.innerHTML += text.charAt(i);
      i++;
      if (i >= text.length) {
        clearInterval(currentTypeInterval);
        currentTypeInterval = null;
        setTimeout(resolve, 800); // Wait a bit after text finishes
      }
    }, 20); // typing speed
  });
}

function renderMoves() {
  arenaMovesGrid.innerHTML = "";
  playerFighterState.activeMoves.forEach((move, i) => {
    const btn = document.createElement("button");
    btn.className = "arena-move-btn";
    btn.disabled = isBattleOver;
    btn.innerHTML = `
      <div class="move-header">
        <span class="move-name">${cleanName(move.name).toUpperCase()}</span>
        <span class="move-pp">PP ${move.pp}/${move.maxPp}</span>
      </div>
      <span class="type-badge type-${move.type} move-type">${move.type.toUpperCase()}</span>
    `;
    btn.addEventListener("click", () => handlePlayerTurn(i));
    arenaMovesGrid.appendChild(btn);
  });
}

// ── Turn Logic ──
async function handlePlayerTurn(moveIndex) {
  if (isBattleOver) return;
  const move = playerFighterState.activeMoves[moveIndex];
  if (move.pp <= 0) return;
  
  // Disable move buttons while turn executes
  Array.from(arenaMovesGrid.children).forEach(b => b.disabled = true);
  arenaRunBtn.disabled = true;

  move.pp--;
  renderMoves();
  
  await executeAttack(playerFighterState, oppFighterState, move, arenaOppSprite);
  if (isBattleOver) return;

  await aiTurn();

  if (!isBattleOver) {
    Array.from(arenaMovesGrid.children).forEach(b => b.disabled = false);
    arenaRunBtn.disabled = false;
    typeMessage(`What will ${cleanName(playerFighterState.name).toUpperCase()} do?`);
  }
}

async function aiTurn() {
  // Simple AI: pick move that does most damage
  let bestMove = oppFighterState.activeMoves[0];
  let maxDmg = -1;

  oppFighterState.activeMoves.forEach(m => {
    if (m.pp <= 0) return;
    const { damage } = calculateDamage(m, oppFighterState, playerFighterState);
    if (damage > maxDmg) { maxDmg = damage; bestMove = m; }
  });

  bestMove.pp--;
  await executeAttack(oppFighterState, playerFighterState, bestMove, arenaPlayerSprite);
}

async function executeAttack(attacker, defender, move, defenderSpriteEl) {
  await typeMessage(`${cleanName(attacker.name).toUpperCase()} used ${cleanName(move.name).toUpperCase()}!`);
  
  const { damage, mult } = calculateDamage(move, attacker, defender);
  defender.currentHp = Math.max(0, defender.currentHp - damage);
  
  // Animate sprite hit
  defenderSpriteEl.classList.add("shake-anim");
  setTimeout(() => defenderSpriteEl.classList.remove("shake-anim"), 300);

  updateArenaUI();

  if (mult > 1) {
    await typeMessage("It's super effective!");
  } else if (mult < 1) {
    await typeMessage("It's not very effective...");
  }

  if (defender.currentHp === 0) {
    isBattleOver = true;
    defenderSpriteEl.classList.add("fainted");
    await typeMessage(`${cleanName(defender.name).toUpperCase()} fainted!`);
    await typeMessage(attacker.isPlayer ? "YOU WIN!" : "YOU BLACKED OUT!");
    
    arenaRunBtn.textContent = "↩ RETURN TO SETUP";
    arenaRunBtn.style.color = "var(--gold)";
    arenaRunBtn.style.borderColor = "var(--gold)";
    arenaRunBtn.disabled = false;
  }
}

// ── Start Battle ──
async function initBattle() {
  if (!playerActive || !opponentActive) return;
  
  setBattleLoading(true, "PREPARING ARENA…");
  try {
    playerFighterState = await buildFighter(playerActive, true);
    oppFighterState = await buildFighter(opponentActive, false);
    
    isBattleOver = false;
    arenaOppSprite.classList.remove("fainted");
    arenaPlayerSprite.classList.remove("fainted");
    
    updateArenaUI();
    renderMoves();
    
    battleSetupContainer.classList.add("hidden");
    battleArenaContainer.classList.remove("hidden");
    
    await typeMessage(`Rival sent out ${cleanName(oppFighterState.name).toUpperCase()}!`);
    await typeMessage(`Go! ${cleanName(playerFighterState.name).toUpperCase()}!`);
    await typeMessage(`What will ${cleanName(playerFighterState.name).toUpperCase()} do?`);

    arenaRunBtn.disabled = false;
    arenaRunBtn.textContent = "🏃 RUN";
    arenaRunBtn.style.color = "";
    arenaRunBtn.style.borderColor = "";
  } catch (err) {
    showBattleError("FAILED TO START BATTLE.");
    console.error(err);
  } finally {
    setBattleLoading(false);
  }
}

fightBtn.addEventListener("click", initBattle);

arenaRunBtn.addEventListener("click", async () => {
  arenaRunBtn.disabled = true;
  Array.from(arenaMovesGrid.children).forEach(b => b.disabled = true);
  
  if (isBattleOver) {
    battleArenaContainer.classList.add("hidden");
    battleSetupContainer.classList.remove("hidden");
    return;
  }
  
  await typeMessage("Got away safely!");
  
  setTimeout(() => {
    battleArenaContainer.classList.add("hidden");
    battleSetupContainer.classList.remove("hidden");
  }, 1500);
});