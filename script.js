/* ==========================================================================
   PRO CLUB — Toni Acessórios
   Protótipo funcional (sem backend, sem dependências externas).

   Sumário
   01. Dados centralizados (planos, produtos, embaixadores)
   02. Utilidades (formatação e cálculo de preços)
   03. Estado da aplicação
   04. Cabeçalho, menu mobile e navegação
   05. Abas de plano + renderização de produtos
   06. Carrossel
   07. Resumo de economia e card do hero
   08. Planos e simulador
   09. Embaixadores
   10. FAQ (accordion)
   11. Modal demonstrativo
   12. Inicialização
   ========================================================================== */

(() => {
  "use strict";

  /* ========================================================================
     01. DADOS CENTRALIZADOS
     ------------------------------------------------------------------------
     ALTERAR AQUI: preços das assinaturas, percentuais de desconto, produtos,
     imagens e embaixadores. Nenhum desses valores está espalhado pelo HTML.
     ======================================================================== */

  /**
   * Planos do clube.
   * ATENÇÃO: `priceCents` são valores DEMONSTRATIVOS e precisam ser
   * confirmados pelo cliente antes da publicação.
   * `discount`  → percentual fixo aplicado a todos os produtos (Basic/Pro).
   * `perProduct` → quando true, o desconto vem de `eliteDiscount` em cada produto.
   * `simulationRate` → taxa média usada apenas no simulador de retorno.
   */
  const PLANS = [
    {
      id: "basic",
      name: "Basic",
      priceCents: 2990, // R$ 29,90/mês — valor temporário
      discount: 0.05,
      perProduct: false,
      discountLabel: "5%",
      simulationRate: 0.05,
      simulationNote: "com o plano Basic",
      tagline: "A entrada para o clube, com preço de profissional na reposição do dia a dia.",
      highlight: "5% de desconto no catálogo do clube",
      flag: "Entrada no clube",
      featured: false,
      ctaLabel: "Começar no Basic",
      benefits: [
        "Entrada oficial no Pro Club",
        "5% de desconto nos produtos do clube",
        "Acesso aos preços exclusivos do nível Basic",
        "Ofertas selecionadas para membros",
        "Benefícios iniciais da comunidade"
      ]
    },
    {
      id: "pro",
      name: "Pro",
      priceCents: 5990, // R$ 59,90/mês — valor temporário
      discount: 0.15,
      perProduct: false,
      discountLabel: "15%",
      simulationRate: 0.15,
      simulationNote: "com o plano Pro",
      tagline: "O nível de quem repõe estoque todo mês e quer sentir a diferença na margem.",
      highlight: "15% de desconto no catálogo do clube",
      flag: "Plano recomendado",
      featured: true,
      ctaLabel: "Escolher o Pro",
      benefits: [
        "15% de desconto nos produtos do clube",
        "Condições melhores do que o nível Basic",
        "Ofertas especiais reservadas ao Pro",
        "Prioridade em campanhas e lançamentos",
        "Benefícios exclusivos do nível Pro"
      ]
    },
    {
      id: "elite",
      name: "Elite",
      priceCents: 11990, // R$ 119,90/mês — valor temporário
      discount: null,
      perProduct: true,
      discountLabel: "até 70%",
      simulationRate: 0.3, // média estimada: os descontos variam por produto
      simulationNote: "com o plano Elite (média estimada)",
      tagline: "O maior nível de vantagens do clube, com condições próximas de fábrica.",
      highlight: "Até 70% em produtos selecionados",
      flag: "Nível máximo",
      featured: false,
      ctaLabel: "Quero ser Elite",
      benefits: [
        "Descontos de até 70% em produtos selecionados",
        "Acesso ao maior nível de vantagens do clube",
        "Campanhas especiais exclusivas do Elite",
        "Condições premium de reposição",
        "Benefícios exclusivos para quem compra em volume"
      ]
    }
  ];

  /**
   * Produtos de demonstração.
   * `priceCents`     → preço cheio, em centavos (evita erro de ponto flutuante).
   * `eliteDiscount`  → desconto do nível Elite para ESTE produto (varia por item).
   * `image`          → trocar pelo caminho da foto real do produto.
   */
  const PRODUCTS = [
    {
      id: "maquina-corte",
      name: "Máquina de corte profissional",
      category: "Máquinas",
      priceCents: 89900,
      eliteDiscount: 0.35,
      image: "assets/images/produto-maquina-corte.svg",
      alt: "Ilustração de uma máquina de corte profissional"
    },
    {
      id: "lamina",
      name: "Lâmina navalhete premium (cx. 100un)",
      category: "Lâminas",
      priceCents: 12900,
      eliteDiscount: 0.7,
      image: "assets/images/produto-lamina.svg",
      alt: "Ilustração de uma caixa de lâminas para navalhete"
    },
    {
      id: "capa",
      name: "Capa profissional impermeável",
      category: "Acessórios",
      priceCents: 15900,
      eliteDiscount: 0.5,
      image: "assets/images/produto-capa.svg",
      alt: "Ilustração de uma capa profissional de corte"
    },
    {
      id: "secador",
      name: "Secador profissional 2200W",
      category: "Elétricos",
      priceCents: 42900,
      eliteDiscount: 0.25,
      image: "assets/images/produto-secador.svg",
      alt: "Ilustração de um secador profissional"
    },
    {
      id: "pomada",
      name: "Pomada modeladora efeito matte",
      category: "Finalizadores",
      priceCents: 6900,
      eliteDiscount: 0.6,
      image: "assets/images/produto-pomada.svg",
      alt: "Ilustração de um pote de pomada modeladora"
    },
    {
      id: "pentes",
      name: "Kit de pentes profissionais (6 peças)",
      category: "Acessórios",
      priceCents: 8900,
      eliteDiscount: 0.4,
      image: "assets/images/produto-pentes.svg",
      alt: "Ilustração de um kit de pentes profissionais"
    },
    {
      id: "shaver",
      name: "Shaver profissional de acabamento",
      category: "Máquinas",
      priceCents: 34900,
      eliteDiscount: 0.3,
      image: "assets/images/produto-shaver.svg",
      alt: "Ilustração de um shaver profissional"
    },
    {
      id: "escova-barba",
      name: "Escova para barba cerdas naturais",
      category: "Barba",
      priceCents: 5900,
      eliteDiscount: 0.45,
      image: "assets/images/produto-escova-barba.svg",
      alt: "Ilustração de uma escova para barba"
    }
  ];

  /**
   * Embaixadores — CONTEÚDO PROVISÓRIO.
   * Substituir nome, cidade, especialidade, frase e foto pelos dados reais.
   */
  const AMBASSADORS = [
    {
      id: "embaixador-1",
      name: "Embaixador 01",
      city: "Campo Grande, MS",
      specialty: "Corte clássico e navalha",
      quote: "Quem trabalha na cadeira todo dia sabe: o material certo muda o resultado do corte.",
      image: "assets/images/embaixador-1.svg",
      alt: "Foto provisória do embaixador 01"
    },
    {
      id: "embaixador-2",
      name: "Embaixador 02",
      city: "[Inserir cidade]",
      specialty: "Barboterapia e visagismo",
      quote: "Barbearia é negócio. Comprar bem é parte do serviço que a gente entrega.",
      image: "assets/images/embaixador-2.svg",
      alt: "Foto provisória do embaixador 02"
    },
    {
      id: "embaixador-3",
      name: "Embaixador 03",
      city: "[Inserir cidade]",
      specialty: "Formação de barbeiros",
      quote: "Ensinar técnica é só metade. A outra metade é ensinar a administrar a barbearia.",
      image: "assets/images/embaixador-3.svg",
      alt: "Foto provisória do embaixador 03"
    }
  ];


  /* ========================================================================
     02. UTILIDADES
     ======================================================================== */

  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const percentFormatter = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0
  });

  /** Converte centavos em texto de moeda brasileira. */
  const formatCurrency = (cents) => currencyFormatter.format(cents / 100);

  /** Converte uma taxa (0.15) em texto percentual ("15%"). */
  const formatPercent = (rate) => percentFormatter.format(rate);

  const getPlanById = (planId) => PLANS.find((plan) => plan.id === planId) || PLANS[0];

  /** Taxa de desconto de um produto dentro de um plano. */
  const getDiscountRate = (product, plan) => (plan.perProduct ? product.eliteDiscount : plan.discount);

  /** Preço final, em centavos, de um produto em um plano. */
  const calculateDiscountedPrice = (product, plan) =>
    Math.round(product.priceCents * (1 - getDiscountRate(product, plan)));

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * Trava de rolagem do body por motivo.
   * O menu mobile e o modal podem estar ativos ao mesmo tempo — a rolagem só
   * volta quando nenhum dos dois precisa mais dela.
   */
  const scrollLock = (() => {
    const reasons = new Set();
    const sync = () => document.body.classList.toggle("is-locked", reasons.size > 0);

    return {
      lock(reason) {
        reasons.add(reason);
        sync();
      },
      unlock(reason) {
        reasons.delete(reason);
        sync();
      }
    };
  })();

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));


  /* ========================================================================
     03. ESTADO
     ======================================================================== */

  const state = {
    planId: "pro", // plano selecionado por padrão na demonstração
    monthlyPurchaseCents: 100000 // R$ 1.000,00 no simulador
  };

  /** Elementos criados uma única vez e reaproveitados nas atualizações. */
  const productNodes = new Map();


  /* ========================================================================
     04. CABEÇALHO, MENU MOBILE E NAVEGAÇÃO
     ======================================================================== */

  function initHeaderScroll() {
    const header = $("[data-header]");
    if (!header) return;

    let ticking = false;
    const applyState = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(applyState);
      },
      { passive: true }
    );

    applyState();
  }

  function initMobileNav() {
    const toggle = $("#nav-toggle");
    const nav = $("#site-nav");
    const overlay = $("#nav-overlay");
    if (!toggle || !nav || !overlay) return;

    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Fechar menu de navegação" : "Abrir menu de navegação");
      nav.classList.toggle("is-open", open);
      overlay.hidden = !open;

      if (open) scrollLock.lock("nav");
      else scrollLock.unlock("nav");
    };

    const isOpen = () => toggle.getAttribute("aria-expanded") === "true";

    toggle.addEventListener("click", () => setOpen(!isOpen()));
    overlay.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Fecha o menu ao navegar ou ao voltar para o layout desktop
    nav.addEventListener("click", (event) => {
      if (event.target.closest("a, button")) setOpen(false);
    });

    window.matchMedia("(min-width: 901px)").addEventListener("change", (event) => {
      if (event.matches) setOpen(false);
    });
  }

  function initSmoothScroll() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;

      const targetId = link.getAttribute("href").slice(1);
      const target = document.getElementById(targetId);
      if (!targetId || !target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });

      // Move o foco para a seção, mantendo a navegação por teclado coerente
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    });
  }

  function initScrollSpy() {
    const links = $$(".site-nav__link");
    const sections = links
      .map((link) => document.getElementById(link.getAttribute("href").slice(1)))
      .filter(Boolean);

    if (!("IntersectionObserver" in window) || sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) =>
            link.classList.toggle("is-active", link.getAttribute("href") === `#${entry.target.id}`)
          );
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function initReveal() {
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

    const targets = $$(
      ".section__head, .steps__item, .plan-card, .ambassador-card, .timeline__item, .story__visual, .simulator, .final-cta__inner"
    );
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );

    targets.forEach((target) => {
      // Elementos já visíveis no carregamento não recebem a animação (evita piscada)
      if (target.getBoundingClientRect().top < window.innerHeight) return;
      target.classList.add("reveal");
      observer.observe(target);
    });
  }

  function initCurrentYear() {
    const slot = $("[data-current-year]");
    if (slot) slot.textContent = String(new Date().getFullYear());
  }


  /* ========================================================================
     05. ABAS DE PLANO + PRODUTOS
     ======================================================================== */

  function renderProducts() {
    const track = $("[data-product-track]");
    const template = $("#tpl-product");
    if (!track || !template) return;

    const fragment = document.createDocumentFragment();

    PRODUCTS.forEach((product) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const image = $(".product-card__img", node);

      image.src = product.image;
      image.alt = product.alt;

      $('[data-field="category"]', node).textContent = product.category;
      $('[data-field="name"]', node).textContent = product.name;

      const cta = $("[data-product-cta]", node);
      cta.addEventListener("click", () => openProductModal(product));
      cta.setAttribute("aria-label", `Ver benefício do produto ${product.name}`);

      productNodes.set(product.id, {
        planBadge: $('[data-field="planBadge"]', node),
        oldPrice: $('[data-field="oldPrice"]', node),
        newPrice: $('[data-field="newPrice"]', node),
        discount: $('[data-field="discount"]', node),
        save: $('[data-field="save"]', node)
      });

      fragment.appendChild(node);
    });

    track.appendChild(fragment);
    updateProductPrices();
  }

  /** Atualiza preços, selos e economia de todos os cards conforme o plano ativo. */
  function updateProductPrices() {
    const plan = getPlanById(state.planId);

    PRODUCTS.forEach((product) => {
      const refs = productNodes.get(product.id);
      if (!refs) return;

      const finalPrice = calculateDiscountedPrice(product, plan);
      const savings = product.priceCents - finalPrice;

      refs.planBadge.textContent = plan.name;
      refs.oldPrice.textContent = formatCurrency(product.priceCents);
      refs.newPrice.textContent = formatCurrency(finalPrice);
      refs.discount.textContent = `-${formatPercent(getDiscountRate(product, plan))}`;
      refs.save.textContent = formatCurrency(savings);
    });
  }

  function initPlanTabs() {
    const tabs = $$(".plan-tab");
    const panel = $("#plan-panel");
    if (tabs.length === 0 || !panel) return;

    const activate = (tab, { focus = true } = {}) => {
      tabs.forEach((item) => {
        const selected = item === tab;
        item.setAttribute("aria-selected", String(selected));
        item.tabIndex = selected ? 0 : -1;
      });

      panel.setAttribute("aria-labelledby", tab.id);
      if (focus) tab.focus();

      selectPlan(tab.dataset.plan);
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab, { focus: false }));

      tab.addEventListener("keydown", (event) => {
        const index = tabs.indexOf(tab);
        let nextIndex = null;

        switch (event.key) {
          case "ArrowRight":
            nextIndex = (index + 1) % tabs.length;
            break;
          case "ArrowLeft":
            nextIndex = (index - 1 + tabs.length) % tabs.length;
            break;
          case "Home":
            nextIndex = 0;
            break;
          case "End":
            nextIndex = tabs.length - 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        activate(tabs[nextIndex]);
      });
    });
  }

  /** Ponto único de troca de plano na demonstração. */
  function selectPlan(planId) {
    const plan = PLANS.find((item) => item.id === planId);
    if (!plan || plan.id === state.planId) return;

    state.planId = plan.id;

    const panel = $("#plan-panel");
    if (panel && !prefersReducedMotion()) {
      panel.classList.add("is-updating");
      window.setTimeout(() => panel.classList.remove("is-updating"), 180);
    }

    updateProductPrices();
    updateSavingsSummary();
    updateHeroCard();
  }


  /* ========================================================================
     06. CARROSSEL
     ======================================================================== */

  function initCarousel() {
    const root = $("[data-carousel]");
    if (!root) return;

    const viewport = $("[data-carousel-viewport]", root);
    const track = $(".carousel__track", root);
    const prevBtn = $("[data-carousel-prev]", root);
    const nextBtn = $("[data-carousel-next]", root);
    const dotsBox = $("[data-carousel-dots]", root);
    if (!viewport || !track || !prevBtn || !nextBtn) return;

    const getStep = () => {
      const item = track.firstElementChild;
      if (!item) {
        const fallback = viewport.clientWidth || 1;
        return { itemWidth: fallback, perView: 1, pageWidth: fallback };
      }
      const gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
      const itemWidth = item.getBoundingClientRect().width + gap;
      const perView = Math.max(1, Math.round(viewport.clientWidth / itemWidth));
      return { itemWidth, perView, pageWidth: itemWidth * perView };
    };

    const moveCarousel = (direction) => {
      const { pageWidth } = getStep();
      viewport.scrollBy({
        left: direction * pageWidth,
        behavior: prefersReducedMotion() ? "auto" : "smooth"
      });
    };

    const buildDots = (pages) => {
      if (!dotsBox) return;
      dotsBox.textContent = "";
      if (pages <= 1) return;

      for (let index = 0; index < pages; index += 1) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carousel__dot";
        dot.setAttribute("aria-label", `Ir para o grupo ${index + 1} de ${pages}`);
        dot.addEventListener("click", () => {
          const { pageWidth } = getStep();
          viewport.scrollTo({
            left: index * pageWidth,
            behavior: prefersReducedMotion() ? "auto" : "smooth"
          });
        });
        dotsBox.appendChild(dot);
      }
    };

    const updateControls = () => {
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      prevBtn.disabled = viewport.scrollLeft <= 4;
      nextBtn.disabled = viewport.scrollLeft >= maxScroll - 4;

      if (!dotsBox) return;
      const { pageWidth } = getStep();
      const dots = Array.from(dotsBox.children);
      if (dots.length === 0) return;

      const current = Math.min(dots.length - 1, Math.round(viewport.scrollLeft / pageWidth));
      dots.forEach((dot, index) => {
        const active = index === current;
        dot.classList.toggle("is-active", active);
        dot.setAttribute("aria-current", active ? "true" : "false");
      });
    };

    const rebuild = () => {
      const { perView } = getStep();
      buildDots(Math.ceil(track.children.length / perView));
      updateControls();
    };

    prevBtn.addEventListener("click", () => moveCarousel(-1));
    nextBtn.addEventListener("click", () => moveCarousel(1));

    viewport.addEventListener("scroll", () => {
      window.requestAnimationFrame(updateControls);
    }, { passive: true });

    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        moveCarousel(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveCarousel(-1);
      }
    });

    // Arrastar com o mouse (no toque o próprio navegador já faz o deslize)
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let moved = 0;

    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse" || event.button !== 0) return;
      dragging = true;
      moved = 0;
      startX = event.clientX;
      startScroll = viewport.scrollLeft;
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      moved = Math.abs(delta);
      if (moved > 4) viewport.scrollLeft = startScroll - delta;
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      // Evita que o clique final dispare o botão do card após um arrasto
      if (moved > 6) {
        viewport.addEventListener("click", (event) => event.preventDefault(), {
          capture: true,
          once: true
        });
      }
    };

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointerleave", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rebuild, 150);
    });

    rebuild();
  }


  /* ========================================================================
     07. RESUMO DE ECONOMIA E CARD DO HERO
     ======================================================================== */

  function updateSavingsSummary() {
    const plan = getPlanById(state.planId);
    const planSlot = $("[data-summary-plan]");
    const discountSlot = $("[data-summary-discount]");
    const totalSlot = $("[data-summary-total]");
    const noteSlot = $("[data-summary-note]");
    const ctaSlot = $("[data-plan-cta-dynamic]");

    const totalSavings = PRODUCTS.reduce(
      (total, product) => total + (product.priceCents - calculateDiscountedPrice(product, plan)),
      0
    );

    if (planSlot) planSlot.textContent = plan.name;
    if (discountSlot) discountSlot.textContent = plan.discountLabel;
    if (totalSlot) totalSlot.textContent = formatCurrency(totalSavings);

    if (noteSlot) {
      noteSlot.textContent = plan.perProduct
        ? "Soma da economia nos produtos exibidos. No Elite o desconto varia por item, chegando a até 70% em produtos selecionados."
        : `Soma da economia nos produtos exibidos, com ${plan.discountLabel} de desconto do nível ${plan.name}.`;
    }

    if (ctaSlot) {
      ctaSlot.textContent = `Assinar o ${plan.name}`;
      ctaSlot.dataset.planCta = plan.id;
    }
  }

  /** Card flutuante do hero: acompanha o plano selecionado na demonstração. */
  function updateHeroCard() {
    const plan = getPlanById(state.planId);
    const product = PRODUCTS[0];

    const planSlot = $("[data-hero-plan]");
    const productSlot = $("[data-hero-product]");
    const oldSlot = $("[data-hero-old]");
    const newSlot = $("[data-hero-new]");
    const saveSlot = $("[data-hero-save]");
    const badgeValue = $(".badge-card__value");

    const finalPrice = calculateDiscountedPrice(product, plan);

    if (planSlot) planSlot.textContent = plan.name;
    if (productSlot) productSlot.textContent = product.name;
    if (oldSlot) oldSlot.textContent = formatCurrency(product.priceCents);
    if (newSlot) newSlot.textContent = formatCurrency(finalPrice);
    if (saveSlot) saveSlot.textContent = formatCurrency(product.priceCents - finalPrice);
    if (badgeValue) badgeValue.textContent = `-${formatPercent(getDiscountRate(product, plan))}`;
  }


  /* ========================================================================
     08. PLANOS E SIMULADOR
     ======================================================================== */

  function renderPlans() {
    const grid = $("[data-plans-grid]");
    const template = $("#tpl-plan");
    if (!grid || !template) return;

    const fragment = document.createDocumentFragment();

    PLANS.forEach((plan) => {
      const node = template.content.firstElementChild.cloneNode(true);

      node.classList.toggle("plan-card--featured", plan.featured);

      // Todos os cards recebem um selo: mantém os preços alinhados entre as colunas
      const flag = $('[data-field="flag"]', node);
      flag.textContent = plan.flag;
      flag.classList.toggle("plan-card__flag--muted", !plan.featured);

      $('[data-field="name"]', node).textContent = plan.name;
      $('[data-field="tagline"]', node).textContent = plan.tagline;
      $('[data-field="price"]', node).textContent = formatCurrency(plan.priceCents);
      $('[data-field="highlight"]', node).textContent = plan.highlight;

      const benefits = $('[data-field="benefits"]', node);
      plan.benefits.forEach((benefit) => {
        const item = document.createElement("li");
        item.textContent = benefit;
        benefits.appendChild(item);
      });

      const cta = $('[data-field="cta"]', node);
      cta.textContent = plan.ctaLabel;
      cta.classList.add(plan.featured ? "btn--gold" : "btn--outline");
      cta.addEventListener("click", () => openPlanModal(plan.id));

      fragment.appendChild(node);
    });

    grid.appendChild(fragment);
  }

  function initSimulator() {
    const range = $("#sim-range");
    const output = $("[data-sim-output]");
    const results = $("[data-sim-results]");
    const template = $("#tpl-sim-result");
    if (!range || !output || !results || !template) return;

    const min = Number(range.min);
    const max = Number(range.max);
    const resultNodes = new Map();

    PLANS.forEach((plan) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.classList.toggle("sim-result--featured", plan.featured);
      $('[data-field="plan"]', node).textContent = plan.name;
      $('[data-field="label"]', node).textContent = `de economia estimada por mês ${plan.simulationNote}`;
      resultNodes.set(plan.id, $('[data-field="value"]', node));
      results.appendChild(node);
    });

    const updateSimulator = () => {
      // Sanitiza o valor: nunca sai do intervalo permitido
      const raw = Number(range.value);
      const safeValue = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : min;
      state.monthlyPurchaseCents = Math.round(safeValue * 100);

      const monthlyLabel = formatCurrency(state.monthlyPurchaseCents);
      output.textContent = `${monthlyLabel} por mês`;
      range.setAttribute("aria-valuetext", `${monthlyLabel} por mês`);

      const inputLabel = $("[data-sim-input-label]");
      const highlight = $("[data-sim-highlight]");
      if (inputLabel) inputLabel.textContent = monthlyLabel;

      PLANS.forEach((plan) => {
        const slot = resultNodes.get(plan.id);
        const savings = Math.round(state.monthlyPurchaseCents * plan.simulationRate);
        if (slot) slot.textContent = formatCurrency(savings);
        if (highlight && plan.id === "pro") highlight.textContent = formatCurrency(savings);
      });
    };

    range.addEventListener("input", updateSimulator);
    updateSimulator();
  }


  /* ========================================================================
     09. EMBAIXADORES
     ======================================================================== */

  function renderAmbassadors() {
    const grid = $("[data-ambassadors-grid]");
    const template = $("#tpl-ambassador");
    if (!grid || !template) return;

    const fragment = document.createDocumentFragment();

    AMBASSADORS.forEach((person) => {
      const node = template.content.firstElementChild.cloneNode(true);
      const image = $(".ambassador-card__img", node);

      image.src = person.image;
      image.alt = person.alt;

      $('[data-field="name"]', node).textContent = person.name;
      $('[data-field="city"]', node).textContent = person.city;
      $('[data-field="specialty"]', node).textContent = person.specialty;
      $('[data-field="quote"]', node).textContent = person.quote;

      const cta = $('[data-field="cta"]', node);
      cta.textContent = "Conhecer embaixador";
      cta.setAttribute("aria-label", `Conhecer ${person.name}`);
      cta.addEventListener("click", () =>
        openModal({
          eyebrow: "Embaixadores",
          title: person.name,
          note: "Perfil de demonstração. Os embaixadores reais da Toni Acessórios serão anunciados em breve."
        })
      );

      fragment.appendChild(node);
    });

    grid.appendChild(fragment);
  }


  /* ========================================================================
     10. FAQ (ACCORDION)
     ======================================================================== */

  function initAccordion() {
    const accordion = $("[data-accordion]");
    if (!accordion) return;

    const triggers = $$(".accordion__trigger", accordion);

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        const expanded = trigger.getAttribute("aria-expanded") === "true";
        const panel = document.getElementById(trigger.getAttribute("aria-controls"));

        trigger.setAttribute("aria-expanded", String(!expanded));
        if (panel) panel.hidden = expanded;
      });

      trigger.addEventListener("keydown", (event) => {
        const index = triggers.indexOf(trigger);
        let nextIndex = null;

        switch (event.key) {
          case "ArrowDown":
            nextIndex = (index + 1) % triggers.length;
            break;
          case "ArrowUp":
            nextIndex = (index - 1 + triggers.length) % triggers.length;
            break;
          case "Home":
            nextIndex = 0;
            break;
          case "End":
            nextIndex = triggers.length - 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        triggers[nextIndex].focus();
      });
    });
  }


  /* ========================================================================
     11. MODAL DEMONSTRATIVO
     ======================================================================== */

  const modalRefs = {};
  let lastFocused = null;

  const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function initModal() {
    modalRefs.root = $("[data-modal]");
    if (!modalRefs.root) return;

    modalRefs.dialog = $(".modal__dialog", modalRefs.root);
    modalRefs.eyebrow = $("[data-modal-eyebrow]", modalRefs.root);
    modalRefs.title = $("[data-modal-title]", modalRefs.root);
    modalRefs.note = $("[data-modal-note]", modalRefs.root);

    $$("[data-modal-close]", modalRefs.root).forEach((element) =>
      element.addEventListener("click", closePlanModal)
    );

    document.addEventListener("keydown", (event) => {
      if (modalRefs.root.hidden) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closePlanModal();
        return;
      }

      if (event.key === "Tab") trapFocus(event);
    });

    // Botões declarativos: [data-open-modal] com contexto de plano ou de link
    $$("[data-open-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.planCta) {
          openPlanModal(button.dataset.planCta);
        } else {
          openModal({
            eyebrow: "Pro Club",
            title: button.dataset.modalContext
              ? `${button.dataset.modalContext[0].toUpperCase()}${button.dataset.modalContext.slice(1)}`
              : "Pro Club",
            note: "Esta é uma demonstração visual do projeto. Nenhum dado é enviado ou armazenado nesta página."
          });
        }
      });
    });
  }

  function openPlanModal(planId) {
    const plan = getPlanById(planId);
    openModal({
      eyebrow: "Assinatura Pro Club",
      title: `Plano ${plan.name}`,
      note: `${formatCurrency(plan.priceCents)} por mês (valor demonstrativo) • ${plan.highlight}.`
    });
  }

  function openProductModal(product) {
    const plan = getPlanById(state.planId);
    const finalPrice = calculateDiscountedPrice(product, plan);
    const savings = product.priceCents - finalPrice;

    openModal({
      eyebrow: `Benefício do nível ${plan.name}`,
      title: product.name,
      note: `De ${formatCurrency(product.priceCents)} por ${formatCurrency(finalPrice)} — economia de ${formatCurrency(
        savings
      )} (${formatPercent(getDiscountRate(product, plan))} de desconto).`
    });
  }

  function openModal({ eyebrow, title, note }) {
    if (!modalRefs.root) return;

    lastFocused = document.activeElement;

    modalRefs.eyebrow.textContent = eyebrow;
    modalRefs.title.textContent = title;
    modalRefs.note.textContent = note || "";

    modalRefs.root.hidden = false;
    scrollLock.lock("modal");

    const focusables = $$(FOCUSABLE, modalRefs.dialog);
    (focusables[0] || modalRefs.dialog).focus();
  }

  function closePlanModal() {
    if (!modalRefs.root || modalRefs.root.hidden) return;

    modalRefs.root.hidden = true;
    scrollLock.unlock("modal");

    // Só devolve o foco se o elemento de origem ainda estiver visível
    // (o botão pode estar dentro do menu mobile, que foi fechado nesse meio-tempo)
    const canRestore =
      lastFocused instanceof HTMLElement && lastFocused.isConnected && lastFocused.offsetParent !== null;

    if (canRestore) lastFocused.focus();
    else $("#nav-toggle")?.focus();

    lastFocused = null;
  }

  function trapFocus(event) {
    const focusables = $$(FOCUSABLE, modalRefs.dialog).filter(
      (element) => element.offsetParent !== null
    );
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }


  /* ========================================================================
     12. INICIALIZAÇÃO
     ======================================================================== */

  function init() {
    // Conteúdo dinâmico primeiro: o carrossel depende dos cards já renderizados
    renderProducts();
    renderPlans();
    renderAmbassadors();

    initPlanTabs();
    initCarousel();
    initSimulator();
    initAccordion();
    initModal();

    updateSavingsSummary();
    updateHeroCard();

    initHeaderScroll();
    initMobileNav();
    initSmoothScroll();
    initScrollSpy();
    initReveal();
    initCurrentYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
