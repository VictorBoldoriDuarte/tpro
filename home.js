/* ==========================================================================
   TPRO CLUB — Página inicial

   Os produtos, planos e percentuais vêm de data.js — os mesmos que a loja e o
   painel administrativo usam. Alterou no painel, muda aqui também.
   Só o conteúdo editorial (depoimentos e lista de vantagens de cada plano)
   fica neste arquivo.

   Sumário
   01. Conteúdo editorial
   02. Atalhos e estado
   03. Cabeçalho e menu
   04. Vitrine de preços
   05. Card do hero
   06. Planos
   07. Simulador
   08. Depoimentos
   09. FAQ
   10. Modal
   11. Inicialização
   ========================================================================== */

(() => {
  "use strict";

  const TPRO = window.TPRO;
  if (!TPRO) return;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));


  /* ========================================================================
     01. CONTEÚDO EDITORIAL
     ------------------------------------------------------------------------
     ALTERAR AQUI os depoimentos e as vantagens listadas em cada plano.
     ======================================================================== */

  /** Vantagens exibidas no card de cada plano, por id do plano. */
  const PLAN_BENEFITS = {
    basic: [
      "Entrada oficial no TPRO CLUB",
      "Preço de membro em todo o catálogo",
      "Ofertas selecionadas para assinantes",
      "Suporte para montar sua reposição"
    ],
    pro: [
      "Desconto maior em todo o catálogo",
      "Prioridade em campanhas e lançamentos",
      "Condições especiais em compras de volume",
      "Suporte para montar sua reposição"
    ],
    elite: [
      "O maior nível de desconto do clube",
      "Até 70% em produtos selecionados",
      "Campanhas exclusivas do nível Elite",
      "Atendimento prioritário"
    ]
  };

  /** CONTEÚDO PROVISÓRIO — substituir pelos depoimentos reais. */
  const QUOTES = [
    {
      text: "Eu comprava no varejo achando que estava fazendo negócio. Quando vi o preço de distribuidor, entendi quanto dinheiro estava deixando na mesa todo mês.",
      name: "Depoimento 01",
      role: "[Inserir barbearia e cidade]"
    },
    {
      text: "Reposição de lâmina e pomada é o que mais sai aqui. Só nesses dois itens a economia do mês já paga a assinatura com folga.",
      name: "Depoimento 02",
      role: "[Inserir barbearia e cidade]"
    },
    {
      text: "O que mudou não foi só o preço, foi conseguir planejar a compra. Hoje eu sei quanto vou gastar e quanto vai sobrar de margem.",
      name: "Depoimento 03",
      role: "[Inserir barbearia e cidade]"
    }
  ];

  /** Quantos produtos aparecem na vitrine da home. */
  const SHOWCASE_SIZE = 3;


  /* ========================================================================
     02. ESTADO
     ======================================================================== */

  const state = {
    planId: "pro", // nível usado na vitrine e no card do hero
    monthlyCents: 150000
  };


  /* ========================================================================
     03. CABEÇALHO E MENU
     ======================================================================== */

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

  function initMobileNav() {
    const toggle = $("#nav-toggle");
    const nav = $("#home-nav");
    const overlay = $("#nav-overlay");
    if (!toggle || !nav || !overlay) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
      nav.classList.toggle("is-open", open);
      overlay.hidden = !open;
      document.body.classList.toggle("is-locked", open);
    };

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    toggle.addEventListener("click", () => setOpen(!isOpen()));
    overlay.addEventListener("click", () => setOpen(false));
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  function initSmoothScroll() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const id = link.getAttribute("href").slice(1);
      const target = id && document.getElementById(id);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }


  /* ========================================================================
     04. VITRINE DE PREÇOS
     ======================================================================== */

  function renderLevelTabs() {
    const box = $("[data-level-tabs]");
    if (!box) return;

    box.textContent = "";

    TPRO.getPlans().forEach((plan) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "level-tab";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", String(plan.id === state.planId));
      tab.textContent = plan.name;

      tab.addEventListener("click", () => {
        state.planId = plan.id;
        renderLevelTabs();
        renderShowcase();
        renderHeroCard();
      });

      box.appendChild(tab);
    });
  }

  /** Os produtos em destaque, com o preço do nível selecionado. */
  function renderShowcase() {
    const list = $("[data-showcase]");
    const template = $("#tpl-showcase");
    if (!list || !template) return;

    const products = TPRO.getProducts()
      .sort((a, b) => Number(b.featured) - Number(a.featured) || b.rating - a.rating)
      .slice(0, SHOWCASE_SIZE);

    list.textContent = "";

    products.forEach((product) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const price = TPRO.priceFor(product, state.planId);

      const image = $("img", node);
      image.src = product.images[0];
      image.alt = product.name;
      image.addEventListener("error", () => (image.src = TPRO.NO_IMAGE), { once: true });

      $('[data-field="off"]', node).textContent = `-${TPRO.formatPercent(
        TPRO.discountFor(product, state.planId)
      )}`;
      $('[data-field="name"]', node).textContent = product.name;
      $('[data-field="old"]', node).textContent = TPRO.formatCurrency(product.priceCents);
      $('[data-field="new"]', node).textContent = TPRO.formatCurrency(price);

      const cta = $('[data-field="cta"]', node);
      cta.href = `loja.html?produto=${encodeURIComponent(product.id)}`;
      cta.setAttribute("aria-label", `Ver ${product.name} na loja`);

      list.appendChild(node);
    });
  }


  /* ========================================================================
     05. CARD DO HERO
     ======================================================================== */

  function renderHeroCard() {
    const all = TPRO.getProducts();
    if (!all.length) return;

    // Entre os produtos em destaque, mostra o de maior economia no nível atual.
    // Limitar aos destaques evita o card cair em um item de alto valor e baixo
    // giro (mobiliário, por exemplo) só porque a economia em reais é maior.
    const pool = all.filter((item) => item.featured);
    const product = (pool.length ? pool : all).reduce((best, item) =>
      TPRO.savingsFor(item, state.planId) > TPRO.savingsFor(best, state.planId) ? item : best
    );

    const price = TPRO.priceFor(product, state.planId);
    const plan = TPRO.getPlanById(state.planId);

    const set = (selector, value) => {
      const slot = $(selector);
      if (slot) slot.textContent = value;
    };

    set("[data-save-plan]", plan ? plan.name : "");
    set("[data-save-product]", product.name);
    set("[data-save-old]", TPRO.formatCurrency(product.priceCents));
    set("[data-save-new]", TPRO.formatCurrency(price));
    set("[data-save-diff]", TPRO.formatCurrency(product.priceCents - price));
  }


  /* ========================================================================
     06. PLANOS
     ======================================================================== */

  function renderPlans() {
    const box = $("[data-plans]");
    const template = $("#tpl-plan");
    if (!box || !template) return;

    box.textContent = "";

    TPRO.getPlans().forEach((plan) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.classList.toggle("plan--featured", Boolean(plan.featured));

      const [reais, centavos] = (plan.priceCents / 100).toFixed(2).split(".");

      $('[data-field="name"]', node).textContent = plan.name;
      $('[data-field="amount"]', node).textContent = reais;
      $('[data-field="cents"]', node).textContent = `,${centavos}`;
      $('[data-field="tagline"]', node).textContent = plan.tagline || "";
      $('[data-field="discount"]', node).textContent = `${TPRO.formatPercent(
        plan.defaultDiscount
      )} de desconto no catálogo`;

      const flag = $('[data-field="flag"]', node);
      flag.textContent = "Mais escolhido";
      flag.hidden = !plan.featured;

      const benefits = $('[data-field="benefits"]', node);
      (PLAN_BENEFITS[plan.id] || [`${TPRO.formatPercent(plan.defaultDiscount)} de desconto no catálogo`]).forEach(
        (benefit) => {
          const item = document.createElement("li");
          item.textContent = benefit;
          benefits.appendChild(item);
        }
      );

      const cta = $('[data-field="cta"]', node);
      cta.textContent = "Assinar agora";
      cta.classList.add(plan.featured ? "tp-btn--red" : "tp-btn--outline");
      cta.addEventListener("click", () => openPlanModal(plan.id));

      box.appendChild(node);
    });
  }


  /* ========================================================================
     07. SIMULADOR
     ======================================================================== */

  function initSimulator() {
    const range = $("#sim-range");
    const output = $("[data-sim-output]");
    const results = $("[data-sim-results]");
    const template = $("#tpl-sim");
    if (!range || !output || !results || !template) return;

    const min = Number(range.min);
    const max = Number(range.max);
    const slots = new Map();

    const build = () => {
      results.textContent = "";
      slots.clear();

      TPRO.getPlans().forEach((plan) => {
        const node = template.content.firstElementChild.cloneNode(true);
        node.classList.toggle("sim-result--featured", Boolean(plan.featured));
        $('[data-field="plan"]', node).textContent = plan.name;
        $('[data-field="label"]', node).textContent = `de economia estimada por mês com o ${plan.name}`;
        slots.set(plan.id, $('[data-field="value"]', node));
        results.appendChild(node);
      });
    };

    const update = () => {
      const raw = Number(range.value);
      const safe = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
      state.monthlyCents = Math.round(safe * 100);

      const label = TPRO.formatCurrency(state.monthlyCents);
      output.textContent = `${label} por mês`;
      range.setAttribute("aria-valuetext", `${label} por mês`);

      TPRO.getPlans().forEach((plan) => {
        const slot = slots.get(plan.id);
        if (slot) slot.textContent = TPRO.formatCurrency(Math.round(state.monthlyCents * plan.defaultDiscount));
      });
    };

    range.addEventListener("input", update);
    build();
    update();

    // Refaz a lista se o painel administrativo mudar os planos
    TPRO.on("change", () => {
      build();
      update();
    });
  }


  /* ========================================================================
     08. DEPOIMENTOS
     ======================================================================== */

  function renderQuotes() {
    const list = $("[data-quotes]");
    const template = $("#tpl-quote");
    if (!list || !template) return;

    list.textContent = "";

    QUOTES.forEach((quote) => {
      const node = template.content.firstElementChild.cloneNode(true);

      $('[data-field="text"]', node).textContent = quote.text;
      $('[data-field="name"]', node).textContent = quote.name;
      $('[data-field="role"]', node).textContent = quote.role;
      $('[data-field="initials"]', node).textContent = quote.name
        .split(" ")
        .map((word) => word[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      list.appendChild(node);
    });
  }


  /* ========================================================================
     09. FAQ
     ======================================================================== */

  function initAccordion() {
    const accordion = $("[data-accordion]");
    if (!accordion) return;

    $$(".accordion__trigger", accordion).forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));

        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
      });
    });
  }


  /* ========================================================================
     10. MODAL
     ======================================================================== */

  let lastFocused = null;

  function openModal({ eyebrow = "TPRO CLUB", title, note = "" }) {
    const modal = $("[data-modal]");
    if (!modal) return;

    lastFocused = document.activeElement;

    $("[data-modal-eyebrow]", modal).textContent = eyebrow;
    $("[data-modal-title]", modal).textContent = title;
    $("[data-modal-note]", modal).textContent = note;

    modal.hidden = false;
    document.body.classList.add("is-locked");
    $("[data-modal-close]", modal)?.focus();
  }

  function closeModal() {
    const modal = $("[data-modal]");
    if (!modal || modal.hidden) return;

    modal.hidden = true;
    document.body.classList.remove("is-locked");

    if (lastFocused instanceof HTMLElement && lastFocused.isConnected) lastFocused.focus();
    lastFocused = null;
  }

  function openPlanModal(planId) {
    const plan = TPRO.getPlanById(planId);
    if (!plan) return;

    openModal({
      eyebrow: "Assinatura TPRO CLUB",
      title: `Plano ${plan.name}`,
      note: `${TPRO.formatCurrency(plan.priceCents)} por mês (valor demonstrativo) • ${TPRO.formatPercent(
        plan.defaultDiscount
      )} de desconto no catálogo.`
    });
  }

  function initModal() {
    const modal = $("[data-modal]");
    if (!modal) return;

    $$("[data-modal-close]", modal).forEach((element) => element.addEventListener("click", closeModal));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });

    $$("[data-open-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        const context = button.dataset.modalContext || "TPRO CLUB";
        openModal({
          title: context,
          note: "Esta é uma demonstração visual do projeto. Nenhum dado é enviado ou armazenado nesta página."
        });
      });
    });
  }


  /* ========================================================================
     11. INICIALIZAÇÃO
     ======================================================================== */

  function renderDynamic() {
    renderLevelTabs();
    renderShowcase();
    renderHeroCard();
    renderPlans();
  }

  function init() {
    // Começa no plano em destaque (o "mais escolhido"), com queda para o primeiro
    const plans = TPRO.getPlans();
    state.planId = (plans.find((plan) => plan.featured) || plans[0])?.id || "pro";

    renderDynamic();
    renderQuotes();

    initSimulator();
    initAccordion();
    initModal();
    initHeaderScroll();
    initMobileNav();
    initSmoothScroll();

    const year = $("[data-current-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    // Reflete alterações feitas no painel administrativo (inclusive em outra aba)
    TPRO.on("change", renderDynamic);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
