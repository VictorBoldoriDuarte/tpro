/* ==========================================================================
   TPRO CLUB — Modo claro / escuro

   Carregado SEM `defer` no <head> das três páginas, de propósito: precisa
   escrever o atributo `data-theme` no <html> antes do primeiro desenho da
   tela. Com `defer`, a página apareceria clara por um instante e piscaria
   para o escuro.

   Estados:
     "light" / "dark" → escolha do usuário, gravada no navegador
     nada gravado     → segue a preferência do sistema (Windows/Android/iOS)

   O CSS não depende deste arquivo: theme.css já responde a
   `prefers-color-scheme`. Sem JavaScript, o tema do sistema continua valendo
   — só o botão de troca deixa de funcionar.
   ========================================================================== */

(() => {
  "use strict";

  const KEY = "tpro.theme.v1";

  /* Cor da barra do navegador no celular: precisa acompanhar o tema, senão
     fica uma faixa azul clara em cima de uma página escura. */
  const BAR_COLOR = { light: "#13287a", dark: "#0b1020" };

  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  /** Leitura tolerante: navegador em modo privado pode barrar o storage. */
  function stored() {
    try {
      const value = window.localStorage.getItem(KEY);
      return value === "light" || value === "dark" ? value : null;
    } catch {
      return null;
    }
  }

  /** O tema que está valendo na tela agora. */
  const effective = () => stored() || (media.matches ? "dark" : "light");

  function apply(theme) {
    // Sem escolha gravada, o atributo sai do <html> e a media query volta a mandar
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");

    const bar = document.querySelector('meta[name="theme-color"]');
    if (bar) bar.setAttribute("content", BAR_COLOR[effective()]);

    syncButtons();
  }

  /** Mantém rótulo e estado dos botões coerentes com o tema em uso. */
  function syncButtons() {
    const isDark = effective() === "dark";
    const label = isDark ? "Mudar para o modo claro" : "Mudar para o modo escuro";

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-label", label);
      button.setAttribute("title", label);
      button.setAttribute("aria-pressed", String(isDark));
    });
  }

  function toggle() {
    const next = effective() === "dark" ? "light" : "dark";

    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* sem storage o tema não persiste, mas a troca da tela ainda funciona */
    }

    apply(next);
  }

  // Aplica antes de o <body> ser desenhado
  apply(stored());

  /* Delegação no documento: o botão de cada página ainda não existe neste
     ponto, e o painel administrativo troca blocos inteiros de HTML. */
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-theme-toggle]")) toggle();
  });

  document.addEventListener("DOMContentLoaded", syncButtons, { once: true });

  // Usuário mudou o tema do sistema e nunca escolheu manualmente aqui
  media.addEventListener("change", () => {
    if (!stored()) apply(null);
  });

  // Trocou o tema em outra aba do mesmo site
  window.addEventListener("storage", (event) => {
    if (event.key === KEY) apply(stored());
  });
})();
