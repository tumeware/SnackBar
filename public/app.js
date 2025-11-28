const resultsEl = document.getElementById("results");
const statusEl = document.getElementById("status");
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const modalEl = document.getElementById("analysis-modal");
const modalBodyEl = document.getElementById("modal-body");
const modalCloseBtn = document.getElementById("modal-close");
const PLACEHOLDER_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Crect width='140' height='140' rx='16' fill='%23222b3c'/%3E%3Cpath fill='%2366f3a6' d='M52 42h36l6 20-24 12-24-12z'/%3E%3Cpath fill='%237db7ff' d='M50 46h40v6H50z' opacity='.7'/%3E%3Ccircle cx='70' cy='92' r='10' fill='%23fff' opacity='.3'/%3E%3Ctext x='70' y='98' text-anchor='middle' font-family='Arial' font-size='14' fill='%23cbd3e1'%3ENo image%3C/text%3E%3C/svg%3E";

let currentProducts = [];
let searchTimeout = null;
let lastInsightHtml = "";
let lastAlternativesHtml = "";
let analysisView = "insight";
let lastAlternativesData = [];
let searchAbortController = null;
let searchSeq = 0;
let lastQuery = "";
const searchCache = new Map();

const NutriLabels = {
  a: "Erinomainen",
  b: "Hyvä",
  c: "Kohtalainen",
  d: "Heikko",
  e: "Huono",
};
const NutrimentLabels = {
  alcohol: "Alkoholi",
  caffeine: "Kofeiini",
  calcium: "Kalsium",
  carbohydrates: "Hiilihydraatit",
  casein: "Kaseiini",
  chloride: "Kloridi",
  cholesterol: "Kolesteroli",
  cocoa: "Kaakaopitoisuus",
  energy: "Energia",
  "energy-kcal": "Energia (kcal)",
  "energy-kj": "Energia (kJ)",
  fat: "Rasva",
  fiber: "Ravintokuitu",
  folates: "Folaatti",
  fructose: "Fruktoosi",
  "fruits-vegetables-nuts-estimate-from-ingredients": "Hedelmä-, vihannes- ja pähkinäpitoisuus (arvio)",
  galactose: "Galaktoosi",
  glucose: "Glukoosi",
  iron: "Rauta",
  iodine: "Jodi",
  lactose: "Laktoosi",
  magnesium: "Magnesium",
  maltose: "Maltoosi",
  "monounsaturated-fat": "Kertatyydyttymätön rasva",
  nucleotides: "Nukleotidit",
  "omega-3-fat": "Omega-3",
  "omega-6-fat": "Omega-6",
  "omega-9-fat": "Omega-9",
  phosphorus: "Fosfori",
  polyols: "Sokerialkoholit",
  "polyunsaturated-fat": "Monityydyttymätön rasva",
  potassium: "Kalium",
  proteins: "Proteiini",
  salt: "Suola",
  sodium: "Natrium",
  starch: "Tärkkelys",
  sugars: "Sokerit",
  taurine: "Tauriini",
  "trans-fat": "Transrasva",
  "vitamin-a": "A-vitamiini",
  "vitamin-b1": "Tiamiini (B1)",
  "vitamin-b12": "B12-vitamiini",
  "vitamin-b2": "Riboflaviini (B2)",
  "vitamin-b6": "B6-vitamiini",
  "vitamin-b9": "B9-vitamiini",
  "vitamin-c": "C-vitamiini",
  "vitamin-d": "D-vitamiini",
  "vitamin-e": "E-vitamiini",
  "vitamin-k": "K-vitamiini",
  "vitamin-pp": "Niasiini (PP/B3)",
  zinc: "Sinkki",
};

const NutrimentSuffixLabels = {
  "100g": "100 g:ssa",
  serving: "annoksessa",
  unit: "yksikkö",
  value: "arvo",
};

function setStatus(message, muted = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("subtle", muted);
}

function toHttps(url) {
  if (!url) return null;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("http://")) return url.replace("http://", "https://");
  return url;
}

function showModal(contentHtml) {
  modalBodyEl.innerHTML = contentHtml;
  modalEl.classList.remove("hidden");
  requestAnimationFrame(() => {
    modalEl.classList.add("visible");
  });
}

