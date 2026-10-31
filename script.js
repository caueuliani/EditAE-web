(() => {
  "use strict";

  const bootstrap = window.EDITAE_BOOTSTRAP || {};
  const apiOverride = localStorage.getItem("editae_api_base");
  const apiBaseUrl = String(apiOverride || bootstrap.apiBaseUrl || "").replace(/\/$/, "");
  const requestTimeoutMs = Number(bootstrap.requestTimeoutMs) || 5000;

  const fallbackConfig = Object.freeze({
    mode: "prelaunch",
    downloadUrl: null,
    founderStartsAt: null,
    founderEndsAt: null,
    lifetimeRemaining: 100,
    manualActivation: false,
    checkout: {
      monthly: null,
      annual: null,
      lifetime: null
    }
  });

  const elements = {
    countdown: document.getElementById("countdown"),
    lifetime: document.getElementById("lifetime-count"),
    year: document.getElementById("year"),
    status: document.getElementById("commercial-status"),
    statusTitle: document.getElementById("commercial-status-title"),
    statusCopy: document.getElementById("commercial-status-copy"),
    founderNote: document.getElementById("founder-note"),
    downloadMessage: document.getElementById("download-message"),
    downloadButton: document.getElementById("download-button")
  };

  if (elements.year) elements.year.textContent = String(new Date().getFullYear());

  let activeConfig = fallbackConfig;
  let countdownTimer = null;

  function normalizeConfig(raw) {
    const mode = ["prelaunch", "manual", "automatic"].includes(raw?.mode)
      ? raw.mode
      : "prelaunch";

    return {
      mode,
      downloadUrl: typeof raw?.downloadUrl === "string" && raw.downloadUrl ? raw.downloadUrl : null,
      founderStartsAt: raw?.founderStartsAt || null,
      founderEndsAt: raw?.founderEndsAt || null,
      lifetimeRemaining: Number.isFinite(raw?.lifetimeRemaining)
        ? Math.max(0, Math.min(100, Math.trunc(raw.lifetimeRemaining)))
        : 100,
      manualActivation: Boolean(raw?.manualActivation),
      checkout: {
        monthly: typeof raw?.checkout?.monthly === "string" ? raw.checkout.monthly : null,
        annual: typeof raw?.checkout?.annual === "string" ? raw.checkout.annual : null,
        lifetime: typeof raw?.checkout?.lifetime === "string" ? raw.checkout.lifetime : null
      }
    };
  }

  function setLinkState(link, enabled, href, label) {
    if (!link) return;
    if (label) link.textContent = label;

    if (enabled && href) {
      link.href = href;
      link.removeAttribute("aria-disabled");
      link.classList.remove("is-disabled");
      return;
    }

    link.href = "#";
    link.setAttribute("aria-disabled", "true");
    link.classList.add("is-disabled");
  }

  function setStatus(title, copy) {
    if (!elements.status || !elements.statusTitle || !elements.statusCopy) return;
    if (!title) {
      elements.status.hidden = true;
      return;
    }

    elements.statusTitle.textContent = title;
    elements.statusCopy.textContent = copy || "";
    elements.status.hidden = false;
  }

  function renderCountdown(config) {
    if (countdownTimer) clearInterval(countdownTimer);
    if (!elements.countdown) return;

    const start = config.founderStartsAt ? new Date(config.founderStartsAt) : null;
    const end = config.founderEndsAt ? new Date(config.founderEndsAt) : null;
    const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
    const validEnd = end && !Number.isNaN(end.getTime()) ? end : null;

    if (!validEnd) {
      if (validStart && Date.now() < validStart.getTime()) {
        // Continue below and count down to the opening date.
      } else {
        elements.countdown.textContent = config.mode === "prelaunch" ? "Em breve" : "Ativa";
        return;
      }
    }

    const target = validStart && Date.now() < validStart.getTime() ? validStart : validEnd;
    const prefix = target === validStart ? "Abre em " : "";

    const render = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        if (target === validStart) {
          renderCountdown(config);
        } else {
          elements.countdown.textContent = "Encerrada";
        }
        return false;
      }

      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      elements.countdown.textContent =
        prefix +
        d + "d " +
        String(h).padStart(2, "0") + "h " +
        String(m).padStart(2, "0") + "m " +
        String(s).padStart(2, "0") + "s";
      return true;
    };

    if (render()) {
      countdownTimer = setInterval(() => {
        if (!render()) clearInterval(countdownTimer);
      }, 1000);
    }
  }

  function renderDownload(config) {
    const links = document.querySelectorAll("[data-download-link]");
    const available = Boolean(config.downloadUrl);

    links.forEach((link) => {
      setLinkState(
        link,
        available,
        config.downloadUrl,
        link.id === "download-button" ? (available ? "Baixar EditAE grátis" : "Download em breve") : "Baixar grátis"
      );
    });

    if (elements.downloadMessage) {
      elements.downloadMessage.textContent = available
        ? "Baixe o EditAE para Windows x64. O plano Free não expira e não adiciona watermark."
        : "O download público será liberado no lançamento.";
    }
  }

  // Atendimento comercial assistido: sem checkout automático ou captura de cartão no site.
  const salesWhatsapp = "5519996226692";
  const planMessages = {
    PRO_MONTHLY: "Olá! Tenho interesse em assinar o EditAE Pro Founder mensal (R$ 29,90/mês). Como posso contratar?",
    PRO_ANNUAL: "Olá! Tenho interesse em assinar o EditAE Pro Founder anual (R$ 249/ano). Como posso contratar?",
    FOUNDER_LIFETIME: "Olá! Tenho interesse no EditAE Founder Lifetime (R$ 199). Ainda há licenças disponíveis?"
  };

  function assistedSalesUrl(plan) {
    const message = planMessages[plan];
    return message ? "https://wa.me/" + salesWhatsapp + "?text=" + encodeURIComponent(message) : null;
  }

  function planUrl(config, plan) {
    if (plan === "PRO_MONTHLY") return config.checkout.monthly;
    if (plan === "PRO_ANNUAL") return config.checkout.annual;
    if (plan === "FOUNDER_LIFETIME") return config.checkout.lifetime;
    return null;
  }

  // Keep coupon UI hidden until backend subscription pricing is homologated.
  // Do not enable without server readiness and an explicit public capability flag.
  const couponUiEnabled = false;
  const couponPanel = document.getElementById("coupon-checkout-panel");
  if (couponPanel) couponPanel.hidden = !couponUiEnabled;

  function checkoutCouponCode(plan) {
    if (!couponUiEnabled || plan !== "FOUNDER_LIFETIME") return null;
    const value = document.getElementById("checkout-coupon-code")?.value.trim().toUpperCase() || "";
    if (!value) return null;
    if (!/^[A-Z0-9_-]{3,32}$/.test(value)) throw new Error("invalid_coupon_format");
    return value;
  }

  function renderCheckout(config) {
    document.querySelectorAll("[data-checkout-plan]").forEach((link) => {
      const plan = link.dataset.checkoutPlan;
      const soldOut = plan === "FOUNDER_LIFETIME" && config.lifetimeRemaining <= 0;

      if (config.mode === "prelaunch" || soldOut) {
        const label = soldOut
          ? "Founder Lifetime esgotado"
          : plan === "FOUNDER_LIFETIME" ? "Founder Lifetime em breve" : "Checkout em breve";
        setLinkState(link, false, null, label);
        return;
      }

      if (config.mode === "manual") {
        const url = assistedSalesUrl(plan);
        const label = plan === "PRO_MONTHLY"
          ? "Assinar mensal pelo WhatsApp"
          : plan === "PRO_ANNUAL"
            ? "Assinar anual pelo WhatsApp"
            : "Solicitar Lifetime pelo WhatsApp";
        setLinkState(link, Boolean(url), url, label);
        if (url) {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        }
        return;
      }

      const label = plan === "PRO_MONTHLY"
        ? "Assinar Founder"
        : plan === "PRO_ANNUAL"
          ? "Assinar Founder anual"
          : "Garantir Founder Lifetime";
      setLinkState(link, Boolean(apiBaseUrl), "#", label);
    });
  }

  function renderCommercialStatus(config) {
    if (config.mode === "manual" && config.manualActivation) {
      setStatus(
        "Lançamento assistido",
        "Durante o período inicial, algumas ativações podem ser concluídas manualmente após a confirmação do pagamento."
      );
      if (elements.founderNote) {
        elements.founderNote.textContent =
          "A Founder Window está ativa. Em caso de ativação manual, a condição Founder considera a data da confirmação do pagamento.";
      }
      return;
    }

    if (config.mode === "automatic") {
      setStatus(null);
      if (elements.founderNote) {
        elements.founderNote.textContent =
          "A Founder Window usa datas e estoque controlados pelo servidor comercial do EditAE.";
      }
      return;
    }

    setStatus(null);
  }

  function render(config) {
    activeConfig = config;
    if (elements.lifetime) {
      elements.lifetime.textContent = config.lifetimeRemaining + " / 100";
    }
    renderCountdown(config);
    renderDownload(config);
    renderCheckout(config);
    renderCommercialStatus(config);
  }

  async function fetchJson(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {})
        },
        signal: controller.signal
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadCommercialConfig() {
    if (!apiBaseUrl) return fallbackConfig;

    const load = () => fetchJson(apiBaseUrl + "/api/public/config", { method: "GET" });

    try {
      return normalizeConfig(await load());
    } catch (error) {
      if (error?.name === "AbortError") {
        console.warn("EditAE commercial config timed out; retrying once.", error);
        try {
          await new Promise((resolve) => setTimeout(resolve, 350));
          return normalizeConfig(await load());
        } catch (retryError) {
          console.warn("EditAE commercial config retry failed; safe prelaunch fallback applied.", retryError);
          return fallbackConfig;
        }
      }

      console.warn("EditAE commercial config unavailable; safe prelaunch fallback applied.", error);
      return fallbackConfig;
    }
  }

  async function startAutomaticCheckout(plan, link) {
    if (activeConfig.mode !== "automatic" || !apiBaseUrl) return;

    const original = link.textContent;
    link.setAttribute("aria-disabled", "true");
    link.classList.add("is-loading");
    link.textContent = "Abrindo checkout…";

    try {
      const session = window.EditAEAuth?.configured ? await window.EditAEAuth.session() : null;
      if (window.EditAEAuth?.configured && !session) {
        setStatus("Entre para continuar", "Faça login ou crie sua conta EditAE antes de iniciar a compra.");
        window.location.assign("./auth/");
        return;
      }
      const headers = session?.access_token
        ? { "Authorization": "Bearer " + session.access_token }
        : {};
      const couponCode = checkoutCouponCode(plan);
      const result = await fetchJson(apiBaseUrl + "/api/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({ plan, ...(couponCode ? { couponCode } : {}) })
      });

      const checkoutUrl = result?.checkoutUrl || result?.url;
      if (!checkoutUrl) throw new Error("Checkout URL ausente");
      window.location.assign(checkoutUrl);
    } catch (error) {
      console.error("Não foi possível iniciar o checkout.", error);
      if (error?.message === "invalid_coupon_format") {
        setStatus("Cupom inválido", "Use de 3 a 32 caracteres: letras, números, _ ou -.");
        link.textContent = original;
        link.removeAttribute("aria-disabled");
        link.classList.remove("is-loading");
        return;
      }
      setStatus(
        "Checkout temporariamente indisponível",
        "O download gratuito continua disponível. Tente novamente em alguns instantes."
      );
      link.textContent = original;
      link.removeAttribute("aria-disabled");
      link.classList.remove("is-loading");
    }
  }

  document.addEventListener("click", (event) => {
    const disabled = event.target.closest('[aria-disabled="true"]');
    if (disabled) {
      event.preventDefault();
      return;
    }

    const checkout = event.target.closest("[data-checkout-plan]");
    if (!checkout || activeConfig.mode !== "automatic") return;
    event.preventDefault();
    startAutomaticCheckout(checkout.dataset.checkoutPlan, checkout);
  });

  async function renderAccountNav() {
    const link = document.getElementById("account-nav-link");
    if (!link || !window.EditAEAuth?.configured) return;
    try {
      const session = await window.EditAEAuth.session();
      if (session) {
        link.textContent = "Minha conta";
        link.href = "./account/";
      }
    } catch (error) {
      console.warn("EditAE account session unavailable.", error);
    }
  }

  render(fallbackConfig);
  loadCommercialConfig().then(render);
  renderAccountNav();
})();
