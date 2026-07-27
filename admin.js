/* ==========================================================================
   TPRO CLUB — Painel administrativo

   Todas as alterações passam por window.TPRO (data.js). A loja aberta em
   outra aba escuta esses mesmos dados e se atualiza sozinha.

   Sumário
   01. Atalhos e estado
   02. Entrada (login demonstrativo)
   03. Navegação entre seções
   04. Visão geral
   04b. Membros do clube
   05. Produtos (tabela)
   06. Ficha do produto
   07. Imagens
   08. Categorias
   09. Planos
   10. Dados e backup
   11. Confirmação e toasts
   12. Inicialização
   ========================================================================== */

(() => {
  "use strict";

  const TPRO = window.TPRO;
  if (!TPRO) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  /* Credenciais apenas da demonstração — a autenticação real vem com o backend. */
  const DEMO_USER = "admin";
  const DEMO_PASS = "tpro2026";

  /* Imagem enviada é reduzida antes de virar base64 para não estourar o storage. */
  const IMAGE_MAX_SIDE = 900;
  const IMAGE_QUALITY = 0.72;

  const VIEWS = {
    painel: { title: "Visão geral", sub: "Resumo do catálogo do clube" },
    produtos: { title: "Produtos", sub: "Cadastre, edite e defina o desconto de cada item" },
    membros: { title: "Membros do clube", sub: "Assinantes por plano, data de entrada e vencimento" },
    categorias: { title: "Categorias", sub: "Organize o catálogo por tipo de produto" },
    planos: { title: "Planos e descontos", sub: "Preço da assinatura e desconto padrão de cada nível" },
    dados: { title: "Dados e backup", sub: "Exportar, importar e restaurar o catálogo" }
  };

  const filters = { search: "", category: "", status: "" };
  const memberFilters = { plan: "", status: "" };

  /** Rascunho da ficha aberta: imagens ainda não salvas ficam aqui. */
  let draftImages = [];
  let editingId = null;
  let confirmAction = null;
  let lastFocused = null;


  /* ========================================================================
     02. ENTRADA
     ======================================================================== */

  function isLogged() {
    return window.sessionStorage.getItem(TPRO.KEYS.admin) === "1";
  }

  function showLogin() {
    $("[data-login]").hidden = false;
    $("[data-shell]").hidden = true;
    $("#login-pass")?.focus();
  }

  function showShell() {
    $("[data-login]").hidden = true;
    $("[data-shell]").hidden = false;
    renderAll();
  }

  function initLogin() {
    const form = $("[data-login-form]");
    const error = $("[data-login-error]");

    form?.addEventListener("submit", (event) => {
      event.preventDefault();

      const user = $("#login-user").value.trim();
      const pass = $("#login-pass").value;

      if (user === DEMO_USER && pass === DEMO_PASS) {
        window.sessionStorage.setItem(TPRO.KEYS.admin, "1");
        error.textContent = "";
        showShell();
        toast("Bem-vindo ao painel do TPRO CLUB.", "success");
      } else {
        error.textContent = "Usuário ou senha incorretos. Use admin / tpro2026 nesta demonstração.";
        $("#login-pass").select();
      }
    });

    $("[data-logout]")?.addEventListener("click", () => {
      window.sessionStorage.removeItem(TPRO.KEYS.admin);
      $("#login-pass").value = "";
      showLogin();
    });
  }


  /* ========================================================================
     03. NAVEGAÇÃO
     ======================================================================== */

  function goToView(name) {
    if (!VIEWS[name]) return;

    $$("[data-view]").forEach((view) => {
      view.hidden = view.dataset.view !== name;
      view.classList.toggle("is-active", view.dataset.view === name);
    });

    $$("[data-view-link]").forEach((link) =>
      link.classList.toggle("is-active", link.dataset.viewLink === name)
    );

    $("[data-view-title]").textContent = VIEWS[name].title;
    $("[data-view-sub]").textContent = VIEWS[name].sub;

    closeSide();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSide() {
    $("[data-side]")?.classList.add("is-open");
    const overlay = $(".side__overlay");
    if (overlay) overlay.hidden = false;
  }

  function closeSide() {
    $("[data-side]")?.classList.remove("is-open");
    const overlay = $(".side__overlay");
    if (overlay) overlay.hidden = true;
  }

  function initNav() {
    $$("[data-view-link]").forEach((link) =>
      link.addEventListener("click", () => goToView(link.dataset.viewLink))
    );

    $("[data-open-side]")?.addEventListener("click", openSide);
    $$("[data-close-side]").forEach((element) => element.addEventListener("click", closeSide));
  }


  /* ========================================================================
     04. VISÃO GERAL
     ======================================================================== */

  function renderDashboard() {
    const products = TPRO.getAllProducts();
    const active = products.filter((product) => product.active);
    const outOfStock = products.filter((product) => product.stock <= 0);

    const stockValueCents = products.reduce(
      (total, product) => total + product.priceCents * product.stock,
      0
    );

    const averageDiscount = active.length
      ? active.reduce((total, product) => total + TPRO.bestDiscountFor(product), 0) / active.length
      : 0;

    const kpis = [
      { label: "Produtos cadastrados", value: String(products.length), hint: `${active.length} ativos na loja` },
      { label: "Categorias", value: String(TPRO.getCategories().length), hint: "usadas para filtrar a loja" },
      {
        label: "Sem estoque",
        value: String(outOfStock.length),
        hint: outOfStock.length ? "revisar reposição" : "tudo disponível",
        variant: outOfStock.length ? "kpi--red" : ""
      },
      {
        label: "Desconto médio (maior nível)",
        value: TPRO.formatPercent(averageDiscount),
        hint: "média entre os produtos ativos"
      },
      {
        label: "Valor do estoque",
        value: TPRO.formatCurrency(stockValueCents),
        hint: "preço cheio × unidades",
        // Valor em reais não cabe em meia linha no celular (ver admin.css)
        variant: "kpi--wide"
      }
    ];

    const box = $("[data-kpis]");
    box.textContent = "";
    kpis.forEach((kpi) => {
      const item = document.createElement("li");
      item.className = `kpi ${kpi.variant || ""}`.trim();
      item.innerHTML = `
        <p class="kpi__label">${escapeHtml(kpi.label)}</p>
        <p class="kpi__value">${escapeHtml(kpi.value)}</p>
        <p class="kpi__hint">${escapeHtml(kpi.hint)}</p>`;
      box.appendChild(item);
    });

    // Estoque baixo
    const low = products
      .filter((product) => product.stock <= 10)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 6);
    fillMiniList($("[data-low-stock]"), low, (product) =>
      product.stock === 0 ? "Sem estoque" : `${product.stock} un.`
    );

    // Maiores descontos
    const top = products
      .filter((product) => product.active)
      .sort((a, b) => TPRO.bestDiscountFor(b) - TPRO.bestDiscountFor(a))
      .slice(0, 6);
    fillMiniList($("[data-top-discounts]"), top, (product) => `-${TPRO.formatPercent(TPRO.bestDiscountFor(product))}`);

    // Produtos por categoria
    const chart = $("[data-category-chart]");
    chart.textContent = "";
    const counts = TPRO.getCategories()
      .map((category) => ({ name: category.name, count: TPRO.countProductsInCategory(category.id) }))
      .sort((a, b) => b.count - a.count);
    const max = Math.max(1, ...counts.map((item) => item.count));

    counts.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${escapeHtml(item.name)}</span>
        <span class="bar-list__track"><span class="bar-list__fill" style="width:${(item.count / max) * 100}%"></span></span>
        <span class="bar-list__value">${item.count}</span>`;
      chart.appendChild(li);
    });

    // Contadores da barra lateral
    $("[data-side-count-products]").textContent = String(products.length);
    $("[data-side-count-categories]").textContent = String(TPRO.getCategories().length);
  }

  function fillMiniList(list, products, valueFn) {
    if (!list) return;
    list.textContent = "";

    if (!products.length) {
      const empty = document.createElement("li");
      empty.className = "mini-list__empty";
      empty.textContent = "Nada por aqui.";
      list.appendChild(empty);
      return;
    }

    products.forEach((product) => {
      const item = document.createElement("li");

      const image = document.createElement("img");
      image.src = product.images[0];
      image.alt = "";
      image.loading = "lazy";
      image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

      const name = document.createElement("span");
      name.className = "mini-list__name";
      name.textContent = product.name;

      const value = document.createElement("span");
      value.className = "tp-badge tp-badge--soft";
      value.textContent = valueFn(product);

      item.append(image, name, value);
      list.appendChild(item);
    });
  }


  /* ========================================================================
     04b. MEMBROS DO CLUBE
     ------------------------------------------------------------------------
     A caixa da visão geral conta os assinantes de cada tipo de assinatura e
     leva para esta seção, que lista nome, entrada e vencimento.
     ======================================================================== */

  const MEMBER_STATUS = {
    ativo: { label: "Em dia", badge: "tp-badge--success" },
    vencendo: { label: "Renovar", badge: "tp-badge--warning" },
    vencido: { label: "Vencida", badge: "tp-badge--red" }
  };

  /** Caixa clicável da visão geral. */
  function renderMembersCard() {
    const summary = TPRO.getMemberSummary();

    const total = $("[data-members-total]");
    if (total) total.textContent = String(summary.total);

    const hint = $("[data-members-hint]");
    if (hint) {
      // O aviso mais urgente primeiro: vencida > a vencer > tudo em dia
      if (summary.expired) {
        hint.textContent = `${summary.expired} assinatura(s) vencida(s) — clique para ver quem é`;
      } else if (summary.expiring) {
        hint.textContent = `${summary.expiring} assinatura(s) vencem nos próximos 30 dias`;
      } else {
        hint.textContent = "todas as assinaturas em dia";
      }
    }

    const plans = $("[data-members-by-plan]");
    if (plans) {
      plans.textContent = "";
      summary.byPlan.forEach((plan) => {
        const pill = document.createElement("span");
        pill.className = "member-pill";
        pill.innerHTML = `<strong>${plan.count}</strong> ${escapeHtml(plan.name)}`;
        plans.appendChild(pill);
      });
    }

    const badge = $("[data-side-count-members]");
    if (badge) badge.textContent = String(summary.total);
  }

  function renderMembers() {
    renderMembersCard();
    fillMemberPlanSelect();
    renderMemberKpis();
    renderMembersTable();
  }

  /** Opções do filtro por assinatura, geradas a partir dos planos cadastrados. */
  function fillMemberPlanSelect() {
    const select = $("[data-member-plan]");
    if (!select) return;

    const current = select.value;
    select.textContent = "";

    const all = document.createElement("option");
    all.value = "";
    all.textContent = "Todas as assinaturas";
    select.appendChild(all);

    TPRO.getPlans().forEach((plan) => {
      const option = document.createElement("option");
      option.value = plan.id;
      option.textContent = `Assinatura ${plan.name}`;
      select.appendChild(option);
    });

    select.value = current;
    if (select.value !== current) memberFilters.plan = select.value;
  }

  function renderMemberKpis() {
    const box = $("[data-member-kpis]");
    if (!box) return;

    const summary = TPRO.getMemberSummary();

    const cards = [
      { label: "Total de membros", value: String(summary.total), hint: "assinantes no clube" },
      ...summary.byPlan.map((plan) => ({
        label: `Assinatura ${plan.name}`,
        value: String(plan.count),
        hint: summary.total ? `${Math.round((plan.count / summary.total) * 100)}% do clube` : "sem membros"
      })),
      {
        label: "Precisam renovar",
        value: String(summary.expiring + summary.expired),
        hint: `${summary.expired} vencida(s) · ${summary.expiring} a vencer`,
        variant: summary.expiring + summary.expired ? "kpi--red" : ""
      }
    ];

    box.textContent = "";
    cards.forEach((card) => {
      const item = document.createElement("li");
      item.className = `kpi ${card.variant || ""}`.trim();
      item.innerHTML = `
        <p class="kpi__label">${escapeHtml(card.label)}</p>
        <p class="kpi__value">${escapeHtml(card.value)}</p>
        <p class="kpi__hint">${escapeHtml(card.hint)}</p>`;
      box.appendChild(item);
    });
  }

  function renderMembersTable() {
    const body = $("[data-member-rows]");
    const empty = $("[data-member-empty]");
    const count = $("[data-member-count]");
    if (!body) return;

    const rows = TPRO.getMembers().filter((member) => {
      if (memberFilters.plan && member.plan !== memberFilters.plan) return false;
      if (memberFilters.status && member.status !== memberFilters.status) return false;
      return true;
    });

    body.textContent = "";
    if (empty) empty.hidden = rows.length > 0;
    if (count) {
      count.textContent = rows.length === 1 ? "1 assinante" : `${rows.length} assinantes`;
    }

    rows.forEach((member) => body.appendChild(buildMemberRow(member)));
  }

  function buildMemberRow(member) {
    const tr = document.createElement("tr");
    const status = MEMBER_STATUS[member.status] || MEMBER_STATUS.ativo;
    const plan = TPRO.getPlanById(member.plan);

    // Nome
    const tdName = document.createElement("td");
    tdName.dataset.label = "Assinante";
    const name = document.createElement("p");
    name.className = "cell-product__name";
    name.textContent = member.name;
    tdName.appendChild(name);

    // Assinatura
    const tdPlan = document.createElement("td");
    tdPlan.dataset.label = "Assinatura";
    const planBadge = document.createElement("span");
    planBadge.className = "tp-badge tp-badge--soft";
    planBadge.textContent = plan ? plan.name : member.plan;
    tdPlan.appendChild(planBadge);

    // Data de inscrição
    const tdJoined = document.createElement("td");
    tdJoined.dataset.label = "Entrou em";
    tdJoined.className = "cell-price";
    tdJoined.textContent = TPRO.formatDate(member.joinedAt);

    // Data de vencimento
    const tdExpires = document.createElement("td");
    tdExpires.dataset.label = "Vence em";
    tdExpires.className = "cell-price";
    tdExpires.textContent = TPRO.formatDate(member.expiresAt);

    // Situação
    const tdStatus = document.createElement("td");
    tdStatus.dataset.label = "Situação";
    const statusBadge = document.createElement("span");
    statusBadge.className = `tp-badge ${status.badge}`;
    statusBadge.textContent = status.label;
    statusBadge.title = member.daysLeft < 0
      ? `Venceu há ${Math.abs(member.daysLeft)} dia(s)`
      : `Faltam ${member.daysLeft} dia(s)`;
    tdStatus.appendChild(statusBadge);

    tr.append(tdName, tdPlan, tdJoined, tdExpires, tdStatus);
    return tr;
  }

  function initMemberFilters() {
    $("[data-member-plan]")?.addEventListener("change", (event) => {
      memberFilters.plan = event.target.value;
      renderMembersTable();
    });

    $("[data-member-status]")?.addEventListener("change", (event) => {
      memberFilters.status = event.target.value;
      renderMembersTable();
    });
  }


  /* ========================================================================
     05. PRODUTOS (TABELA)
     ======================================================================== */

  function renderProductsTable() {
    const body = $("[data-product-rows]");
    const empty = $("[data-product-empty]");
    if (!body) return;

    const term = TPRO.normalize(filters.search).trim();

    const rows = TPRO.getAllProducts().filter((product) => {
      if (filters.category && product.category !== filters.category) return false;
      if (filters.status === "ativo" && !product.active) return false;
      if (filters.status === "inativo" && product.active) return false;
      if (filters.status === "sem-estoque" && product.stock > 0) return false;

      if (term) {
        const haystack = TPRO.normalize(`${product.name} ${product.brand} ${product.sku}`);
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    body.textContent = "";
    if (empty) empty.hidden = rows.length > 0;

    rows.forEach((product) => body.appendChild(buildProductRow(product)));
  }

  function buildProductRow(product) {
    const tr = document.createElement("tr");
    tr.classList.toggle("is-inactive", !product.active);

    // Produto
    const tdProduct = document.createElement("td");
    tdProduct.dataset.label = "Produto";
    const cell = document.createElement("div");
    cell.className = "cell-product";

    const image = document.createElement("img");
    image.src = product.images[0];
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

    const info = document.createElement("div");
    const name = document.createElement("p");
    name.className = "cell-product__name";
    name.textContent = product.name;

    const meta = document.createElement("p");
    meta.className = "cell-product__meta";
    meta.textContent = [product.brand, product.sku && `Cód. ${product.sku}`, `${product.images.length} imagem(ns)`]
      .filter(Boolean)
      .join(" · ");

    info.append(name, meta);
    cell.append(image, info);
    tdProduct.appendChild(cell);

    // Categoria
    const tdCategory = document.createElement("td");
    tdCategory.dataset.label = "Categoria";
    tdCategory.textContent = TPRO.getCategoryName(product.category);

    // Preço
    const tdPrice = document.createElement("td");
    tdPrice.dataset.label = "Preço cheio";
    tdPrice.className = "cell-price";
    tdPrice.textContent = TPRO.formatCurrency(product.priceCents);

    // Descontos
    const tdDiscounts = document.createElement("td");
    tdDiscounts.dataset.label = "Descontos";
    const discounts = document.createElement("div");
    discounts.className = "cell-discounts";
    TPRO.getPlans().forEach((plan) => {
      const own = typeof product.discounts[plan.id] === "number";
      const pill = document.createElement("span");
      pill.className = `disc-pill${own ? " disc-pill--own" : ""}`;
      pill.textContent = `${plan.name} ${TPRO.formatPercent(TPRO.discountFor(product, plan.id))}`;
      pill.title = own ? "Percentual próprio deste produto" : `Desconto padrão do plano ${plan.name}`;
      discounts.appendChild(pill);
    });
    tdDiscounts.appendChild(discounts);

    // Estoque
    const tdStock = document.createElement("td");
    tdStock.dataset.label = "Estoque";
    const stockBadge = document.createElement("span");
    stockBadge.className =
      product.stock <= 0 ? "tp-badge tp-badge--warning" : "tp-badge tp-badge--muted";
    stockBadge.textContent = product.stock <= 0 ? "Zerado" : `${product.stock} un.`;
    tdStock.appendChild(stockBadge);

    // Situação
    const tdStatus = document.createElement("td");
    tdStatus.dataset.label = "Situação";
    const statusBadge = document.createElement("span");
    statusBadge.className = product.active ? "tp-badge tp-badge--success" : "tp-badge tp-badge--muted";
    statusBadge.textContent = product.active ? "Ativo" : "Inativo";
    tdStatus.appendChild(statusBadge);
    if (product.featured) {
      const featured = document.createElement("span");
      featured.className = "tp-badge tp-badge--blue";
      featured.style.marginLeft = "4px";
      featured.textContent = "Destaque";
      tdStatus.appendChild(featured);
    }

    // Ações
    const tdActions = document.createElement("td");
    tdActions.dataset.label = "Ações";
    const actions = document.createElement("div");
    actions.className = "cell-actions";

    actions.append(
      iconButton("Editar", "M4 20h4l10-10-4-4L4 16v4z M13.5 6.5l4 4", () => openProductForm(product.id)),
      iconButton(
        product.active ? "Desativar na loja" : "Ativar na loja",
        product.active ? "M3 12h18 M12 3v18" : "M5 12l5 5L20 7",
        () => {
          TPRO.toggleProductActive(product.id);
          renderAll();
          toast(product.active ? `${product.name} saiu da loja.` : `${product.name} está na loja.`, "success");
        }
      ),
      iconButton("Duplicar", "M8 8h11v11H8z M5 16V5h11", () => {
        const copy = TPRO.duplicateProduct(product.id);
        renderAll();
        if (copy) {
          toast("Cópia criada como inativa. Ajuste e ative quando quiser.", "success");
          openProductForm(copy.id);
        }
      }),
      iconButton(
        "Excluir",
        "M5 7h14 M10 7V5h4v2 M8 7l1 12h6l1-12",
        () =>
          confirmDialog({
            title: "Excluir produto",
            text: `"${product.name}" será removido do catálogo. Essa ação não pode ser desfeita.`,
            onConfirm: () => {
              TPRO.deleteProduct(product.id);
              renderAll();
              toast("Produto excluído.", "success");
            }
          }),
        true
      )
    );

    tdActions.appendChild(actions);

    tr.append(tdProduct, tdCategory, tdPrice, tdDiscounts, tdStock, tdStatus, tdActions);
    return tr;
  }

  function iconButton(label, path, onClick, danger = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-btn${danger ? " icon-btn--danger" : ""}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
    button.addEventListener("click", onClick);
    return button;
  }

  function initProductFilters() {
    let timer = 0;
    $("[data-admin-search]")?.addEventListener("input", (event) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        filters.search = event.target.value;
        renderProductsTable();
      }, 200);
    });

    $("[data-admin-category]")?.addEventListener("change", (event) => {
      filters.category = event.target.value;
      renderProductsTable();
    });

    $("[data-admin-status]")?.addEventListener("change", (event) => {
      filters.status = event.target.value;
      renderProductsTable();
    });
  }

  function fillCategorySelects() {
    const categories = TPRO.getCategories();

    const filterSelect = $("[data-admin-category]");
    if (filterSelect) {
      const current = filterSelect.value;
      filterSelect.textContent = "";
      filterSelect.appendChild(new Option("Todas as categorias", ""));
      categories.forEach((category) => filterSelect.appendChild(new Option(category.name, category.id)));
      filterSelect.value = current;
    }

    const formSelect = $('[data-field="category"]');
    if (formSelect) {
      const current = formSelect.value;
      formSelect.textContent = "";
      categories.forEach((category) => formSelect.appendChild(new Option(category.name, category.id)));
      if (current) formSelect.value = current;
    }

    const brands = $("[data-brand-options]");
    if (brands) {
      brands.textContent = "";
      TPRO.getBrands().forEach((brand) => brands.appendChild(new Option(brand)));
    }
  }


  /* ========================================================================
     06. FICHA DO PRODUTO
     ======================================================================== */

  function openProductForm(productId = null) {
    editingId = productId;
    lastFocused = document.activeElement;

    fillCategorySelects();

    const product = productId ? TPRO.getProductById(productId) : null;
    const form = $("[data-product-form]");

    $("[data-form-title]").textContent = product ? "Editar produto" : "Novo produto";

    const set = (field, value) => {
      const input = $(`[data-field="${field}"]`, form);
      if (!input) return;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value ?? "";
    };

    set("id", product?.id || "");
    set("name", product?.name || "");
    set("brand", product?.brand || "");
    set("sku", product?.sku || "");
    set("category", product?.category || TPRO.getCategories()[0]?.id);
    set("stock", product ? product.stock : 0);
    set("description", product?.description || "");
    set("price", product ? (product.priceCents / 100).toFixed(2).replace(".", ",") : "");
    set("active", product ? product.active : true);
    set("featured", product ? product.featured : false);

    // Imagens padrão do produto ficam de fora do rascunho quando é um item novo
    draftImages = product ? product.images.slice() : [];
    renderImageList();

    renderDiscountFields(product);
    updateDescCount();
    clearErrors();
    updatePricePreview();

    const modal = $("[data-product-modal]");
    modal.hidden = false;
    document.body.classList.add("is-locked");
    $("#p-nome")?.focus();
  }

  function closeProductForm() {
    const modal = $("[data-product-modal]");
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    document.body.classList.remove("is-locked");
    draftImages = [];
    editingId = null;

    if (lastFocused instanceof HTMLElement && lastFocused.isConnected) lastFocused.focus();
    lastFocused = null;
  }

  /** Um cartão por plano, com o percentual do produto (ou o padrão do plano). */
  function renderDiscountFields(product) {
    const grid = $("[data-discount-grid]");
    if (!grid) return;

    grid.textContent = "";

    TPRO.getPlans().forEach((plan) => {
      const own = product && typeof product.discounts[plan.id] === "number" ? product.discounts[plan.id] : null;

      const item = document.createElement("li");
      item.className = "disc-card";
      item.innerHTML = `
        <p class="disc-card__name">
          ${escapeHtml(plan.name)}
          <span class="tp-badge tp-badge--muted">padrão ${TPRO.formatPercent(plan.defaultDiscount)}</span>
        </p>
        <div class="disc-card__input">
          <input class="tp-input" type="text" inputmode="decimal" data-discount="${plan.id}"
                 placeholder="${(plan.defaultDiscount * 100).toFixed(0)}"
                 aria-label="Desconto do plano ${escapeHtml(plan.name)} em porcentagem">
          <span class="disc-card__suffix">%</span>
        </div>
        <p class="disc-card__result" data-discount-result="${plan.id}"></p>`;

      const input = $(`[data-discount="${plan.id}"]`, item);
      if (own !== null) input.value = String(Math.round(own * 1000) / 10).replace(".", ",");
      input.addEventListener("input", updatePricePreview);

      grid.appendChild(item);
    });
  }

  /** Mostra, ao vivo, quanto cada plano vai pagar com o que está digitado. */
  function updatePricePreview() {
    const form = $("[data-product-form]");
    if (!form) return;

    const priceCents = TPRO.parseMoneyToCents($('[data-field="price"]', form).value);

    TPRO.getPlans().forEach((plan) => {
      const input = $(`[data-discount="${plan.id}"]`, form);
      const result = $(`[data-discount-result="${plan.id}"]`, form);
      if (!input || !result) return;

      const typed = input.value.trim();
      const rate = typed === "" ? plan.defaultDiscount : TPRO.parsePercentToRate(typed) ?? plan.defaultDiscount;
      const final = Math.round(priceCents * (1 - rate));

      result.innerHTML = priceCents
        ? `Membro paga <strong>${TPRO.formatCurrency(final)}</strong><br>economia de ${TPRO.formatCurrency(
            priceCents - final
          )}`
        : "Informe o preço cheio para ver o resultado.";
    });

    const preview = $("[data-price-preview]");
    if (preview) {
      preview.textContent = priceCents
        ? `Quem não é membro paga ${TPRO.formatCurrency(priceCents)}. Campos de desconto em branco usam o percentual padrão do plano.`
        : "";
    }
  }

  function updateDescCount() {
    const field = $('[data-field="description"]');
    const counter = $("[data-desc-count]");
    if (field && counter) counter.textContent = String(field.value.length);
  }

  function clearErrors() {
    $$("[data-error]").forEach((slot) => (slot.textContent = ""));
    $$('[aria-invalid="true"]').forEach((input) => input.removeAttribute("aria-invalid"));
  }

  function showError(field, message) {
    const slot = $(`[data-error="${field}"]`);
    const input = $(`[data-field="${field}"]`);
    if (slot) slot.textContent = message;
    if (input) input.setAttribute("aria-invalid", "true");
  }

  function submitProduct(event) {
    event.preventDefault();
    clearErrors();

    const form = event.currentTarget;
    const value = (field) => $(`[data-field="${field}"]`, form)?.value.trim() || "";
    const checked = (field) => Boolean($(`[data-field="${field}"]`, form)?.checked);

    const name = value("name");
    const priceCents = TPRO.parseMoneyToCents(value("price"));

    let valid = true;
    if (!name) {
      showError("name", "Informe o nome do produto.");
      valid = false;
    }
    if (priceCents <= 0) {
      showError("price", "Informe um preço maior que zero.");
      valid = false;
    }
    if (!valid) {
      $('[aria-invalid="true"]')?.focus();
      return;
    }

    const discounts = {};
    TPRO.getPlans().forEach((plan) => {
      const typed = $(`[data-discount="${plan.id}"]`, form)?.value.trim();
      discounts[plan.id] = typed ? TPRO.parsePercentToRate(typed) : null;
    });

    const existing = editingId ? TPRO.getProductById(editingId) : null;

    const saved = TPRO.saveProduct({
      id: editingId || null,
      name,
      brand: value("brand"),
      sku: value("sku"),
      category: value("category"),
      description: value("description"),
      priceCents,
      discounts,
      images: draftImages.slice(),
      stock: Number(value("stock")) || 0,
      rating: existing?.rating ?? 4.6,
      reviews: existing?.reviews ?? 0,
      featured: checked("featured"),
      active: checked("active")
    });

    if (!saved) return; // o data.js já avisou o motivo

    closeProductForm();
    renderAll();
    toast(editingId ? "Produto atualizado." : "Produto cadastrado com sucesso.", "success");
  }

  function initProductForm() {
    const modal = $("[data-product-modal]");
    if (!modal) return;

    $$("[data-close-product]").forEach((element) =>
      element.addEventListener("click", closeProductForm)
    );

    $("[data-product-form]").addEventListener("submit", submitProduct);
    $('[data-field="price"]').addEventListener("input", updatePricePreview);
    $('[data-field="description"]').addEventListener("input", updateDescCount);

    $$("[data-new-product]").forEach((button) =>
      button.addEventListener("click", () => {
        goToView("produtos");
        openProductForm(null);
      })
    );
  }


  /* ========================================================================
     07. IMAGENS
     ======================================================================== */

  function renderImageList() {
    const list = $("[data-image-list]");
    if (!list) return;

    list.textContent = "";

    draftImages.forEach((src, index) => {
      const item = document.createElement("li");
      item.className = `img-card${index === 0 ? " is-cover" : ""}`;
      item.draggable = true;
      item.dataset.index = String(index);

      const image = document.createElement("img");
      image.className = "img-card__img";
      image.src = src;
      image.alt = `Imagem ${index + 1}`;
      image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

      if (index === 0) {
        const badge = document.createElement("span");
        badge.className = "tp-badge tp-badge--red img-card__cover";
        badge.textContent = "Capa";
        item.appendChild(badge);
      }

      const tools = document.createElement("div");
      tools.className = "img-card__tools";

      if (index > 0) {
        tools.appendChild(
          imageTool("Capa", () => {
            draftImages.unshift(...draftImages.splice(index, 1));
            renderImageList();
          }, false, "Usar como capa")
        );
        tools.appendChild(
          imageTool("◀", () => {
            [draftImages[index - 1], draftImages[index]] = [draftImages[index], draftImages[index - 1]];
            renderImageList();
          }, false, "Mover para a esquerda")
        );
      }
      if (index < draftImages.length - 1) {
        tools.appendChild(
          imageTool("▶", () => {
            [draftImages[index + 1], draftImages[index]] = [draftImages[index], draftImages[index + 1]];
            renderImageList();
          }, false, "Mover para a direita")
        );
      }
      tools.appendChild(
        imageTool("✕", () => {
          draftImages.splice(index, 1);
          renderImageList();
        }, true, "Remover imagem")
      );

      item.append(image, tools);
      list.appendChild(item);
    });

    initImageDrag(list);
  }

  function imageTool(label, onClick, danger = false, title = label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `img-card__tool${danger ? " img-card__tool--danger" : ""}`;
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.addEventListener("click", onClick);
    return button;
  }

  /** Reordenar arrastando: útil para escolher a capa rapidamente na demo. */
  function initImageDrag(list) {
    let dragIndex = null;

    list.addEventListener("dragstart", (event) => {
      const card = event.target.closest(".img-card");
      if (!card) return;
      dragIndex = Number(card.dataset.index);
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
    });

    list.addEventListener("dragend", (event) => {
      event.target.closest(".img-card")?.classList.remove("is-dragging");
    });

    list.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    list.addEventListener("drop", (event) => {
      event.preventDefault();
      const card = event.target.closest(".img-card");
      if (!card || dragIndex === null) return;

      const dropIndex = Number(card.dataset.index);
      if (dropIndex === dragIndex) return;

      const [moved] = draftImages.splice(dragIndex, 1);
      draftImages.splice(dropIndex, 0, moved);
      dragIndex = null;
      renderImageList();
    });
  }

  /**
   * Reduz a imagem antes de guardar: o localStorage tem poucos MB e uma foto
   * de celular sozinha já estouraria o limite.
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("falha ao ler o arquivo"));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error("arquivo não é uma imagem válida"));
        image.onload = () => {
          const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);

          const context = canvas.getContext("2d");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          resolve(canvas.toDataURL("image/jpeg", IMAGE_QUALITY));
        };
        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function initImageControls() {
    $("[data-image-upload]")?.addEventListener("change", async (event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";
      if (!files.length) return;

      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        try {
          draftImages.push(await compressImage(file));
        } catch (error) {
          toast(`Não foi possível ler "${file.name}".`, "error");
        }
      }

      renderImageList();
      toast(`${files.length} imagem(ns) adicionada(s).`, "success");
    });

    const urlInput = $("[data-image-url]");
    const addUrl = () => {
      const url = urlInput.value.trim();
      if (!url) return;

      draftImages.push(url);
      urlInput.value = "";
      renderImageList();
    };

    $("[data-image-url-add]")?.addEventListener("click", addUrl);
    urlInput?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      addUrl();
    });
  }


  /* ========================================================================
     08. CATEGORIAS
     ======================================================================== */

  function renderCategories() {
    const list = $("[data-category-list]");
    if (!list) return;

    list.textContent = "";

    TPRO.getCategories().forEach((category) => {
      const count = TPRO.countProductsInCategory(category.id);

      const item = document.createElement("li");

      const name = document.createElement("span");
      name.className = "cat-list__name";
      name.innerHTML = `${escapeHtml(category.name)} <span class="cat-list__slug">${escapeHtml(category.id)}</span>`;

      const badge = document.createElement("span");
      badge.className = "tp-badge tp-badge--soft";
      badge.textContent = `${count} produto${count === 1 ? "" : "s"}`;

      const rename = iconButton("Renomear", "M4 20h4l10-10-4-4L4 16v4z M13.5 6.5l4 4", () => {
        const novo = window.prompt("Novo nome da categoria:", category.name);
        if (!novo || !novo.trim()) return;
        TPRO.saveCategory({ id: category.id, name: novo.trim() });
        renderAll();
        toast("Categoria renomeada.", "success");
      });

      const remove = iconButton(
        "Excluir",
        "M5 7h14 M10 7V5h4v2 M8 7l1 12h6l1-12",
        () =>
          confirmDialog({
            title: "Excluir categoria",
            text: count
              ? `"${category.name}" tem ${count} produto(s). Eles serão movidos para outra categoria.`
              : `"${category.name}" será removida do catálogo.`,
            onConfirm: () => {
              if (TPRO.deleteCategory(category.id)) {
                renderAll();
                toast("Categoria excluída.", "success");
              } else {
                toast("É preciso manter pelo menos uma categoria.", "error");
              }
            }
          }),
        true
      );

      item.append(name, badge, rename, remove);
      list.appendChild(item);
    });
  }

  function initCategoryForm() {
    $("[data-category-form]")?.addEventListener("submit", (event) => {
      event.preventDefault();

      const input = $("#cat-nome");
      const name = input.value.trim();
      if (!name) return;

      TPRO.saveCategory({ name });
      input.value = "";
      renderAll();
      toast(`Categoria "${name}" adicionada.`, "success");
    });
  }


  /* ========================================================================
     09. PLANOS
     ======================================================================== */

  function renderPlans() {
    const box = $("[data-plans-admin]");
    if (!box) return;

    box.textContent = "";

    TPRO.getPlans().forEach((plan) => {
      const card = document.createElement("form");
      card.className = `plan-admin-card${plan.featured ? " plan-admin-card--featured" : ""}`;
      card.innerHTML = `
        <div class="plan-admin-card__head">
          <h3 class="plan-admin-card__name">${escapeHtml(plan.name)}</h3>
          ${plan.featured ? '<span class="tp-badge tp-badge--red">Mais escolhido</span>' : ""}
        </div>

        <div class="tp-field">
          <label class="tp-label" for="plano-${plan.id}-chamada">Chamada do plano</label>
          <input class="tp-input" type="text" id="plano-${plan.id}-chamada" name="tagline"
                 value="${escapeHtml(plan.tagline || "")}" maxlength="60">
        </div>

        <div class="tp-field">
          <label class="tp-label" for="plano-${plan.id}-preco">Mensalidade (R$)</label>
          <input class="tp-input" type="text" id="plano-${plan.id}-preco" name="price" inputmode="decimal"
                 value="${(plan.priceCents / 100).toFixed(2).replace(".", ",")}">
        </div>

        <div class="tp-field">
          <label class="tp-label" for="plano-${plan.id}-desconto">Desconto padrão (%)</label>
          <input class="tp-input" type="text" id="plano-${plan.id}-desconto" name="discount" inputmode="decimal"
                 value="${String(Math.round(plan.defaultDiscount * 1000) / 10).replace(".", ",")}">
        </div>

        <p class="plan-admin-card__preview" data-plan-preview></p>

        <button class="tp-btn tp-btn--blue tp-btn--block" type="submit">Salvar ${escapeHtml(plan.name)}</button>`;

      const preview = $("[data-plan-preview]", card);
      const updatePreview = () => {
        const rate = TPRO.parsePercentToRate(card.elements.discount.value) ?? plan.defaultDiscount;
        const exemplo = 89900; // referência: máquina de corte do catálogo
        preview.innerHTML = `Em um produto de ${TPRO.formatCurrency(exemplo)}, o membro paga
          <strong>${TPRO.formatCurrency(Math.round(exemplo * (1 - rate)))}</strong>.
          Vale para produtos sem percentual próprio.`;
      };

      card.elements.discount.addEventListener("input", updatePreview);
      updatePreview();

      card.addEventListener("submit", (event) => {
        event.preventDefault();
        TPRO.savePlan({
          id: plan.id,
          name: plan.name,
          tagline: card.elements.tagline.value.trim(),
          priceCents: TPRO.parseMoneyToCents(card.elements.price.value),
          defaultDiscount: TPRO.parsePercentToRate(card.elements.discount.value) ?? plan.defaultDiscount
        });
        renderAll();
        toast(`Plano ${plan.name} atualizado.`, "success");
      });

      box.appendChild(card);
    });
  }


  /* ========================================================================
     10. DADOS E BACKUP
     ======================================================================== */

  function initDataTools() {
    $("[data-export]")?.addEventListener("click", () => {
      const blob = new Blob([TPRO.exportCatalog()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);

      link.href = url;
      link.download = `tpro-club-catalogo-${stamp}.json`;
      link.click();
      URL.revokeObjectURL(url);

      toast("Arquivo de backup gerado.", "success");
    });

    $("[data-import]")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        confirmDialog({
          title: "Importar catálogo",
          text: "O catálogo atual será substituído pelo conteúdo do arquivo. Deseja continuar?",
          onConfirm: () => {
            if (TPRO.importCatalog(String(reader.result))) {
              renderAll();
              toast("Catálogo importado.", "success");
            }
          }
        });
      };
      reader.readAsText(file);
    });

    $("[data-reset]")?.addEventListener("click", () =>
      confirmDialog({
        title: "Restaurar catálogo padrão",
        text: "Todos os produtos, categorias e planos cadastrados neste navegador serão descartados e voltarão ao estado original da demonstração.",
        onConfirm: () => {
          TPRO.resetCatalog();
          renderAll();
          toast("Catálogo padrão restaurado.", "success");
        }
      })
    );
  }

  function renderStorageInfo() {
    const slot = $("[data-storage-info]");
    if (!slot) return;

    const raw = window.localStorage.getItem(TPRO.KEYS.catalog) || "";
    const kb = (new Blob([raw]).size / 1024).toFixed(1);
    slot.textContent = raw
      ? `Catálogo salvo neste navegador: ${kb} KB.`
      : "Ainda usando o catálogo padrão do projeto (nada salvo neste navegador).";
  }


  /* ========================================================================
     11. CONFIRMAÇÃO E TOASTS
     ======================================================================== */

  function confirmDialog({ title, text, onConfirm }) {
    const modal = $("[data-confirm-modal]");
    if (!modal) return;

    $("[data-confirm-title]", modal).textContent = title;
    $("[data-confirm-text]", modal).textContent = text;
    confirmAction = onConfirm;

    modal.hidden = false;
    $("[data-confirm-ok]", modal).focus();
  }

  function closeConfirm() {
    const modal = $("[data-confirm-modal]");
    if (modal) modal.hidden = true;
    confirmAction = null;
  }

  function initConfirm() {
    $$("[data-close-confirm]").forEach((element) => element.addEventListener("click", closeConfirm));

    $("[data-confirm-ok]")?.addEventListener("click", () => {
      const action = confirmAction;
      closeConfirm();
      action?.();
    });
  }

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
    }, 3000);
  }

  /** Escape usado nos poucos pontos em que montamos HTML por string. */
  function escapeHtml(text) {
    return String(text ?? "").replace(/[&<>"']/g, (character) => {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }


  /* ========================================================================
     12. INICIALIZAÇÃO
     ======================================================================== */

  function renderAll() {
    fillCategorySelects();
    renderDashboard();
    renderMembers();
    renderProductsTable();
    renderCategories();
    renderPlans();
    renderStorageInfo();
  }

  function init() {
    initLogin();
    initNav();
    initProductFilters();
    initMemberFilters();
    initProductForm();
    initImageControls();
    initCategoryForm();
    initDataTools();
    initConfirm();

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if ($("[data-confirm-modal]")?.hidden === false) closeConfirm();
      else if ($("[data-product-modal]")?.hidden === false) closeProductForm();
      else closeSide();
    });

    TPRO.on("error", (payload) => toast(payload.message, "error"));

    if (isLogged()) showShell();
    else showLogin();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
