(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const connectionForm = $("connection-form");
  const commercialForm = $("commercial-form");
  const panel = $("commercial-panel");
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
      setStatus(connectionStatus, error.message, "error");
    }
  });

  $("disconnect").addEventListener("click", () => {
    token = "";
    panel.hidden = true;
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
})();
