/* ==========================================================================
   TPRO CLUB — Loja (catálogo)

   Lê o catálogo de data.js, aplica busca/filtros/ordenação e desenha a
   vitrine. Não guarda dados próprios: tudo o que é persistente mora em
   window.TPRO.

   Sumário
   01. Atalhos e estado
   02. Sincronia com a URL
   03. Seletor de plano
   04. Categorias e filtros
   05. Consulta (busca, filtro, ordenação)
   06. Cards e paginação
   07. Detalhe do produto
   08. Carrinho
   09. Avisos e toasts
   10. Inicialização
   ========================================================================== */

(() => {
  "use strict";

  const TPRO = window.TPRO;
  if (!TPRO) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const PAGE_SIZE = 12;
  const INSTALLMENTS = 12; // apenas ilustrativo na demonstração


  /* ========================================================================
     01. ESTADO
     ======================================================================== */

  const state = {
    search: "",
    categories: new Set(),
    brands: new Set(),
    priceMin: null, // em centavos
    priceMax: null,
    onlyStock: false,
    onlyDeal: false,
    sort: "relevancia",
    page: 1,
    planId: TPRO.getSessionPlan()
  };

  /** Produto aberto no modal de detalhe. */
  let currentProduct = null;
  let lastFocused = null;


  /* ========================================================================
     02. SINCRONIA COM A URL
     ------------------------------------------------------------------------
     Deixa o link compartilhável e permite chegar na loja já filtrado, por
     exemplo: loja.html?cat=maquinas&busca=trimmer
     ======================================================================== */

  function readUrl() {
    const params = new URLSearchParams(window.location.search);

    state.search = params.get("busca") || "";
    (params.get("cat") || "").split(",").filter(Boolean).forEach((id) => state.categories.add(id));
    (params.get("marca") || "").split(",").filter(Boolean).forEach((brand) => state.brands.add(brand));

    const min = Number(params.get("min"));
    const max = Number(params.get("max"));
    if (Number.isFinite(min) && min > 0) state.priceMin = Math.round(min * 100);
    if (Number.isFinite(max) && max > 0) state.priceMax = Math.round(max * 100);

    state.onlyStock = params.get("estoque") === "1";
    state.onlyDeal = params.get("oferta") === "1";
    if (params.get("ordem")) state.sort = params.get("ordem");

    const page = Number(params.get("pagina"));
    if (Number.isFinite(page) && page > 0) state.page = page;
  }

  function writeUrl() {
    const params = new URLSearchParams();

    if (state.search) params.set("busca", state.search);
    if (state.categories.size) params.set("cat", [...state.categories].join(","));
    if (state.brands.size) params.set("marca", [...state.brands].join(","));
    if (state.priceMin) params.set("min", String(state.priceMin / 100));
    if (state.priceMax) params.set("max", String(state.priceMax / 100));
    if (state.onlyStock) params.set("estoque", "1");
    if (state.onlyDeal) params.set("oferta", "1");
    if (state.sort !== "relevancia") params.set("ordem", state.sort);
    if (state.page > 1) params.set("pagina", String(state.page));

    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }


  /* ========================================================================
     03. SELETOR DE PLANO
     ======================================================================== */

  function renderPlanSwitch() {
    const box = $("[data-plan-switch]");
    if (!box) return;

    box.textContent = "";

    const options = [
      { id: "visitante", name: "Sem clube", hint: "preço de balcão" },
      ...TPRO.getPlans().map((plan) => ({
        id: plan.id,
        name: plan.name,
        hint: `${TPRO.formatPercent(plan.defaultDiscount)} de desconto padrão`
      }))
    ];

    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "plan-pill";
      button.dataset.plan = option.id;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(option.id === state.planId));
      button.textContent = option.name;
      button.title = option.hint;

      button.addEventListener("click", () => {
        state.planId = TPRO.setSessionPlan(option.id);
        renderPlanSwitch();
        renderResults();
        renderCart();
        if (currentProduct) fillProductModal(currentProduct);
      });

      box.appendChild(button);
    });

    updatePlanHint();
  }

  function updatePlanHint() {
    const hint = $("[data-plan-hint]");
    const cta = $("[data-cta-text]");

    if (state.planId === "visitante") {
      if (hint) hint.textContent = "Você está vendo o preço de balcão. Escolha um plano para ver o preço de membro.";
      if (cta) {
        cta.textContent =
          "Assine um plano e passe a comprar com preço de distribuidor em todo o catálogo.";
      }
      return;
    }

    const plan = TPRO.getPlanById(state.planId);
    if (!plan) return;

    if (hint) {
      hint.textContent = `Preços do plano ${plan.name} — ${TPRO.formatCurrency(plan.priceCents)} por mês.`;
    }
    if (cta) {
      cta.textContent = `Você está simulando o plano ${plan.name}. Assine por ${TPRO.formatCurrency(
        plan.priceCents
      )} por mês e leve esses preços para a sua barbearia.`;
    }
  }


  /* ========================================================================
     04. CATEGORIAS E FILTROS
     ======================================================================== */

  /** Quantos produtos visíveis existem em cada categoria. */
  function categoryCounts() {
    const counts = new Map();
    TPRO.getProducts().forEach((product) => {
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
    });
    return counts;
  }

  function renderCategoryStrip() {
    const list = $("[data-category-strip]");
    if (!list) return;

    const counts = categoryCounts();
    list.textContent = "";

    const makeChip = (id, label, count) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cat-chip";

      const active = id === "todas" ? state.categories.size === 0 : state.categories.has(id);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));

      button.append(label);
      if (typeof count === "number") {
        const badge = document.createElement("span");
        badge.className = "cat-chip__count";
        badge.textContent = `(${count})`;
        button.appendChild(badge);
      }

      button.addEventListener("click", () => {
        if (id === "todas") state.categories.clear();
        else if (state.categories.has(id)) state.categories.delete(id);
        else state.categories.add(id);

        state.page = 1;
        syncFilterInputs();
        renderCategoryStrip();
        renderResults();
      });

      item.appendChild(button);
      list.appendChild(item);
    };

    makeChip("todas", "Todos os produtos", TPRO.getProducts().length);
    TPRO.getCategories().forEach((category) => {
      const count = counts.get(category.id) || 0;
      if (count > 0) makeChip(category.id, category.name, count);
    });
  }

  function renderFilterLists() {
    const counts = categoryCounts();

    // Categorias
    const catList = $("[data-filter-categories]");
    if (catList) {
      catList.textContent = "";
      TPRO.getCategories().forEach((category) => {
        const count = counts.get(category.id) || 0;
        if (count === 0) return;

        catList.appendChild(
          checkRow({
            label: category.name,
            count,
            checked: state.categories.has(category.id),
            onChange: (checked) => {
              if (checked) state.categories.add(category.id);
              else state.categories.delete(category.id);
              state.page = 1;
              renderCategoryStrip();
              renderResults();
            }
          })
        );
      });
    }

    // Marcas
    const brandList = $("[data-filter-brands]");
    if (brandList) {
      brandList.textContent = "";
      const brandCounts = new Map();
      TPRO.getProducts().forEach((product) => {
        if (product.brand) brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
      });

      TPRO.getBrands().forEach((brand) => {
        brandList.appendChild(
          checkRow({
            label: brand,
            count: brandCounts.get(brand) || 0,
            checked: state.brands.has(brand),
            onChange: (checked) => {
              if (checked) state.brands.add(brand);
              else state.brands.delete(brand);
              state.page = 1;
              renderResults();
            }
          })
        );
      });
    }
  }

  function checkRow({ label, count, checked, onChange }) {
    const item = document.createElement("li");
    const wrapper = document.createElement("label");
    wrapper.className = "tp-check";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));

    const text = document.createElement("span");
    text.textContent = label;

    const badge = document.createElement("span");
    badge.className = "filters__count";
    badge.textContent = String(count);

    wrapper.append(input, text, badge);
    item.appendChild(wrapper);
    return item;
  }

  /** Reflete o estado nos controles (usado quando um filtro muda por outro caminho). */
  function syncFilterInputs() {
    const search = $("[data-search-input]");
    if (search && search.value !== state.search) search.value = state.search;

    const clear = $("[data-search-clear]");
    if (clear) clear.hidden = !state.search;

    const min = $("[data-price-min]");
    const max = $("[data-price-max]");
    if (min) min.value = state.priceMin ? state.priceMin / 100 : "";
    if (max) max.value = state.priceMax ? state.priceMax / 100 : "";

    const stock = $("[data-filter-stock]");
    const deal = $("[data-filter-deal]");
    if (stock) stock.checked = state.onlyStock;
    if (deal) deal.checked = state.onlyDeal;

    const sort = $("[data-sort]");
    if (sort) sort.value = state.sort;

    $$("[data-price-presets] .chip").forEach((chip) => {
      const [from, to] = chip.dataset.range.split("-").map(Number);
      const active = state.priceMin === (from || null) && state.priceMax === (to || null);
      chip.classList.toggle("is-active", active);
    });

    renderFilterLists();
    renderActiveChips();
    updateFilterCount();
  }

  function activeFilterCount() {
    return (
      state.categories.size +
      state.brands.size +
      (state.priceMin || state.priceMax ? 1 : 0) +
      (state.onlyStock ? 1 : 0) +
      (state.onlyDeal ? 1 : 0)
    );
  }

  function updateFilterCount() {
    const badge = $("[data-filter-count]");
    if (!badge) return;
    const count = activeFilterCount();
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }

  function renderActiveChips() {
    const box = $("[data-active-chips]");
    if (!box) return;

    box.textContent = "";

    const chips = [];

    if (state.search) {
      chips.push({ label: `Busca: "${state.search}"`, clear: () => (state.search = "") });
    }
    state.categories.forEach((id) => {
      chips.push({ label: TPRO.getCategoryName(id), clear: () => state.categories.delete(id) });
    });
    state.brands.forEach((brand) => {
      chips.push({ label: brand, clear: () => state.brands.delete(brand) });
    });
    if (state.priceMin || state.priceMax) {
      const from = state.priceMin ? TPRO.formatCurrency(state.priceMin) : "R$ 0";
      const to = state.priceMax ? TPRO.formatCurrency(state.priceMax) : "sem limite";
      chips.push({
        label: `${from} até ${to}`,
        clear: () => {
          state.priceMin = null;
          state.priceMax = null;
        }
      });
    }
    if (state.onlyStock) chips.push({ label: "Em estoque", clear: () => (state.onlyStock = false) });
    if (state.onlyDeal) chips.push({ label: "30% ou mais", clear: () => (state.onlyDeal = false) });

    chips.forEach((chip) => {
      const item = document.createElement("li");
      item.className = "active-chip";
      item.append(chip.label);

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Remover filtro ${chip.label}`);
      button.textContent = "✕";
      button.addEventListener("click", () => {
        chip.clear();
        state.page = 1;
        syncFilterInputs();
        renderCategoryStrip();
        renderResults();
      });

      item.appendChild(button);
      box.appendChild(item);
    });
  }

  function clearFilters() {
    state.search = "";
    state.categories.clear();
    state.brands.clear();
    state.priceMin = null;
    state.priceMax = null;
    state.onlyStock = false;
    state.onlyDeal = false;
    state.sort = "relevancia";
    state.page = 1;

    syncFilterInputs();
    renderCategoryStrip();
    renderResults();
  }


  /* ========================================================================
     05. CONSULTA
     ======================================================================== */

  function queryProducts() {
    const term = TPRO.normalize(state.search).trim();
    const words = term ? term.split(/\s+/) : [];

    let list = TPRO.getProducts().filter((product) => {
      if (state.categories.size && !state.categories.has(product.category)) return false;
      if (state.brands.size && !state.brands.has(product.brand)) return false;
      if (state.onlyStock && product.stock <= 0) return false;
      if (state.onlyDeal && TPRO.bestDiscountFor(product) < 0.3) return false;

      const price = TPRO.priceFor(product, state.planId);
      if (state.priceMin && price < state.priceMin) return false;
      if (state.priceMax && price > state.priceMax) return false;

      if (words.length) {
        const haystack = TPRO.normalize(
          [product.name, product.brand, product.sku, product.description, TPRO.getCategoryName(product.category)].join(" ")
        );
        // Todas as palavras precisam aparecer — busca mais previsível que "alguma palavra"
        if (!words.every((word) => haystack.includes(word))) return false;
      }

      return true;
    });

    const price = (product) => TPRO.priceFor(product, state.planId);

    const sorters = {
      relevancia: (a, b) =>
        Number(b.featured) - Number(a.featured) || b.rating - a.rating || (a.order || 0) - (b.order || 0),
      desconto: (a, b) => TPRO.bestDiscountFor(b) - TPRO.bestDiscountFor(a),
      "menor-preco": (a, b) => price(a) - price(b),
      "maior-preco": (a, b) => price(b) - price(a),
      avaliacao: (a, b) => b.rating - a.rating || b.reviews - a.reviews,
      nome: (a, b) => a.name.localeCompare(b.name, "pt-BR")
    };

    list = list.sort(sorters[state.sort] || sorters.relevancia);
    return list;
  }


  /* ========================================================================
     06. CARDS E PAGINAÇÃO
     ======================================================================== */

  const starsFor = (rating) => {
    const full = Math.round(rating);
    return "★★★★★".slice(0, full) + "☆☆☆☆☆".slice(0, 5 - full);
  };

  function stockInfo(product) {
    if (product.stock <= 0) return { text: "Sem estoque no momento", className: "is-out" };
    if (product.stock <= 10) return { text: `Últimas ${product.stock} unidades`, className: "is-low" };
    return { text: "Pronta entrega", className: "is-ok" };
  }

  function renderResults() {
    const grid = $("[data-product-grid]");
    const template = $("#tpl-card");
    const empty = $("[data-empty]");
    const countSlot = $("[data-results-count]");
    if (!grid || !template) return;

    const all = queryProducts();
    const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    state.page = Math.min(state.page, pages);

    const start = (state.page - 1) * PAGE_SIZE;
    const pageItems = all.slice(start, start + PAGE_SIZE);

    grid.textContent = "";
    pageItems.forEach((product) => grid.appendChild(buildCard(product, template)));

    if (empty) empty.hidden = all.length > 0;

    if (countSlot) {
      if (all.length === 0) {
        countSlot.textContent = "Nenhum produto encontrado";
      } else {
        const from = start + 1;
        const to = start + pageItems.length;
        countSlot.innerHTML = `Exibindo <strong>${from}–${to}</strong> de <strong>${all.length}</strong> produto${
          all.length > 1 ? "s" : ""
        }`;
      }
    }

    renderPagination(pages);
    renderActiveChips();
    updateFilterCount();
    writeUrl();
  }

  function buildCard(product, template) {
    const node = template.content.firstElementChild.cloneNode(true);

    const image = $(".product-card__img", node);
    image.src = product.images[0];
    image.alt = product.name;
    image.addEventListener("error", () => {
      image.src = TPRO.NO_IMAGE;
    }, { once: true });

    const price = TPRO.priceFor(product, state.planId);
    const savings = TPRO.savingsFor(product, state.planId);
    const isMember = state.planId !== "visitante" && savings > 0;

    // Selos sobre a imagem
    const flags = $('[data-field="flags"]', node);
    const best = TPRO.bestDiscountFor(product);
    if (isMember) {
      flags.appendChild(badge(`-${TPRO.formatPercent(TPRO.discountFor(product, state.planId))}`, "tp-badge--red"));
    } else if (best > 0) {
      flags.appendChild(badge(`membro paga -${TPRO.formatPercent(best)}`, "tp-badge--soft"));
    }
    if (product.featured) flags.appendChild(badge("Destaque", "tp-badge--blue"));

    $('[data-field="brand"]', node).textContent = product.brand || TPRO.getCategoryName(product.category);

    const nameLink = $('[data-field="name"]', node);
    nameLink.textContent = product.name;

    $('[data-field="stars"]', node).textContent = starsFor(product.rating);
    $('[data-field="reviews"]', node).textContent = `${product.rating.toFixed(1)} (${product.reviews})`;

    const oldSlot = $('[data-field="old"]', node);
    const oldWrapper = oldSlot.parentElement;
    if (isMember) {
      oldSlot.textContent = TPRO.formatCurrency(product.priceCents);
      oldWrapper.hidden = false;
    } else {
      oldWrapper.hidden = true;
    }

    const priceSlot = $('[data-field="price"]', node);
    priceSlot.textContent = TPRO.formatCurrency(price);
    priceSlot.classList.toggle("is-member", isMember);

    $('[data-field="save"]', node).textContent = isMember
      ? `Você economiza ${TPRO.formatCurrency(savings)}`
      : "";

    $('[data-field="installment"]', node).textContent = `ou ${INSTALLMENTS}x de ${TPRO.formatCurrency(
      Math.round(price / INSTALLMENTS)
    )}`;

    const stock = stockInfo(product);
    const stockSlot = $('[data-field="stock"]', node);
    stockSlot.textContent = stock.text;
    stockSlot.classList.add(stock.className);

    // Ações
    $$("[data-card-open]", node).forEach((trigger) => {
      if (trigger.tagName === "A") trigger.href = `?produto=${encodeURIComponent(product.id)}`;
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openProduct(product.id, trigger);
      });
    });

    const addBtn = $("[data-card-add]", node);
    if (product.stock <= 0) {
      addBtn.disabled = true;
      addBtn.textContent = "Indisponível";
    } else {
      addBtn.addEventListener("click", () => addToCart(product.id, 1));
    }

    return node;
  }

  function badge(text, className) {
    const span = document.createElement("span");
    span.className = `tp-badge ${className}`;
    span.textContent = text;
    return span;
  }

  function renderPagination(pages) {
    const box = $("[data-pagination]");
    if (!box) return;

    box.textContent = "";
    if (pages <= 1) return;

    const goTo = (page) => {
      state.page = page;
      renderResults();
      $("#catalogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const makeButton = (label, page, { disabled = false, current = false, ariaLabel } = {}) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "page-btn";
      button.textContent = label;
      button.disabled = disabled;
      if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
      if (current) button.setAttribute("aria-current", "page");
      if (!disabled && !current) button.addEventListener("click", () => goTo(page));
      box.appendChild(button);
    };

    makeButton("‹", state.page - 1, { disabled: state.page === 1, ariaLabel: "Página anterior" });

    // Janela de páginas em volta da atual, para não estourar a largura
    const from = Math.max(1, state.page - 2);
    const to = Math.min(pages, from + 4);
    for (let page = Math.max(1, to - 4); page <= to; page += 1) {
      makeButton(String(page), page, { current: page === state.page, ariaLabel: `Página ${page}` });
    }

    makeButton("›", state.page + 1, { disabled: state.page === pages, ariaLabel: "Próxima página" });
  }


  /* ========================================================================
     07. DETALHE DO PRODUTO
     ======================================================================== */

  function openProduct(productId, trigger) {
    const product = TPRO.getProductById(productId);
    if (!product) return;

    currentProduct = product;
    lastFocused = trigger || document.activeElement;

    fillProductModal(product);

    const modal = $("[data-product-modal]");
    modal.hidden = false;
    document.body.classList.add("is-locked");
    $("[data-pdp-add]", modal)?.focus();
  }

  function closeProduct() {
    const modal = $("[data-product-modal]");
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    currentProduct = null;
    // A gaveta do carrinho pode continuar aberta atrás do modal
    document.body.classList.toggle("is-locked", $("[data-cart-drawer]")?.hidden === false);

    if (lastFocused instanceof HTMLElement && lastFocused.isConnected) lastFocused.focus();
    lastFocused = null;
  }

  function fillProductModal(product) {
    const price = TPRO.priceFor(product, state.planId);
    const savings = TPRO.savingsFor(product, state.planId);
    const isMember = state.planId !== "visitante" && savings > 0;

    $("[data-pdp-brand]").textContent = product.brand || "TPRO CLUB";
    $("[data-pdp-category]").textContent = TPRO.getCategoryName(product.category);
    $("[data-pdp-name]").textContent = product.name;
    $("[data-pdp-stars]").textContent = starsFor(product.rating);
    $("[data-pdp-reviews]").textContent = `${product.rating.toFixed(1)} · ${product.reviews} avaliações`;
    $("[data-pdp-sku]").textContent = product.sku ? `Cód. ${product.sku}` : "";

    $("[data-pdp-old]").textContent = TPRO.formatCurrency(product.priceCents);
    $("[data-pdp-old]").parentElement.hidden = !isMember;
    $("[data-pdp-new]").textContent = TPRO.formatCurrency(price);
    $("[data-pdp-save]").textContent = isMember
      ? `Economia de ${TPRO.formatCurrency(savings)} (${TPRO.formatPercent(
          TPRO.discountFor(product, state.planId)
        )} de desconto)`
      : "";
    $("[data-pdp-installment]").textContent = `ou ${INSTALLMENTS}x de ${TPRO.formatCurrency(
      Math.round(price / INSTALLMENTS)
    )} sem juros`;

    const stock = stockInfo(product);
    const stockSlot = $("[data-pdp-stock]");
    stockSlot.textContent = stock.text;
    stockSlot.className = `pdp__stock product-card__stock ${stock.className}`;

    $("[data-pdp-desc]").textContent = product.description;

    // Galeria
    const stage = $("[data-pdp-image]");
    const thumbs = $("[data-pdp-thumbs]");
    const setImage = (src, index) => {
      stage.src = src;
      stage.alt = `${product.name} — imagem ${index + 1}`;
      $$(".pdp__thumb", thumbs).forEach((thumb, position) =>
        thumb.classList.toggle("is-active", position === index)
      );
    };

    thumbs.textContent = "";
    product.images.forEach((src, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pdp__thumb";
      button.setAttribute("aria-label", `Ver imagem ${index + 1}`);

      const image = document.createElement("img");
      image.src = src;
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

      button.appendChild(image);
      button.addEventListener("click", () => setImage(src, index));
      item.appendChild(button);
      thumbs.appendChild(item);
    });
    thumbs.hidden = product.images.length <= 1;

    stage.addEventListener("error", () => (stage.src = TPRO.NO_IMAGE), { once: true });
    setImage(product.images[0], 0);

    // Tabela de planos
    const tbody = $("[data-pdp-plans]");
    tbody.textContent = "";

    const rows = [
      { id: "visitante", name: "Sem clube" },
      ...TPRO.getPlans().map((plan) => ({ id: plan.id, name: plan.name }))
    ];

    rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.classList.toggle("is-current", row.id === state.planId);

      const th = document.createElement("th");
      th.scope = "row";
      th.className = "plan-table__name";
      th.textContent = row.name;

      const discount = document.createElement("td");
      const rate = TPRO.discountFor(product, row.id);
      discount.textContent = rate > 0 ? `-${TPRO.formatPercent(rate)}` : "—";

      const value = document.createElement("td");
      value.textContent = TPRO.formatCurrency(TPRO.priceFor(product, row.id));

      tr.append(th, discount, value);
      tbody.appendChild(tr);
    });

    // Quantidade e botão
    const qty = $("[data-pdp-qty]");
    qty.value = "1";

    const addBtn = $("[data-pdp-add]");
    addBtn.disabled = product.stock <= 0;
    addBtn.textContent = product.stock <= 0 ? "Produto indisponível" : "Adicionar ao carrinho";
  }

  function initProductModal() {
    const modal = $("[data-product-modal]");
    if (!modal) return;

    $$("[data-close-product]", modal).forEach((element) =>
      element.addEventListener("click", closeProduct)
    );

    const qty = $("[data-pdp-qty]", modal);
    const clampQty = () => {
      const value = Math.max(1, Math.min(99, Math.round(Number(qty.value) || 1)));
      qty.value = String(value);
      return value;
    };

    $("[data-pdp-minus]", modal).addEventListener("click", () => {
      qty.value = String(Math.max(1, clampQty() - 1));
    });
    $("[data-pdp-plus]", modal).addEventListener("click", () => {
      qty.value = String(Math.min(99, clampQty() + 1));
    });
    qty.addEventListener("change", clampQty);

    $("[data-pdp-add]", modal).addEventListener("click", () => {
      if (!currentProduct) return;
      addToCart(currentProduct.id, clampQty());
      closeProduct();
    });
  }


  /* ========================================================================
     08. CARRINHO
     ======================================================================== */

  function addToCart(productId, qty) {
    TPRO.cart.add(productId, qty);
    renderCart();

    const button = $("[data-open-cart]");
    button?.classList.add("is-bumping");
    window.setTimeout(() => button?.classList.remove("is-bumping"), 400);

    const product = TPRO.getProductById(productId);
    toast(`${product?.name || "Produto"} adicionado ao carrinho.`, "success");
  }

  function openCart() {
    const drawer = $("[data-cart-drawer]");
    if (!drawer) return;
    renderCart();
    drawer.hidden = false;
    document.body.classList.add("is-locked");
    $("[data-close-cart]", drawer)?.focus();
  }

  function closeCart() {
    const drawer = $("[data-cart-drawer]");
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    document.body.classList.toggle("is-locked", $("[data-product-modal]")?.hidden === false);
    $("[data-open-cart]")?.focus();
  }

  function renderCart() {
    const list = $("[data-cart-list]");
    const template = $("#tpl-cart-item");
    const empty = $("[data-cart-empty]");
    const foot = $("[data-cart-foot]");
    const countBadge = $("[data-cart-count]");
    if (!list || !template) return;

    const items = TPRO.cart.items();
    const count = TPRO.cart.count();

    if (countBadge) {
      countBadge.textContent = String(count);
      countBadge.hidden = count === 0;
    }

    list.textContent = "";

    items.forEach((item) => {
      const product = TPRO.getProductById(item.id);
      if (!product) return;

      const node = template.content.firstElementChild.cloneNode(true);
      const unitPrice = TPRO.priceFor(product, state.planId);

      const image = $(".cart-item__img", node);
      image.src = product.images[0];
      image.alt = product.name;
      image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

      $('[data-field="name"]', node).textContent = product.name;
      $('[data-field="unit"]', node).textContent = `${TPRO.formatCurrency(unitPrice)} cada`;
      $('[data-field="total"]', node).textContent = TPRO.formatCurrency(unitPrice * item.qty);

      const qty = $("[data-cart-qty]", node);
      qty.value = String(item.qty);

      const setQty = (value) => {
        TPRO.cart.setQty(item.id, value);
        renderCart();
      };

      $("[data-cart-minus]", node).addEventListener("click", () => setQty(item.qty - 1));
      $("[data-cart-plus]", node).addEventListener("click", () => setQty(item.qty + 1));
      qty.addEventListener("change", () => setQty(Number(qty.value) || 1));

      $("[data-cart-remove]", node).addEventListener("click", () => {
        TPRO.cart.remove(item.id);
        renderCart();
        toast(`${product.name} removido do carrinho.`);
      });

      list.appendChild(node);
    });

    if (empty) empty.hidden = items.length > 0;
    if (foot) foot.hidden = items.length === 0;

    const totals = TPRO.cart.totals(state.planId);
    const planLabel = state.planId === "visitante" ? "" : TPRO.getPlanById(state.planId)?.name || "";

    const set = (selector, value) => {
      const slot = $(selector);
      if (slot) slot.textContent = value;
    };

    set("[data-cart-full]", TPRO.formatCurrency(totals.fullCents));
    set("[data-cart-savings]", `− ${TPRO.formatCurrency(totals.savingsCents)}`);
    set("[data-cart-total]", TPRO.formatCurrency(totals.totalCents));
    set("[data-cart-plan-label]", planLabel);
  }

  function initCart() {
    $("[data-open-cart]")?.addEventListener("click", openCart);
    $$("[data-close-cart]").forEach((element) => element.addEventListener("click", closeCart));

    $("[data-clear-cart]")?.addEventListener("click", () => {
      TPRO.cart.clear();
      renderCart();
      toast("Carrinho esvaziado.");
    });

    $("[data-checkout]")?.addEventListener("click", () => {
      const totals = TPRO.cart.totals(state.planId);
      notice({
        eyebrow: "Demonstração",
        title: "Pedido simulado com sucesso",
        text: `Seriam ${totals.items} item(ns) por ${TPRO.formatCurrency(
          totals.totalCents
        )}, com ${TPRO.formatCurrency(
          totals.savingsCents
        )} de economia. O fechamento do pedido e o pagamento serão conectados na próxima etapa do projeto.`
      });
    });
  }


  /* ========================================================================
     09. AVISOS E TOASTS
     ======================================================================== */

  function toast(message, type = "") {
    const box = $("[data-toasts]");
    if (!box) return;

    const item = document.createElement("div");
    item.className = `tp-toast${type ? ` tp-toast--${type}` : ""}`;
    item.setAttribute("role", "status");
    item.textContent = message;
    box.appendChild(item);

    window.setTimeout(() => {
      item.classList.add("is-leaving");
      item.addEventListener("animationend", () => item.remove(), { once: true });
    }, 2600);
  }

  function notice({ eyebrow = "TPRO CLUB", title, text }) {
    const modal = $("[data-notice-modal]");
    if (!modal) return;

    $("[data-notice-eyebrow]", modal).textContent = eyebrow;
    $("[data-notice-title]", modal).textContent = title;
    $("[data-notice-text]", modal).textContent = text;

    modal.hidden = false;
    $("[data-close-notice]", modal)?.focus();
  }

  function initNotice() {
    const modal = $("[data-notice-modal]");
    if (!modal) return;
    $$("[data-close-notice]", modal).forEach((element) =>
      element.addEventListener("click", () => (modal.hidden = true))
    );
  }


  /* ========================================================================
     10. INICIALIZAÇÃO
     ======================================================================== */

  function initSearch() {
    const form = $("[data-search-form]");
    const input = $("[data-search-input]");
    const clear = $("[data-search-clear]");
    if (!form || !input) return;

    let timer = 0;
    const apply = () => {
      state.search = input.value.trim();
      state.page = 1;
      if (clear) clear.hidden = !state.search;
      renderResults();
    };

    input.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(apply, 220);
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      window.clearTimeout(timer);
      apply();
      input.blur();
    });

    clear?.addEventListener("click", () => {
      input.value = "";
      apply();
      input.focus();
    });
  }

  function initFilterControls() {
    const min = $("[data-price-min]");
    const max = $("[data-price-max]");

    const applyPrice = () => {
      const minValue = Number(min?.value);
      const maxValue = Number(max?.value);
      state.priceMin = Number.isFinite(minValue) && minValue > 0 ? Math.round(minValue * 100) : null;
      state.priceMax = Number.isFinite(maxValue) && maxValue > 0 ? Math.round(maxValue * 100) : null;
      state.page = 1;
      syncFilterInputs();
      renderResults();
    };

    min?.addEventListener("change", applyPrice);
    max?.addEventListener("change", applyPrice);

    $$("[data-price-presets] .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const [from, to] = chip.dataset.range.split("-").map(Number);
        const alreadyActive = state.priceMin === (from || null) && state.priceMax === (to || null);

        state.priceMin = alreadyActive ? null : from || null;
        state.priceMax = alreadyActive ? null : to || null;
        state.page = 1;
        syncFilterInputs();
        renderResults();
      });
    });

    $("[data-filter-stock]")?.addEventListener("change", (event) => {
      state.onlyStock = event.target.checked;
      state.page = 1;
      renderResults();
      renderActiveChips();
      updateFilterCount();
    });

    $("[data-filter-deal]")?.addEventListener("change", (event) => {
      state.onlyDeal = event.target.checked;
      state.page = 1;
      renderResults();
      renderActiveChips();
      updateFilterCount();
    });

    $("[data-sort]")?.addEventListener("change", (event) => {
      state.sort = event.target.value;
      state.page = 1;
      renderResults();
    });

    $$("[data-clear-filters]").forEach((button) => button.addEventListener("click", clearFilters));

    // Painel de filtros no mobile
    const panel = $("[data-filters]");
    $("[data-open-filters]")?.addEventListener("click", () => {
      panel?.classList.add("is-open");
      document.body.classList.add("is-locked");
      $("[data-close-filters]", panel)?.focus();
    });
    $$("[data-close-filters]").forEach((button) =>
      button.addEventListener("click", () => {
        panel?.classList.remove("is-open");
        document.body.classList.remove("is-locked");
      })
    );
  }

  function initHeaderScroll() {
    const header = $("[data-header]");
    if (!header) return;

    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
          header.classList.toggle("is-scrolled", window.scrollY > 8);
          ticking = false;
        });
      },
      { passive: true }
    );
  }

  function initEscape() {
    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if ($("[data-product-modal]")?.hidden === false) closeProduct();
      else if ($("[data-cart-drawer]")?.hidden === false) closeCart();
      else if ($("[data-notice-modal]")?.hidden === false) $("[data-notice-modal]").hidden = true;
      else if ($("[data-filters]")?.classList.contains("is-open")) {
        $("[data-filters]").classList.remove("is-open");
        document.body.classList.remove("is-locked");
      }
    });
  }

  function init() {
    readUrl();

    renderPlanSwitch();
    renderCategoryStrip();
    syncFilterInputs();
    renderResults();
    renderCart();

    initSearch();
    initFilterControls();
    initProductModal();
    initCart();
    initNotice();
    initHeaderScroll();
    initEscape();

    const year = $("[data-current-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    // Link direto para um produto: loja.html?produto=maquina-corte
    const requested = new URLSearchParams(window.location.search).get("produto");
    if (requested) openProduct(requested);

    // O painel administrativo pode estar aberto em outra aba: refletir na hora
    TPRO.on("change", () => {
      renderPlanSwitch();
      renderCategoryStrip();
      syncFilterInputs();
      renderResults();
      renderCart();
      toast("Catálogo atualizado pelo painel administrativo.");
    });

    TPRO.on("error", (payload) => toast(payload.message, "error"));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