function renderAnalysisModal(view = "insight") {
  analysisView = view;
  const hasAlternatives = Boolean(lastAlternativesHtml);
  const body = `
    <div class="modal-tabs">
      <button data-view="insight" class="${view === "insight" ? "active" : ""}">AI:n vastaus</button>
      <button data-view="alternatives" class="${view === "alternatives" ? "active" : ""}" ${
        hasAlternatives ? "" : "disabled"
      }>Vaihtoehdot</button>
    </div>
    <div class="modal-panel">
      ${
        view === "alternatives"
          ? hasAlternatives
            ? lastAlternativesHtml
            : "<p class='muted'>Ei suosituksia.</p>"
          : `<div class="analysis-card">${lastInsightHtml}</div>`
      }
    </div>
  `;

  modalBodyEl.innerHTML = body;
  if (modalEl.classList.contains("hidden")) {
    modalEl.classList.remove("hidden");
    requestAnimationFrame(() => {
      modalEl.classList.add("visible");
    });
  }

  modalBodyEl.querySelectorAll("[data-view]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => renderAnalysisModal(btn.dataset.view));
  });
  modalBodyEl.querySelectorAll("[data-alt-index]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const idx = Number(btn.dataset.altIndex);
      const product = lastAlternativesData[idx];
      if (!product) return;
      analyzeProduct(product);
      event.preventDefault();
    });
  });
  modalBodyEl.querySelectorAll(".alt-off").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
  });
}

function showModalSkeleton(title = "AI analysoi...") {
  const bars = Array.from({ length: 4 }, (_v, idx) => {
    const width = 55 + Math.random() * 40;
    const delay = (idx * 0.18).toFixed(2);
    const wiggle = (0.6 + Math.random() * 1.6).toFixed(2);
    return `<div class="skeleton line messy" style="width: ${width}%; animation-delay: -${delay}s; --wiggle: ${wiggle}s;"></div>`;
  }).join("");

  showModal(`
    <p class="muted">${escapeHtml(title)}</p>
    <div class="skeleton-stack">${bars}</div>
  `);
}

function hideModal() {
  modalEl.classList.remove("visible");
  setTimeout(() => {
    modalEl.classList.add("hidden");
    modalBodyEl.innerHTML = "";
  }, 180);
}

