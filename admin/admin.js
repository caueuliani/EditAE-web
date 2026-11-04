(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const connectionForm = $("connection-form");
  const commercialForm = $("commercial-form");
  const panel = $("commercial-panel");
  const couponsPanel = $("coupons-panel");
  const salesPanel = $("sales-panel");
  const trialsPanel = $("trials-panel");
  const connectionStatus = $("connection-status");
  const saveStatus = $("save-status");


  const dashboardPanel = $("dashboard-panel");
  const tabsNav = $("admin-tabs");
  const sections = {
    dashboard: dashboardPanel, commercial: panel,
    sales: salesPanel, trials: trialsPanel, coupons: couponsPanel
  };
  let currentTab = "dashboard";
  let connected = false;

  function chooseTab(name) {
    if (!connected || !Object.hasOwn(sections, name)) return;
    currentTab = name;
    for (const [key, section] of Object.entries(sections)) {
      section.hidden = key !== name;
    }
    for (const button of tabsNav.querySelectorAll("[data-tab]")) {
      button.setAttribute("aria-selected", String(button.dataset.tab === name));
      button.tabIndex = button.dataset.tab === name ? 0 : -1;
    }
  }
  for (const button of tabsNav.querySelectorAll("[data-tab]")) {
    button.addEventListener("click", () => chooseTab(button.dataset.tab));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const buttons = Array.from(tabsNav.querySelectorAll("[data-tab]"));
      const pos = buttons.indexOf(button);
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
        (pos + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next].focus();
      chooseTab(buttons[next].dataset.tab);
    });
  }

  function disconnectPanels() {
    connected = false;
    tabsNav.hidden = true;
    for (const section of Object.values(sections)) section.hidden = true;
  }

  const formatNumber = (number) => new Intl.NumberFormat("pt-BR").format(number);
  const formatMoney = (cents) => new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL"
  }).format(Number(cents) / 100);

  function card(label, value, note) {
    const item = document.createElement("div");
    item.className = "analytics-metric";
    const caption = document.createElement("small");
    caption.textContent = label;
    const number = document.createElement("strong");
    number.textContent = value;
    const explanation = document.createElement("small");
    explanation.textContent = note;
    item.append(caption, number, explanation);
    return item;
  }

  async function loadAnalytics() {
    setStatus($("dashboard-status"), "Consultando dados comerciais…");
    try {
      const a = await request("/api/admin/analytics");
      // Fail closed if an old server does not provide per-environment data.
      if (!a.production || !a.sandbox || !a.unknown) {
        throw new Error("Atualize o EditAE Server antes de consultar o faturamento por ambiente.");
      }
      const grid = $("analytics-grid");
      const p = a.production;
      grid.replaceChildren(
        card("Checkouts — produção", formatNumber(p.checkouts_total), "Pedidos iniciados no Asaas real"),
        card("Pagamentos aprovados — produção", formatNumber(p.orders_with_approved_payment), "Registros aprovados e aplicados; concilie com Asaas"),
        card("Recebimentos — produção", formatMoney(p.gross_approved_cents), "Estimativa bruta registrada; não é saldo Asaas"),
        card("Assinaturas — produção", formatNumber(p.active_subscriptions), "Mensal: " + p.active_monthly + " · Anual: " + p.active_annual),
        card("MRR — produção", formatMoney(p.mrr_cents), "Projeção mensal; exclui Lifetime"),
        card("Founder — produção", formatNumber(p.founder_customers), "Compradores com pagamento registrado"),
        card("Licenças pagas — produção", formatNumber(p.active_paid_licenses), "Exclui convites temporários"),
        card("Testes Pro ativos", formatNumber(a.trial_active), "Convites emitidos: " + a.trial_invitations),
        card("Clientes de checkout (todos os ambientes)", formatNumber(a.checkout_customers), "Com conta vinculada: " + a.checkout_customers_with_account)
      );
      const detail = $("payment-origin-breakdown");
      detail.replaceChildren();
      for (const [name, source] of [["Sandbox / testes", a.sandbox], ["Origem não identificada", a.unknown]]) {
        const section = document.createElement("div");
        section.className = "analytics-row";
        const label = document.createElement("span");
        label.textContent = name + " · " + formatNumber(source.checkouts_total) + " checkouts · " +
          formatNumber(source.orders_with_approved_payment) + " pedidos aprovados · " +
          formatNumber(source.active_subscriptions) + " assinaturas";
        const amount = document.createElement("strong");
        amount.textContent = formatMoney(source.gross_approved_cents) + " (não é receita confirmada de produção)";
        section.append(label, amount);
        detail.append(section);
      }
      $("analytics-limits").textContent = a.limitations +
        " Ainda não há contagem de instalações únicas, usuários ativos ou vídeos processados.";
      setStatus($("dashboard-status"), "Dados por ambiente atualizados em " +
        new Date(a.generated_at * 1000).toLocaleString("pt-BR") + ".", "ok");
    } catch (error) {
      $("analytics-grid").replaceChildren();
      $("payment-origin-breakdown").replaceChildren();
      setStatus($("dashboard-status"), "Métricas indisponíveis: " + error.message, "error");
    }
  }

  async function loadDownloads() {
    const status = $("downloads-status");
    status.textContent = "Consultando downloads do GitHub…";
    const list = $("downloads-list");
    list.replaceChildren();
    try {
      const response = await fetch("https://api.github.com/repos/caueuliani/EditAE-Downloads/releases?per_page=30",
        { headers: { "Accept": "application/vnd.github+json" }, cache: "no-store" });
      if (!response.ok) throw new Error("GitHub HTTP " + response.status);
      const releases = await response.json();
      let total = 0;
      for (const release of releases) {
        const installers = release.assets.filter(asset => asset.name === "EditAE-Setup.exe" ||
          /^EditAE_[0-9]+\.[0-9]+\.[0-9]+_x64-setup\.exe$/i.test(asset.name));
        const count = installers.reduce((sum, asset) => sum + asset.download_count, 0);
        total += count;
        const row = document.createElement("div");
        row.className = "analytics-row";
        const name = document.createElement("span");
        name.textContent = release.tag_name;
        const amount = document.createElement("strong");
        amount.textContent = formatNumber(count) + " downloads";
        row.append(name, amount);
        list.append(row);
      }
      status.textContent = formatNumber(total) + " downloads de instaladores registrados nos assets atualmente disponíveis. Não representa pessoas únicas.";
    } catch (error) {
      status.textContent = "Downloads indisponíveis no momento: " + error.message;
    }
  }

  async function refreshDashboard() {
    if (!connected) return;
    await Promise.all([loadAnalytics(), loadDownloads()]);
  }

  $("refresh-dashboard").addEventListener("click", () => void refreshDashboard());

  let apiBase = localStorage.getItem("editae_admin_api_base") || "";
  let token = "";

  $("api-base").value = apiBase;

  function normalizedBase(value) {
    return String(value || "").trim().replace(/\/$/, "");
  }

  function authHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    };
  }

  function setStatus(element, message, kind = "") {
    element.textContent = message;
    element.className = "admin-status" + (kind ? " " + kind : "");
  }

  async function request(path, options = {}) {
    if (!apiBase || !token) throw new Error("Conexão administrativa não configurada.");
    const response = await fetch(apiBase + path, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {})
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error("Acesso administrativo negado.");
    }

    if (!response.ok) {
      throw new Error("EditAE.Server respondeu HTTP " + response.status + ".");
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  function toLocalInput(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function toIsoOrNull(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function populate(config) {
    $("mode").value = config.mode || "prelaunch";
    $("download-url").value = config.downloadUrl || "";
    $("founder-starts-at").value = toLocalInput(config.founderStartsAt);
    $("founder-ends-at").value = toLocalInput(config.founderEndsAt);
    $("lifetime-remaining").value = Number.isFinite(config.lifetimeRemaining)
      ? String(config.lifetimeRemaining)
      : "100";
    $("manual-activation").checked = Boolean(config.manualActivation);
    $("checkout-monthly").value = config.checkout?.monthly || "";
    $("checkout-annual").value = config.checkout?.annual || "";
    $("checkout-lifetime").value = config.checkout?.lifetime || "";
  }

  function payload() {
    return {
      mode: $("mode").value,
      downloadUrl: $("download-url").value.trim() || null,
      founderStartsAt: toIsoOrNull($("founder-starts-at").value),
      founderEndsAt: toIsoOrNull($("founder-ends-at").value),
      lifetimeRemaining: Math.max(0, Math.min(100, Number($("lifetime-remaining").value) || 0)),
      manualActivation: $("manual-activation").checked,
      checkout: {
        monthly: $("checkout-monthly").value.trim() || null,
        annual: $("checkout-annual").value.trim() || null,
        lifetime: $("checkout-lifetime").value.trim() || null
      }
    };
  }

  async function loadConfig() {
    setStatus(connectionStatus, "Conectando…");
    const config = await request("/api/admin/config");
    populate(config);
    connected = true;
    tabsNav.hidden = false;
    chooseTab(currentTab);
    void refreshDashboard();
    try { await loadTrials(); }
    catch (error) { setStatus($("trial-status"), error.message, "error"); }
    try { await loadCoupons(); }
    catch (error) { setStatus($("coupon-status"), error.message, "error"); }
    setStatus(connectionStatus, "Conectado ao EditAE.Server.", "ok");
  }

  connectionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    apiBase = normalizedBase($("api-base").value);
    token = $("admin-token").value;
    localStorage.setItem("editae_admin_api_base", apiBase);

    try {
      await loadConfig();
      $("admin-token").value = "";
    } catch (error) {
      token = "";
      disconnectPanels();
      $("trial-created").hidden = true;
      $("trial-created-code").textContent = "";
      setStatus(connectionStatus, error.message, "error");
    }
  });

  $("disconnect").addEventListener("click", () => {
    token = "";
    disconnectPanels();
    $("admin-token").value = "";
    setStatus(connectionStatus, "Desconectado.");
  });

  $("refresh").addEventListener("click", async () => {
    try {
      await loadConfig();
      setStatus(saveStatus, "Configuração recarregada.", "ok");
    } catch (error) {
      setStatus(saveStatus, error.message, "error");
    }
  });

  commercialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(saveStatus, "Salvando…");

    try {
      const updated = await request("/api/admin/config", {
        method: "PUT",
        body: JSON.stringify(payload())
      });
      if (updated) populate(updated);
      setStatus(saveStatus, "Configuração salva.", "ok");
    } catch (error) {
      setStatus(saveStatus, error.message, "error");
    }
  });

  $("sales-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = $("sales-code").value.trim().toUpperCase();
    const resultBox = $("sales-result");
    resultBox.hidden = true;
    setStatus($("sales-status"), "Validando código…");
    try {
      const result = await request("/api/admin/sales-requests/resolve", {
        method: "POST", body: JSON.stringify({ code })
      });
      const date = new Date(result.verifiedAt * 1000).toLocaleString("pt-BR");
      resultBox.textContent = "Pedido: " + result.requestId + "\nConta: " +
        (result.email || "Sem e-mail") + "\nID da conta: " + result.userId +
        "\nPlano: " + result.plan + "\nValidado em: " + date +
        "\nPagamento: NÃO CONFIRMADO. Licença: NÃO CONCEDIDA.";
      resultBox.style.whiteSpace = "pre-line";
      resultBox.hidden = false;
      $("sales-code").value = "";
      setStatus($("sales-status"), "Código consumido e pedido vinculado. Confirme o pagamento separadamente.", "ok");
    } catch (error) {
      setStatus($("sales-status"), error.message, "error");
    }
  });


  function trialStatus(t) {
    const now = Date.now() / 1000;
    if (t.revoked_at ?? t.revokedAt) return "Revogado";
    if ((t.activated_at ?? t.activatedAt) && (t.paid_until ?? t.paidUntil) <= now) return "Expirado";
    if (t.activated_at ?? t.activatedAt) return "Ativo";
    if (t.redeemed_at ?? t.redeemedAt) return "Resgatado — aguardando primeiro PC";
    if ((t.invite_expires_at ?? t.inviteExpiresAt) <= now) return "Convite expirado";
    return "Aguardando resgate";
  }

  function trialDate(unix) {
    return unix ? new Date(unix * 1000).toLocaleString("pt-BR") : "—";
  }

  async function loadTrials() {
    const list = $("trial-list");
    list.replaceChildren();
    const records = await request("/api/admin/trials");
    if (!records.length) { list.textContent = "Nenhum convite criado."; return; }
    for (const t of records) {
      const id = t.id;
      const revoked = t.revoked_at ?? t.revokedAt;
      const detail = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = (t.email || t.note || "Teste sem destinatário") + " • " + trialStatus(t);
      const summary = document.createElement("small");
      summary.textContent = t.days + " dias • 1 PC • " +
        (t.note || "Sem identificação") + " • Criado: " + trialDate(t.created_at ?? t.createdAt) +
        " • Resgate: " + trialDate(t.redeemed_at ?? t.redeemedAt) +
        " • Primeiro PC: " + trialDate(t.activated_at ?? t.activatedAt) +
        " • Expiração Pro: " + trialDate(t.paid_until ?? t.paidUntil);
      detail.append(title, summary);
      const item = document.createElement("div");
      item.className = "coupon-item";
      const actions = document.createElement("div");
      actions.className = "admin-actions";
      if (!revoked) {
        if ((t.devices_active ?? t.devicesActive) > 0) {
          const release = document.createElement("button");
          release.type = "button"; release.className = "button button-secondary compact";
          release.textContent = "Liberar PC";
          release.addEventListener("click", async () => {
            if (!confirm("Liberar o PC da licença temporária? O prazo original continuará correndo.")) return;
            release.disabled = true;
            try {
              await request("/api/admin/trials/" + encodeURIComponent(id) + "/release-device", { method: "POST" });
              await loadTrials();
              setStatus($("trial-status"), "Dispositivo liberado.", "ok");
            } catch (err) { setStatus($("trial-status"), err.message, "error"); release.disabled = false; }
          });
          actions.append(release);
        }
        const revoke = document.createElement("button");
        revoke.type = "button"; revoke.className = "button button-secondary compact";
        revoke.textContent = "Revogar";
        revoke.addEventListener("click", async () => {
          if (!confirm("Revogar permanentemente este convite e a licença de teste?")) return;
          revoke.disabled = true;
          try {
            await request("/api/admin/trials/" + encodeURIComponent(id) + "/revoke", { method: "POST" });
            await loadTrials();
            setStatus($("trial-status"), "Licença/convite revogado.", "ok");
          } catch (err) { setStatus($("trial-status"), err.message, "error"); revoke.disabled = false; }
        });
        actions.append(revoke);
      }
      item.append(detail, actions);
      list.append(item);
    }
  }

  $("trial-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    $("trial-created").hidden = true;
    setStatus($("trial-status"), "Gerando convite…");
    try {
      const result = await request("/api/admin/trials", {
        method: "POST",
        body: JSON.stringify({
          days: Number($("trial-days").value),
          email: $("trial-email").value.trim() || null,
          note: $("trial-note").value.trim() || null
        })
      });
      $("trial-created-code").textContent = result.code;
      $("trial-created").hidden = false;
      setStatus($("trial-status"), "Convite criado. Envie o código ao testador para resgatar em Minha conta.", "ok");
      await loadTrials();
    } catch (err) { setStatus($("trial-status"), err.message, "error"); }
  });
  $("trial-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("trial-created-code").textContent);
      setStatus($("trial-status"), "Código copiado.", "ok");
    } catch { setStatus($("trial-status"), "Copie o código exibido manualmente.", "error"); }
  });
  $("refresh-trials").addEventListener("click", async () => {
    try { await loadTrials(); setStatus($("trial-status"), "Lista atualizada.", "ok"); }
    catch (err) { setStatus($("trial-status"), err.message, "error"); }
  });

  function couponSummary(coupon) {
    const amount = coupon.type === "percent"
      ? coupon.value + "%"
      : (coupon.value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dates = [(coupon.starts_at ?? coupon.startsAt) ? "Início: " + toLocalInput(coupon.starts_at ?? coupon.startsAt).replace("T", " ") : null,
      (coupon.ends_at ?? coupon.endsAt) ? "Fim: " + toLocalInput(coupon.ends_at ?? coupon.endsAt).replace("T", " ") : null].filter(Boolean).join(" • ");
    return amount + " • " + (coupon.plans || []).join(", ") + " • Usos: " +
      (coupon.usage_count ?? coupon.usageCount ?? 0) + "/" + (coupon.usage_limit ?? coupon.usageLimit ?? "∞") +
      " • Por conta: " + (coupon.per_account_limit ?? coupon.perAccountLimit ?? "∞") + (dates ? " • " + dates : "");
  }

  async function loadCoupons() {
    const list = $("coupon-list");
    list.replaceChildren();
    const coupons = await request("/api/admin/coupons");
    if (!coupons.length) {
      list.textContent = "Nenhum cupom cadastrado.";
      return;
    }
    coupons.forEach((coupon) => {
      const item = document.createElement("div");
      item.className = "coupon-item";
      const details = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = coupon.code + (coupon.active ? " • Ativo" : " • Desativado");
      const summary = document.createElement("small");
      summary.textContent = couponSummary(coupon);
      details.append(name, summary);
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "button button-secondary compact";
      toggle.textContent = coupon.active ? "Desativar" : "Ativar";
      toggle.addEventListener("click", async () => {
        toggle.disabled = true;
        try {
          await request("/api/admin/coupons/" + encodeURIComponent(coupon.code) + "/activation", {
            method: "PUT", body: JSON.stringify({ active: !coupon.active })
          });
          await loadCoupons();
          setStatus($("coupon-status"), "Status do cupom atualizado.", "ok");
        } catch (error) {
          setStatus($("coupon-status"), error.message, "error");
        } finally { toggle.disabled = false; }
      });
      item.append(details, toggle);
      list.append(item);
    });
  }

  $("refresh-coupons").addEventListener("click", async () => {
    try { await loadCoupons(); setStatus($("coupon-status"), "Lista atualizada.", "ok"); }
    catch (error) { setStatus($("coupon-status"), error.message, "error"); }
  });

  $("coupon-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = $("coupon-type").value;
    const input = Number($("coupon-value").value);
    const value = type === "fixed" ? Math.round(input * 100) : input;
    const plans = Array.from(document.querySelectorAll('[name="coupon-plan"]:checked')).map(el => el.value);
    if (!plans.length || !Number.isInteger(value) || value <= 0) {
      setStatus($("coupon-status"), "Selecione um plano e informe um desconto válido (percentual inteiro).", "error");
      return;
    }
    try {
      await request("/api/admin/coupons", { method: "POST", body: JSON.stringify({
        code: $("coupon-code").value.trim().toUpperCase(), type, value, plans,
        starts_at: toIsoOrNull($("coupon-start").value),
        ends_at: toIsoOrNull($("coupon-end").value),
        usage_limit: $("coupon-limit").value ? Number($("coupon-limit").value) : null,
        per_account_limit: $("coupon-account-limit").value ? Number($("coupon-account-limit").value) : null
      }) });
      $("coupon-form").reset();
      await loadCoupons();
      setStatus($("coupon-status"), "Cupom criado.", "ok");
    } catch (error) {
      setStatus($("coupon-status"), error.message, "error");
    }
  });
})();
