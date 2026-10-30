(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const connectionForm = $("connection-form");
  const commercialForm = $("commercial-form");
  const panel = $("commercial-panel");
  const couponsPanel = $("coupons-panel");
  const connectionStatus = $("connection-status");
  const saveStatus = $("save-status");

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
    panel.hidden = false;
    couponsPanel.hidden = false;
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
      panel.hidden = true;
      couponsPanel.hidden = true;
      setStatus(connectionStatus, error.message, "error");
    }
  });

  $("disconnect").addEventListener("click", () => {
    token = "";
    panel.hidden = true;
    couponsPanel.hidden = true;
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

  function couponSummary(coupon) {
    const amount = coupon.type === "percent"
      ? coupon.value + "%"
      : (coupon.value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const dates = [coupon.startsAt ? "Início: " + toLocalInput(coupon.startsAt).replace("T", " ") : null,
      coupon.endsAt ? "Fim: " + toLocalInput(coupon.endsAt).replace("T", " ") : null].filter(Boolean).join(" • ");
    return amount + " • " + (coupon.plans || []).join(", ") + " • Usos: " +
      (coupon.usageCount ?? 0) + "/" + (coupon.usageLimit ?? "∞") + (dates ? " • " + dates : "");
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
        startsAt: toIsoOrNull($("coupon-start").value),
        endsAt: toIsoOrNull($("coupon-end").value),
        usageLimit: $("coupon-limit").value ? Number($("coupon-limit").value) : null
      }) });
      $("coupon-form").reset();
      await loadCoupons();
      setStatus($("coupon-status"), "Cupom criado.", "ok");
    } catch (error) {
      setStatus($("coupon-status"), error.message, "error");
    }
  });
})();
