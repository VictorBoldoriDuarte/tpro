/* ==========================================================================
   TPRO CLUB — Camada de dados compartilhada

   Fonte única de verdade do catálogo. A loja (loja.html) lê daqui e o painel
   administrativo (admin.html) escreve aqui. A persistência é feita no
   localStorage do navegador, então o protótipo funciona sem backend: tudo o
   que o cliente cadastrar na demonstração continua lá quando ele voltar.

   QUANDO EXISTIR BACKEND: as funções de leitura/escrita deste arquivo são o
   único ponto a ser trocado por chamadas de API. Nenhuma página fala com o
   localStorage diretamente.

   Sumário
   01. Chaves de armazenamento e utilidades
   02. Dados padrão (planos, categorias, produtos)
   03. Leitura e escrita
   04. Regras de preço
   05. Carrinho
   06. Sessão do visitante (plano simulado)
   07. Importar / exportar / restaurar
   08. Eventos
   ========================================================================== */

window.TPRO = (() => {
  "use strict";

  /* ========================================================================
     01. CHAVES E UTILIDADES
     ======================================================================== */

  const KEYS = {
    catalog: "tpro.catalog.v1",
    cart: "tpro.cart.v1",
    plan: "tpro.plan.v1",
    admin: "tpro.admin.v1"
  };

  const IMG = "assets/images/";
  const NO_IMAGE = IMG + "sem-imagem.svg";

  const currencyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

  const percentFormatter = new Intl.NumberFormat("pt-BR", {
    style: "percent",
    maximumFractionDigits: 0
  });

  /** Centavos → "R$ 1.234,56" */
  const formatCurrency = (cents) => currencyFormatter.format((Number(cents) || 0) / 100);

  /** Taxa (0.15) → "15%" */
  const formatPercent = (rate) => percentFormatter.format(Number(rate) || 0);

  /**
   * Texto digitado pelo usuário → centavos.
   * Aceita "1.299,90", "1299.90" e "1299,9".
   */
  function parseMoneyToCents(value) {
    if (typeof value === "number") return Math.round(value * 100);
    const clean = String(value ?? "")
      .replace(/[^\d,.-]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar
      .replace(",", ".");
    const parsed = Number.parseFloat(clean);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  /** "15" ou "15%" → 0.15 (limitado entre 0 e 0,95) */
  function parsePercentToRate(value) {
    const parsed = Number.parseFloat(String(value ?? "").replace(",", ".").replace("%", ""));
    if (!Number.isFinite(parsed)) return null;
    return Math.min(0.95, Math.max(0, parsed / 100));
  }

  const slugify = (text) =>
    String(text)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);

  /** Texto sem acento e em minúsculas — usado na busca da loja. */
  const normalize = (text) =>
    String(text ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const uid = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const clone = (value) => JSON.parse(JSON.stringify(value));


  /* ========================================================================
     02. DADOS PADRÃO
     ------------------------------------------------------------------------
     ALTERAR AQUI o catálogo inicial da demonstração. Depois que o cliente
     mexer no painel, o que vale é o que está salvo no navegador — o botão
     "Restaurar catálogo padrão" volta para estes valores.
     ======================================================================== */

  /**
   * Planos do clube.
   * `defaultDiscount` → desconto aplicado quando o produto não define um
   * percentual próprio para aquele plano.
   * ATENÇÃO: preços demonstrativos, a confirmar com o cliente.
   */
  const DEFAULT_PLANS = [
    {
      id: "basic",
      name: "Basic",
      priceCents: 2990,
      defaultDiscount: 0.05,
      tagline: "Acesso inicial",
      order: 1
    },
    {
      id: "pro",
      name: "Pro",
      priceCents: 5990,
      defaultDiscount: 0.15,
      tagline: "Melhor custo-benefício",
      featured: true,
      order: 2
    },
    {
      id: "elite",
      name: "Elite",
      priceCents: 9990,
      defaultDiscount: 0.3,
      tagline: "Acesso total + vantagens",
      order: 3
    }
  ];

  const DEFAULT_CATEGORIES = [
    { id: "maquinas", name: "Máquinas e aparadores" },
    { id: "laminas", name: "Lâminas e navalhas" },
    { id: "tesouras", name: "Tesouras" },
    { id: "acessorios", name: "Acessórios" },
    { id: "eletricos", name: "Elétricos" },
    { id: "finalizadores", name: "Finalizadores" },
    { id: "barba", name: "Linha barba" },
    { id: "higiene", name: "Higiene e limpeza" },
    { id: "mobiliario", name: "Mobiliário" }
  ];

  const DEFAULT_PRODUCTS = [
    {
      id: "maquina-corte",
      name: "Máquina de corte profissional TX-900",
      brand: "BarberMax",
      sku: "MX-TX900",
      category: "maquinas",
      description:
        "Motor rotativo de alto torque, lâmina em aço japonês e bateria de 3 horas de uso contínuo. Feita para barbearia com movimento alto, mantendo o corte firme do primeiro ao último cliente do dia.",
      priceCents: 89900,
      discounts: { basic: 0.05, pro: 0.15, elite: 0.35 },
      images: [IMG + "produto-maquina-corte.svg", IMG + "produto-shaver.svg", IMG + "produto-trimmer.svg"],
      stock: 24,
      rating: 4.8,
      reviews: 132,
      featured: true,
      active: true
    },
    {
      id: "shaver",
      name: "Shaver profissional de acabamento",
      brand: "BarberMax",
      sku: "MX-SH40",
      category: "maquinas",
      description:
        "Shaver de lâmina dupla para acabamento rente, contorno de barba e raspagem sem irritar a pele. Cabeça flutuante e corpo antiderrapante.",
      priceCents: 34900,
      discounts: { basic: 0.05, pro: 0.15, elite: 0.3 },
      images: [IMG + "produto-shaver.svg", IMG + "produto-maquina-corte.svg"],
      stock: 41,
      rating: 4.6,
      reviews: 88,
      featured: true,
      active: true
    },
    {
      id: "trimmer",
      name: "Trimmer sem fio para desenho e risco",
      brand: "NovaCut",
      sku: "NC-TR12",
      category: "maquinas",
      description:
        "Trimmer leve com lâmina T de precisão para riscos, desenhos e acabamento de nuca. Carga rápida por USB-C e autonomia de 2 horas.",
      priceCents: 27900,
      discounts: { basic: 0.05, pro: 0.15, elite: 0.28 },
      images: [IMG + "produto-trimmer.svg"],
      stock: 33,
      rating: 4.5,
      reviews: 64,
      featured: false,
      active: true
    },
    {
      id: "lamina",
      name: "Lâmina navalhete premium — caixa com 100 unidades",
      brand: "SharpEdge",
      sku: "SE-LN100",
      category: "laminas",
      description:
        "Lâmina de aço inoxidável com fio duplo, ideal para acabamento e barba. Caixa fechada com 100 unidades — item de giro rápido na barbearia.",
      priceCents: 12900,
      discounts: { basic: 0.08, pro: 0.2, elite: 0.7 },
      images: [IMG + "produto-lamina.svg", IMG + "produto-navalha.svg"],
      stock: 180,
      rating: 4.9,
      reviews: 241,
      featured: true,
      active: true
    },
    {
      id: "navalha",
      name: "Navalha profissional cabo em alumínio",
      brand: "SharpEdge",
      sku: "SE-NV01",
      category: "laminas",
      description:
        "Cabo em alumínio usinado com trava de segurança e encaixe universal para lâmina navalhete. Peso equilibrado para trabalho longo sem cansar o punho.",
      priceCents: 8900,
      discounts: { basic: 0.07, pro: 0.18, elite: 0.55 },
      images: [IMG + "produto-navalha.svg"],
      stock: 67,
      rating: 4.7,
      reviews: 95,
      featured: false,
      active: true
    },
    {
      id: "tesoura",
      name: 'Tesoura fio navalha 6" em aço japonês',
      brand: "CorteFino",
      sku: "CF-TS06",
      category: "tesouras",
      description:
        "Aço japonês 440C com fio navalha, parafuso ajustável e apoio de dedo removível. Corte limpo em fio a fio, cabelo seco ou molhado.",
      priceCents: 39900,
      discounts: { basic: 0.05, pro: 0.15, elite: 0.4 },
      images: [IMG + "produto-tesoura.svg"],
      stock: 18,
      rating: 4.8,
      reviews: 57,
      featured: true,
      active: true
    },
    {
      id: "pentes",
      name: "Kit de pentes profissionais — 6 peças",
      brand: "TPRO Line",
      sku: "TP-KP06",
      category: "acessorios",
      description:
        "Seis pentes em material antiestático e resistente a calor, com dentes de espaçamentos diferentes para degradê, tesoura sobre pente e finalização.",
      priceCents: 8900,
      discounts: { basic: 0.06, pro: 0.18, elite: 0.4 },
      images: [IMG + "produto-pentes.svg"],
      stock: 92,
      rating: 4.6,
      reviews: 74,
      featured: false,
      active: true
    },
    {
      id: "capa",
      name: "Capa profissional impermeável antiestática",
      brand: "TPRO Line",
      sku: "TP-CP01",
      category: "acessorios",
      description:
        "Tecido impermeável com tratamento antiestático que não deixa o cabelo grudar. Fecho ajustável e costura reforçada para lavagem diária.",
      priceCents: 15900,
      discounts: { basic: 0.07, pro: 0.2, elite: 0.5 },
      images: [IMG + "produto-capa.svg", IMG + "produto-toalha.svg"],
      stock: 55,
      rating: 4.5,
      reviews: 61,
      featured: false,
      active: true
    },
    {
      id: "secador",
      name: "Secador profissional 2200W com difusor",
      brand: "NovaCut",
      sku: "NC-SC22",
      category: "eletricos",
      description:
        "Motor AC profissional de 2200W, três temperaturas, jato de ar frio e difusor incluso. Cabo de 3 metros para trabalhar solto na cadeira.",
      priceCents: 42900,
      discounts: { basic: 0.05, pro: 0.14, elite: 0.25 },
      images: [IMG + "produto-secador.svg"],
      stock: 12,
      rating: 4.4,
      reviews: 39,
      featured: false,
      active: true
    },
    {
      id: "pomada",
      name: "Pomada modeladora efeito matte 150g",
      brand: "Barba Real",
      sku: "BR-PM15",
      category: "finalizadores",
      description:
        "Fixação forte com acabamento seco, sem brilho e sem pesar no fio. Sai fácil na lavagem e não deixa resíduo branco.",
      priceCents: 6900,
      discounts: { basic: 0.1, pro: 0.25, elite: 0.6 },
      images: [IMG + "produto-pomada.svg", IMG + "produto-shampoo.svg"],
      stock: 210,
      rating: 4.9,
      reviews: 318,
      featured: true,
      active: true
    },
    {
      id: "shampoo",
      name: "Shampoo profissional para barbearia 1L",
      brand: "Barba Real",
      sku: "BR-SH1L",
      category: "higiene",
      description:
        "Fórmula concentrada de alto rendimento para lavatório de barbearia. Limpa sem ressecar e prepara o fio para o corte.",
      priceCents: 7900,
      discounts: { basic: 0.09, pro: 0.22, elite: 0.45 },
      images: [IMG + "produto-shampoo.svg"],
      stock: 140,
      rating: 4.7,
      reviews: 152,
      featured: false,
      active: true
    },
    {
      id: "oleo-barba",
      name: "Óleo para barba 30ml — madeira e âmbar",
      brand: "Barba Real",
      sku: "BR-OB30",
      category: "barba",
      description:
        "Blend de óleos vegetais que hidrata a barba e a pele por baixo dela, controlando o frizz. Fragrância amadeirada de fixação média.",
      priceCents: 5900,
      discounts: { basic: 0.1, pro: 0.24, elite: 0.58 },
      images: [IMG + "produto-oleo-barba.svg", IMG + "produto-escova-barba.svg"],
      stock: 175,
      rating: 4.8,
      reviews: 201,
      featured: false,
      active: true
    },
    {
      id: "escova-barba",
      name: "Escova para barba com cerdas naturais",
      brand: "Barba Real",
      sku: "BR-EB01",
      category: "barba",
      description:
        "Cerdas naturais de javali em base de madeira, para alinhar a barba, distribuir o óleo e dar acabamento no atendimento.",
      priceCents: 5900,
      discounts: { basic: 0.08, pro: 0.2, elite: 0.45 },
      images: [IMG + "produto-escova-barba.svg"],
      stock: 88,
      rating: 4.6,
      reviews: 77,
      featured: false,
      active: true
    },
    {
      id: "borrifador",
      name: "Borrifador profissional 500ml névoa fina",
      brand: "TPRO Line",
      sku: "TP-BF50",
      category: "acessorios",
      description:
        "Gatilho de névoa fina e uniforme, sem pingar. Corpo resistente a produtos químicos e alça antiderrapante.",
      priceCents: 3900,
      discounts: { basic: 0.06, pro: 0.16, elite: 0.35 },
      images: [IMG + "produto-borrifador.svg"],
      stock: 0,
      rating: 4.3,
      reviews: 44,
      featured: false,
      active: true
    },
    {
      id: "toalha",
      name: "Kit de toalhas profissionais — 6 unidades",
      brand: "TPRO Line",
      sku: "TP-TW06",
      category: "acessorios",
      description:
        "Algodão de gramatura alta, secagem rápida e alta durabilidade em lavagem industrial. Ideal para toalha quente e finalização.",
      priceCents: 11900,
      discounts: { basic: 0.08, pro: 0.2, elite: 0.42 },
      images: [IMG + "produto-toalha.svg"],
      stock: 47,
      rating: 4.5,
      reviews: 52,
      featured: false,
      active: true
    },
    {
      id: "cadeira",
      name: "Cadeira de barbeiro reclinável com apoio",
      brand: "BarberMax",
      sku: "MX-CD01",
      category: "mobiliario",
      description:
        "Estrutura reforçada, pistão hidráulico, reclínio até 45° e apoio de pés em aço. Estofado em couro sintético de fácil higienização.",
      priceCents: 289900,
      discounts: { basic: 0.04, pro: 0.12, elite: 0.22 },
      images: [IMG + "produto-cadeira.svg"],
      stock: 6,
      rating: 4.7,
      reviews: 28,
      featured: false,
      active: true
    }
  ];


  /* ========================================================================
     03. LEITURA E ESCRITA
     ======================================================================== */

  /** Garante que todo produto tenha os campos esperados pelas telas. */
  function normalizeProduct(raw, index = 0) {
    const images = Array.isArray(raw.images) ? raw.images.filter(Boolean) : [];
    if (!images.length && raw.image) images.push(raw.image);

    const discounts = raw.discounts && typeof raw.discounts === "object" ? raw.discounts : {};

    return {
      id: raw.id || uid("prod"),
      name: String(raw.name || "Produto sem nome"),
      brand: String(raw.brand || ""),
      sku: String(raw.sku || ""),
      category: raw.category || "acessorios",
      description: String(raw.description || ""),
      priceCents: Math.max(0, Math.round(Number(raw.priceCents) || 0)),
      discounts: {
        basic: typeof discounts.basic === "number" ? discounts.basic : null,
        pro: typeof discounts.pro === "number" ? discounts.pro : null,
        elite: typeof discounts.elite === "number" ? discounts.elite : null
      },
      images: images.length ? images : [NO_IMAGE],
      stock: Math.max(0, Math.round(Number(raw.stock) || 0)),
      rating: Math.min(5, Math.max(0, Number(raw.rating) || 0)),
      reviews: Math.max(0, Math.round(Number(raw.reviews) || 0)),
      featured: Boolean(raw.featured),
      active: raw.active !== false,
      order: Number.isFinite(Number(raw.order)) ? Number(raw.order) : index,
      createdAt: raw.createdAt || new Date().toISOString(),

      // Compatibilidade com a landing page (script.js), que usa estes nomes
      get image() {
        return this.images[0];
      }
    };
  }

  function defaultCatalog() {
    return {
      version: 1,
      plans: clone(DEFAULT_PLANS),
      categories: clone(DEFAULT_CATEGORIES),
      products: DEFAULT_PRODUCTS.map((product, index) => ({ ...clone(product), order: index })),
      updatedAt: new Date().toISOString()
    };
  }

  /** Cache em memória: evita reprocessar o JSON a cada leitura. */
  let cache = null;

  function readCatalog() {
    if (cache) return cache;

    let stored = null;
    try {
      const raw = window.localStorage.getItem(KEYS.catalog);
      if (raw) stored = JSON.parse(raw);
    } catch (error) {
      console.warn("TPRO: catálogo salvo inválido, voltando para o padrão.", error);
    }

    const base = stored && Array.isArray(stored.products) ? stored : defaultCatalog();

    cache = {
      version: base.version || 1,
      plans: (Array.isArray(base.plans) && base.plans.length ? base.plans : DEFAULT_PLANS).map((plan) => ({
        ...plan,
        priceCents: Math.max(0, Math.round(Number(plan.priceCents) || 0)),
        defaultDiscount: Math.min(0.95, Math.max(0, Number(plan.defaultDiscount) || 0))
      })),
      categories:
        Array.isArray(base.categories) && base.categories.length ? base.categories : clone(DEFAULT_CATEGORIES),
      products: base.products.map(normalizeProduct),
      updatedAt: base.updatedAt || new Date().toISOString()
    };

    return cache;
  }

  function writeCatalog(next) {
    cache = next;
    cache.updatedAt = new Date().toISOString();

    try {
      window.localStorage.setItem(KEYS.catalog, JSON.stringify(cache, replacerWithoutGetters));
    } catch (error) {
      // Cota estourada normalmente significa imagem grande demais em base64
      const quota = error && (error.name === "QuotaExceededError" || error.code === 22);
      emit("error", {
        message: quota
          ? "Não foi possível salvar: o navegador atingiu o limite de armazenamento. Use imagens menores ou informe a URL da foto."
          : "Não foi possível salvar as alterações neste navegador."
      });
      return false;
    }

    emit("change", cache);
    return true;
  }

  /** O getter `image` é derivado — não precisa (nem deve) ir para o storage. */
  function replacerWithoutGetters(key, value) {
    return key === "image" ? undefined : value;
  }


  /* ========================================================================
     04. REGRAS DE PREÇO
     ======================================================================== */

  const getPlans = () => readCatalog().plans.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  const getPlanById = (planId) => readCatalog().plans.find((plan) => plan.id === planId) || null;

  const getCategories = () => readCatalog().categories.slice();

  const getCategoryName = (categoryId) =>
    getCategories().find((category) => category.id === categoryId)?.name || "Sem categoria";

  /** Todos os produtos, inclusive os desativados (uso do painel). */
  const getAllProducts = () => readCatalog().products.slice().sort((a, b) => (a.order || 0) - (b.order || 0));

  /** Apenas o que o cliente final enxerga na loja. */
  const getProducts = () => getAllProducts().filter((product) => product.active);

  const getProductById = (id) => readCatalog().products.find((product) => product.id === id) || null;

  const getBrands = () =>
    Array.from(new Set(getProducts().map((product) => product.brand).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );

  /**
   * Desconto de um produto em um plano.
   * `planId` nulo ou "visitante" significa quem não é membro: preço cheio.
   */
  function discountFor(product, planId) {
    if (!planId || planId === "visitante") return 0;
    const own = product?.discounts?.[planId];
    if (typeof own === "number") return own;
    return getPlanById(planId)?.defaultDiscount || 0;
  }

  /** Preço final em centavos. */
  const priceFor = (product, planId) =>
    Math.round((product?.priceCents || 0) * (1 - discountFor(product, planId)));

  /** Quanto o membro deixa de pagar. */
  const savingsFor = (product, planId) => (product?.priceCents || 0) - priceFor(product, planId);

  /** Maior desconto disponível no clube — usado no selo do card. */
  function bestDiscountFor(product) {
    return getPlans().reduce((best, plan) => Math.max(best, discountFor(product, plan.id)), 0);
  }


  /* ========================================================================
     05. CARRINHO
     ======================================================================== */

  function readCart() {
    try {
      const raw = window.localStorage.getItem(KEYS.cart);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeCart(items) {
    try {
      window.localStorage.setItem(KEYS.cart, JSON.stringify(items));
    } catch {
      /* carrinho é descartável: falhar em salvar não pode quebrar a página */
    }
    emit("cart", items);
    return items;
  }

  const cart = {
    items: () => readCart().filter((item) => getProductById(item.id)),

    count() {
      return this.items().reduce((total, item) => total + item.qty, 0);
    },

    add(productId, qty = 1) {
      const items = readCart();
      const existing = items.find((item) => item.id === productId);
      if (existing) existing.qty = Math.min(99, existing.qty + qty);
      else items.push({ id: productId, qty: Math.min(99, Math.max(1, qty)) });
      return writeCart(items);
    },

    setQty(productId, qty) {
      const items = readCart();
      const target = items.find((item) => item.id === productId);
      if (!target) return items;

      const safeQty = Math.max(0, Math.min(99, Math.round(qty)));
      if (safeQty === 0) return this.remove(productId);

      target.qty = safeQty;
      return writeCart(items);
    },

    remove(productId) {
      return writeCart(readCart().filter((item) => item.id !== productId));
    },

    clear() {
      return writeCart([]);
    },

    /** Totais no plano informado + comparação com o preço de balcão. */
    totals(planId) {
      return this.items().reduce(
        (acc, item) => {
          const product = getProductById(item.id);
          if (!product) return acc;

          acc.items += item.qty;
          acc.fullCents += product.priceCents * item.qty;
          acc.totalCents += priceFor(product, planId) * item.qty;
          return acc;
        },
        { items: 0, fullCents: 0, totalCents: 0, get savingsCents() {
          return this.fullCents - this.totalCents;
        } }
      );
    }
  };


  /* ========================================================================
     06. SESSÃO DO VISITANTE
     ------------------------------------------------------------------------
     Na demonstração o visitante escolhe qual plano quer "vestir" para ver os
     preços. Com backend, isso viria da assinatura ativa da conta.
     ======================================================================== */

  function getSessionPlan() {
    const stored = window.localStorage.getItem(KEYS.plan);
    if (stored === "visitante") return "visitante";
    return getPlanById(stored) ? stored : "pro";
  }

  function setSessionPlan(planId) {
    const value = planId === "visitante" || getPlanById(planId) ? planId : "pro";
    window.localStorage.setItem(KEYS.plan, value);
    emit("plan", value);
    return value;
  }


  /* ========================================================================
     07. ESCRITA DO PAINEL, IMPORTAR / EXPORTAR / RESTAURAR
     ======================================================================== */

  /** Cria ou atualiza um produto. Devolve o produto salvo. */
  function saveProduct(data) {
    const catalog = readCatalog();
    const isNew = !data.id || !getProductById(data.id);

    const product = normalizeProduct(
      {
        ...data,
        id: data.id || uid("prod"),
        createdAt: isNew ? new Date().toISOString() : getProductById(data.id).createdAt
      },
      isNew ? catalog.products.length : 0
    );

    if (isNew) {
      product.order = catalog.products.length;
      catalog.products.push(product);
    } else {
      const index = catalog.products.findIndex((item) => item.id === product.id);
      product.order = catalog.products[index].order;
      catalog.products[index] = product;
    }

    return writeCatalog(catalog) ? product : null;
  }

  function deleteProduct(id) {
    const catalog = readCatalog();
    catalog.products = catalog.products.filter((product) => product.id !== id);
    return writeCatalog(catalog);
  }

  function duplicateProduct(id) {
    const source = getProductById(id);
    if (!source) return null;

    return saveProduct({
      ...clone(source),
      id: null,
      sku: source.sku ? `${source.sku}-COPIA` : "",
      name: `${source.name} (cópia)`,
      featured: false,
      active: false
    });
  }

  function toggleProductActive(id) {
    const product = getProductById(id);
    if (!product) return null;
    return saveProduct({ ...clone(product), active: !product.active });
  }

  function saveCategory(data) {
    const catalog = readCatalog();
    const id = data.id || slugify(data.name) || uid("cat");
    const index = catalog.categories.findIndex((category) => category.id === id);
    const category = { id, name: String(data.name || "").trim() || "Nova categoria" };

    if (index >= 0) catalog.categories[index] = category;
    else catalog.categories.push(category);

    return writeCatalog(catalog) ? category : null;
  }

  /** Remove a categoria e realoca os produtos dela para `fallbackId`. */
  function deleteCategory(id, fallbackId = "acessorios") {
    const catalog = readCatalog();
    if (catalog.categories.length <= 1) return false;

    const target = catalog.categories.find((category) => category.id !== id)?.id || fallbackId;
    catalog.categories = catalog.categories.filter((category) => category.id !== id);
    catalog.products.forEach((product) => {
      if (product.category === id) product.category = target;
    });

    return writeCatalog(catalog);
  }

  function savePlan(data) {
    const catalog = readCatalog();
    const index = catalog.plans.findIndex((plan) => plan.id === data.id);
    if (index < 0) return false;

    catalog.plans[index] = {
      ...catalog.plans[index],
      name: String(data.name || catalog.plans[index].name),
      tagline: String(data.tagline ?? catalog.plans[index].tagline),
      priceCents: Math.max(0, Math.round(Number(data.priceCents) || 0)),
      defaultDiscount: Math.min(0.95, Math.max(0, Number(data.defaultDiscount) || 0))
    };

    return writeCatalog(catalog);
  }

  function countProductsInCategory(categoryId) {
    return readCatalog().products.filter((product) => product.category === categoryId).length;
  }

  function exportCatalog() {
    return JSON.stringify(readCatalog(), replacerWithoutGetters, 2);
  }

  function importCatalog(json) {
    try {
      const parsed = typeof json === "string" ? JSON.parse(json) : json;
      if (!parsed || !Array.isArray(parsed.products)) throw new Error("formato inválido");

      cache = null;
      window.localStorage.setItem(KEYS.catalog, JSON.stringify(parsed));
      cache = null;
      readCatalog();
      emit("change", cache);
      return true;
    } catch (error) {
      emit("error", { message: "Arquivo inválido: verifique se é um backup exportado pelo painel." });
      return false;
    }
  }

  function resetCatalog() {
    cache = null;
    window.localStorage.removeItem(KEYS.catalog);
    readCatalog();
    emit("change", cache);
    return true;
  }


  /* ========================================================================
     08. EVENTOS
     ------------------------------------------------------------------------
     Permite que a loja aberta em outra aba se atualize sozinha quando o
     painel salva alguma coisa — bom para demonstrar ao vivo.
     ======================================================================== */

  const listeners = new Map();

  function on(eventName, callback) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(callback);
    return () => listeners.get(eventName).delete(callback);
  }

  function emit(eventName, payload) {
    listeners.get(eventName)?.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error("TPRO: erro em listener de", eventName, error);
      }
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key === KEYS.catalog) {
      cache = null;
      emit("change", readCatalog());
    } else if (event.key === KEYS.cart) {
      emit("cart", readCart());
    } else if (event.key === KEYS.plan) {
      emit("plan", getSessionPlan());
    }
  });


  /* ======================================================================== */

  return {
    KEYS,
    NO_IMAGE,

    // utilidades
    formatCurrency,
    formatPercent,
    parseMoneyToCents,
    parsePercentToRate,
    slugify,
    normalize,
    uid,

    // leitura
    getPlans,
    getPlanById,
    getCategories,
    getCategoryName,
    getProducts,
    getAllProducts,
    getProductById,
    getBrands,
    countProductsInCategory,

    // preços
    discountFor,
    priceFor,
    savingsFor,
    bestDiscountFor,

    // escrita
    saveProduct,
    deleteProduct,
    duplicateProduct,
    toggleProductActive,
    saveCategory,
    deleteCategory,
    savePlan,

    // dados
    exportCatalog,
    importCatalog,
    resetCatalog,

    // carrinho e sessão
    cart,
    getSessionPlan,
    setSessionPlan,

    // eventos
    on
  };
})();