function escapeHtml(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function prettifyNutrimentKey(key) {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translateNutrimentKey(key) {
  const match = key.match(/(.+)_((?:100g)|serving|unit|value)$/i);
  const baseKey = match ? match[1] : key;
  const suffix = match ? match[2].toLowerCase() : null;
  const baseLabel = NutrimentLabels[baseKey.toLowerCase()] || prettifyNutrimentKey(baseKey);

  if (!suffix) return baseLabel;

  const suffixLabel = NutrimentSuffixLabels[suffix] || suffix;
  if (baseLabel.endsWith(")") && baseLabel.includes("(")) {
    return `${baseLabel.slice(0, -1)}, ${suffixLabel})`;
  }
  return `${baseLabel} (${suffixLabel})`;
}

function toNumber(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const match = normalized.match(/-?\d*\.?\d+/);
    if (!match || !match[0]) return null;
    const num = Number(match[0]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function getAmountUnit(quantity) {
  if (!quantity) return "g";
  const lower = quantity.toLowerCase();
  if (lower.includes("ml") || lower.includes("l")) return "ml";
  if (lower.includes("kg") || lower.includes("g")) return "g";
  return "g/ml";
}

function normalizeNutriments(nutriments) {
  const grouped = new Map();

  Object.entries(nutriments || {})
    .filter(([key]) => !key.toLowerCase().includes("prepared"))
    .forEach(([key, value]) => {
      const match = key.match(/(.+)_((?:100g)|serving|unit|value)$/i);
      const baseKey = match ? match[1] : key;
      const suffix = match ? match[2].toLowerCase() : "base";
      const entry =
        grouped.get(baseKey) ||
        { unit: undefined, base: undefined, per100g: undefined, serving: undefined, value: undefined };

      if (suffix === "unit") entry.unit = value;
      else if (suffix === "100g") entry.per100g = value;
      else if (suffix === "serving") entry.serving = value;
      else if (suffix === "value") entry.value = value;
      else entry.base = value;

      grouped.set(baseKey, entry);
    });

  const entries = [];

  grouped.forEach((entry, baseKey) => {
    entries.push({
      key: baseKey,
      label: translateNutrimentKey(baseKey),
      unit: entry.unit ? String(entry.unit) : "",
      per100g: toNumber(entry.per100g),
      perServing: toNumber(entry.serving),
      base: toNumber(entry.base ?? entry.value),
    });
  });

  return entries;
}

function formatNutrientValue(value, unit) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  const abs = Math.abs(value);
  const decimals = abs === 0 ? 0 : abs < 10 ? 2 : abs < 100 ? 1 : 0;
  const rounded = value.toFixed(decimals);
  const normalized = Number(rounded);
  const display = Number.isInteger(normalized) ? normalized : rounded;
  return `${display}${unit ? ` ${unit}` : ""}`;
}

function calculateScaledValue(nutrient, amount, mode) {
  if (mode === "per100g" && nutrient.per100g !== null) {
    return nutrient.per100g * (amount / 100);
  }
  if (mode === "serving" && nutrient.perServing !== null) {
    return nutrient.perServing * amount;
  }
  if (nutrient.base !== null) return nutrient.base;
  if (nutrient.per100g !== null) return nutrient.per100g;
  if (nutrient.perServing !== null) return nutrient.perServing;
  return null;
}

function formatAnalysis(text) {
  const lines = text
    .split("\n")
    .map((l) =>
      l
        .replace(/\*\*(.*?)\*\*/g, "$1") // strip bold markdown
        .replace(/__(.*?)__/g, "$1") // strip alternative bold
        .trim(),
    )
    .filter(Boolean);

  let html = "";
  let bullets = [];

  const flushBullets = () => {
    if (bullets.length) {
      html += `<ul class="analysis-list">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
      bullets = [];
    }
  };

  lines.forEach((line) => {
    const headingMatch = line.match(/^(\d+[\).\s]+)(.*)/);
    if (headingMatch) {
      flushBullets();
      const heading = headingMatch[2] ? headingMatch[2] : headingMatch[1];
      html += `<h4>${escapeHtml(heading)}</h4>`;
      return;
    }

    if (line.startsWith("-") || line.startsWith("•")) {
      bullets.push(line.replace(/^[-•]\s*/, ""));
      return;
    }

    flushBullets();
    html += `<p>${escapeHtml(line)}</p>`;
  });

  flushBullets();
  return html;
}

function renderAlternatives(alternatives) {
  if (!alternatives.length) return "";

  const cards = alternatives
    .map((alt, idx) => {
      const link = `https://world.openfoodfacts.org/product/${alt.code}`;
      const fullImg = toHttps(alt.image);
      const thumbImg = toHttps(alt.imageThumb);
      const imgSrc = fullImg || thumbImg || PLACEHOLDER_IMG;
      const allergens = alt.allergens ? alt.allergens : "Allergeeneja ei listattu";
      const nutri = alt.nutriScore ? `Nutri-Score ${alt.nutriScore.toUpperCase()}` : "Nutri-Score ?";

      return `
        <button class="alt-card" type="button" data-alt-index="${idx}">
          <div class="alt-thumb"><img src="${imgSrc}" alt="${escapeHtml(alt.name)}" loading="lazy" /></div>
          <div class="alt-meta">
            <p class="alt-title">${escapeHtml(alt.name)}</p>
            <p class="alt-brand">${escapeHtml(alt.brands || "Tuntematon brändi")}</p>
            <p class="alt-nutri">${escapeHtml(nutri)}</p>
            <p class="alt-allergen">${escapeHtml(allergens)}</p>
            <a class="alt-off" href="${link}" target="_blank" rel="noreferrer">Avaa OpenFoodFacts</a>
          </div>
        </button>
      `;
    })
    .join("");

  return `
    <div class="alt-section">
      <h4>Allergiaystävälliset vaihtoehdot</h4>
      <div class="alt-grid">${cards}</div>
    </div>
  `;
}

function skeletonCard() {
  const skeleton = document.createElement("div");
  skeleton.className = "card";
  skeleton.innerHTML = `
    <div class="skeleton avatar"></div>
    <div>
      <div class="skeleton line" style="width: 70%;"></div>
      <div class="skeleton line" style="width: 50%; margin-top: 6px;"></div>
    </div>
  `;
  return skeleton;
}

function renderProducts(products) {
  resultsEl.innerHTML = "";

  if (!products.length) {
    setStatus("Ei tuloksia. Kokeile tarkempaa hakua.", true);
    return;
  }

  const fragment = document.createDocumentFragment();

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    const fullImg = toHttps(product.image);
    const thumbImg = toHttps(product.imageThumb);
    img.src = fullImg || thumbImg || PLACEHOLDER_IMG;
    img.alt = product.name;
    img.loading = "lazy";
    img.onerror = () => {
      img.src = PLACEHOLDER_IMG;
    };

    const info = document.createElement("div");
    info.className = "card-body";

    const title = document.createElement("h3");
    title.textContent = product.name;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = product.brands || "Tuntematon brändi";

    const topRow = document.createElement("div");
    topRow.className = "card-row";

    const nutri = document.createElement("span");
    nutri.className = `badge-pill nutri ${product.nutriScore || "c"}`;
    nutri.textContent = product.nutriScore ? `Nutri-Score ${product.nutriScore.toUpperCase()}` : "Nutri-Score ?";

    const quantity = document.createElement("span");
    quantity.className = "badge-pill subtle";
    quantity.textContent = product.quantity || "Ei määrätietoa";

    topRow.append(nutri, quantity);

    const categories = document.createElement("div");
    categories.className = "badges";
    product.categories.slice(0, 2).forEach((c) => {
      const badge = document.createElement("span");
      badge.className = "badge-pill subtle";
      badge.textContent = c.replace(/^[a-z]{2}:/, "");
      categories.appendChild(badge);
    });

    const actions = document.createElement("div");
    actions.className = "actions compact";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.className = "primary";
    analyzeBtn.textContent = "AI-analyysi";
    analyzeBtn.addEventListener("click", () => analyzeProduct(product));

    const detailBtn = document.createElement("button");
    detailBtn.textContent = "Ravitsemus";
    detailBtn.addEventListener("click", () => showNutrition(product));

    actions.append(analyzeBtn, detailBtn);

    info.append(title, meta, topRow, categories, actions);
    card.append(img, info);
    fragment.append(card);
  });

  resultsEl.append(fragment);
}

function showNutrition(product) {
  const nutriments = normalizeNutriments(product.nutriments || {});
  const topNutriments = nutriments.slice(0, 8);
  const hasPer100g = topNutriments.some((n) => n.per100g !== null);
  const hasServing = topNutriments.some((n) => n.perServing !== null);
  const mode = hasPer100g ? "per100g" : hasServing ? "serving" : "base";
  const amountUnit = mode === "per100g" ? getAmountUnit(product.quantity) : "annosta";
  const defaultAmount = mode === "per100g" ? 100 : 1;
  const quantityValue = product.quantity ? toNumber(product.quantity) : null;

  const quickAmounts = [];
  const addQuickAmount = (val) => {
    if (val === null || val === undefined) return;
    if (!quickAmounts.includes(val)) quickAmounts.push(val);
  };

  if (mode === "per100g") {
    [100, 250, 500].forEach(addQuickAmount);
    addQuickAmount(quantityValue);
  } else if (mode === "serving") {
    [1, 2, 3].forEach(addQuickAmount);
  }

  const quickButtonsHtml = quickAmounts
    .map(
      (amt) =>
        `<button type="button" data-quick-amount="${amt}">${amt} ${escapeHtml(amountUnit)}</button>`,
    )
    .join("");

  const nutrimentsHtml = topNutriments
    .map(
      ({ label }, idx) =>
        `<li><span>${escapeHtml(label)}</span><strong id="nutri-val-${idx}">–</strong></li>`,
    )
    .join("");

  const note =
    mode === "per100g"
      ? "Arvot skaalataan 100 g/ml tiedoista valitsemaasi määrään."
      : mode === "serving"
        ? "Arvot skaalataan ilmoitettuihin annoksiin (1 annos = tuotteen oma ilmoitus)."
        : "Skaalaus ei saatavilla, näytetään ilmoitetut arvot.";

  const amountControls =
    mode === "base"
      ? `<p class="nutri-note muted">${note}</p>`
      : `
    <div class="nutri-controls">
      <div class="nutri-amount">
        <label for="nutri-amount">Määrä</label>
        <div class="nutri-amount-input">
          <input id="nutri-amount" type="number" min="1" step="${mode === "per100g" ? "10" : "0.25"}" value="${defaultAmount}" />
          <span>${escapeHtml(amountUnit)}</span>
        </div>
      </div>
      ${quickButtonsHtml ? `<div class="nutri-quick">${quickButtonsHtml}</div>` : ""}
    </div>
    <p class="nutri-note muted">${note}</p>`;

  const body = `
    <div class="analysis-card">
      <h4>${escapeHtml(product.name)}</h4>
      <p class="muted">${escapeHtml(product.brands || "Brändi tuntematon")}</p>
      <p>${product.nutriScore ? `Nutri-Score: ${escapeHtml(NutriLabels[product.nutriScore])}` : "Nutri-Score ei saatavilla"}</p>
      <p>${product.ingredients ? `Ainesosat: ${escapeHtml(product.ingredients)}` : "Ainesosat ei listattuna"}</p>
      <p>${product.allergens ? `Allergeenit: ${escapeHtml(product.allergens)}` : "Allergeeneja ei listattu"}</p>
      ${amountControls}
      <h4>Keskeiset ravintoaineet</h4>
      ${
        topNutriments.length
          ? `<ul class="nutri-list">${nutrimentsHtml}</ul>`
          : "<p class='muted'>Ei ravintoarvoja saatavilla.</p>"
      }
    </div>
  `;

  showModal(body);

  const amountInput = modalBodyEl.querySelector("#nutri-amount");
  const updateValues = () => {
    const amount = mode === "base" || !amountInput ? defaultAmount : Number(amountInput.value) || defaultAmount;
    topNutriments.forEach((nutrient, idx) => {
      const target = modalBodyEl.querySelector(`#nutri-val-${idx}`);
      if (!target) return;
      const scaled = calculateScaledValue(nutrient, amount, mode);
      target.textContent = formatNutrientValue(scaled, nutrient.unit);
    });
  };

  updateValues();

  if (amountInput && mode !== "base") {
    amountInput.addEventListener("input", updateValues);
    modalBodyEl.querySelectorAll("[data-quick-amount]").forEach((btn) => {
      btn.addEventListener("click", () => {
        amountInput.value = btn.dataset.quickAmount;
        updateValues();
      });
    });
  }
}

async function analyzeProduct(product) {
  showModalSkeleton(`Analysoidaan ${product.name}...`);

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product }),
    });

    if (!res.ok) {
      let message = "AI-pyyntö epäonnistui";
      try {
        const body = await res.json();
        if (body?.error) {
          message = body.error;
          if (body?.detail) message += ` (${body.detail})`;
        }
      } catch (_err) {
        // ignore parse errors
      }
      throw new Error(message);
    }

    const data = await res.json();
    const { insight, alternatives } = data.data || { insight: data.data, alternatives: [] };
    lastInsightHtml = formatAnalysis(insight || "");
    lastAlternativesData = alternatives || [];
    lastAlternativesHtml = renderAlternatives(lastAlternativesData);
    renderAnalysisModal("insight");
  } catch (error) {
    console.error(error);
    showModal(`<p>AI ei vastannut. Tarkista palvelin ja API-avain.</p>`);
  }
}

