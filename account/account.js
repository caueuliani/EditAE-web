(() => {
  "use strict";
  const loading = document.getElementById("account-loading");
  const content = document.getElementById("account-content");

  async function start() {
    try {
      const client = await window.EditAEAuth.init();
      if (!client) {
        window.location.href = "../auth/";
        return;
      }
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) {
        window.location.href = "../auth/";
        return;
      }

      const user = data.user;
      document.getElementById("account-name").textContent =
        user.user_metadata?.display_name || "Usuário EditAE";
      document.getElementById("account-email").textContent = user.email || "—";
      loading.hidden = true;
      content.hidden = false;

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
