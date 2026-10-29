(() => {
  "use strict";

  const loading = document.getElementById("account-loading");
  const content = document.getElementById("account-content");
  const commercialStatus = document.getElementById("account-server-status");

  function apiBase() {
    const bootstrap = window.EDITAE_BOOTSTRAP || {};
    return String(localStorage.getItem("editae_api_base") || bootstrap.apiBaseUrl || "").replace(/\/$/, "");
  }

  function planLabel(plan) {
    return ({
      FREE: "Free",
      PRO_MONTHLY: "Pro Mensal",
      PRO_ANNUAL: "Pro Anual",
      FOUNDER_LIFETIME: "Founder Lifetime"
    })[plan] || plan || "Free";
  }

  function dateLabel(unix) {
    if (!unix) return null;
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(unix * 1000));
  }

  async function loadCommercialAccount(session) {
    const base = apiBase();
    if (!base) {
      document.getElementById("account-plan").textContent = "Free";
      document.getElementById("account-license").textContent = "Servidor não configurado";
      document.getElementById("account-devices").textContent = "—";
      document.getElementById("account-subscription").textContent = "—";
      commercialStatus.textContent = "O EditAE.Server ainda não foi configurado neste ambiente.";
      return;
    }

    const response = await fetch(base + "/api/account", {
      headers: { "Authorization": "Bearer " + session.access_token }
    });
    if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente.");
    if (!response.ok) throw new Error("Não foi possível consultar sua conta comercial (HTTP " + response.status + ").");

    const account = await response.json();
    document.getElementById("account-plan").textContent = planLabel(account.plan);

    if (account.license) {
      const paidUntil = dateLabel(account.license.paid_until);
      document.getElementById("account-license").textContent =
        account.license.active ? "Ativa" + (paidUntil ? " até " + paidUntil : "") : "Inativa";
      document.getElementById("account-devices").textContent =
        String(account.license.devices_active || 0) + " / " + String(account.license.max_devices || 2) + " ativos";
    } else {
      document.getElementById("account-license").textContent = "Ainda não vinculada";
      document.getElementById("account-devices").textContent = "0 / 2 ativos";
    }

    if (account.subscription) {
      const end = dateLabel(account.subscription.current_period_end);
      document.getElementById("account-subscription").textContent =
        account.subscription.status + (end ? " · até " + end : "");
    } else {
      document.getElementById("account-subscription").textContent =
        account.plan === "FOUNDER_LIFETIME" ? "Lifetime" : "Nenhuma";
    }

    commercialStatus.textContent = account.license
      ? "Dados comerciais sincronizados com o EditAE.Server."
      : "Sua conta está autenticada. Uma licença aparecerá aqui após a confirmação financeira da compra.";
  }

  async function start() {
    try {
      const client = await window.EditAEAuth.init();
      if (!client) {
        window.location.href = "../auth/";
        return;
      }

      const { data: userData, error: userError } = await client.auth.getUser();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (userError || sessionError || !userData.user || !sessionData.session) {
        window.location.href = "../auth/";
        return;
      }

      const user = userData.user;
      document.getElementById("account-name").textContent =
        user.user_metadata?.display_name || "Usuário EditAE";
      document.getElementById("account-email").textContent = user.email || "—";

      loading.hidden = true;
      content.hidden = false;

      try {
        await loadCommercialAccount(sessionData.session);
      } catch (error) {
        document.getElementById("account-plan").textContent = "—";
        document.getElementById("account-license").textContent = "Indisponível";
        document.getElementById("account-devices").textContent = "—";
        document.getElementById("account-subscription").textContent = "—";
        commercialStatus.textContent = error.message || "Não foi possível carregar os dados comerciais.";
      }

      document.getElementById("logout").addEventListener("click", async () => {
        await client.auth.signOut();
        window.location.href = "../";
      });
    } catch (error) {
      loading.textContent = error.message || "Não foi possível carregar sua conta.";
      loading.classList.add("error");
    }
  }

  start();
})();