async function search(q, { force = false } = {}) {
  const trimmed = q.trim();
  if (!trimmed || trimmed.length < 2) {
    setStatus("Tarvitaan vähintään 2 merkkiä hakuun.", true);
    return;
  }

  if (!force && trimmed === lastQuery && searchCache.has(trimmed)) {
    currentProducts = searchCache.get(trimmed);
    renderProducts(currentProducts);
    setStatus(`Löytyi ${currentProducts.length} tuotetta (välimuisti).`, true);
    return;
  }

  lastQuery = trimmed;

  const seq = ++searchSeq;
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  setStatus("Haetaan Open Food Factsista...");
  const hadResults = currentProducts.length > 0;
  if (!hadResults) {
    resultsEl.innerHTML = "";
    for (let i = 0; i < 4; i += 1) {
      resultsEl.appendChild(skeletonCard());
    }
  }
  resultsEl.classList.add("loading");

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: searchAbortController.signal });
    if (!res.ok) {
      let message = "Hakupyyntö epäonnistui";
      try {
        const body = await res.json();
        if (body?.error) {
          message = body.error;
          if (body?.detail) message += ` (${body.detail})`;
        }
      } catch (_err) {
        // ignore parse errors
      }
      throw new Error(message);
    }
    const { data } = await res.json();
    if (seq !== searchSeq) return; // stale response
    currentProducts = data;
    searchCache.set(trimmed, data);
    renderProducts(currentProducts);
    setStatus(`Löytyi ${data.length} tuotetta.`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      renderProducts(currentProducts);
      setStatus("Haku keskeytettiin, näytetään aiemmat tulokset.", true);
      return;
    }
    console.error(error);
    setStatus(error.message || "Haku epäonnistui. Kokeile uudelleen.", true);
    if (!hadResults) {
      resultsEl.innerHTML = "";
    }
  } finally {
    if (seq === searchSeq) {
      resultsEl.classList.remove("loading");
    }
  }
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const q = searchInput.value.trim();
  clearTimeout(searchTimeout);
  searchTimeout = null;
  search(q, { force: true });
});

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearTimeout(searchTimeout);
  if (q.length < 2) {
    setStatus("Valmiina hakuun.", true);
    return;
  }
  searchTimeout = setTimeout(() => search(q), 500);
});

modalCloseBtn.addEventListener("click", hideModal);
modalEl.addEventListener("click", (event) => {
  if (event.target === modalEl || event.target.classList.contains("modal-backdrop")) {
    hideModal();
  }
});
