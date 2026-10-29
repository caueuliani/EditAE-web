(() => {
  "use strict";
  const status = document.getElementById("reset-status");
  const requestForm = document.getElementById("request-form");
  const updateForm = document.getElementById("update-form");

  function setStatus(message, kind="") {
    status.textContent = message;
    status.className = "portal-status" + (kind ? " " + kind : "");
  }

  async function client() {
    const c = await window.EditAEAuth.init();
    if (!c) throw new Error("Supabase ainda não foi configurado.");
    return c;
  }

  requestForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setStatus("Enviando…");
      const c = await client();
      const redirectTo = window.location.href.split("#")[0].split("?")[0];
      const { error } = await c.auth.resetPasswordForEmail(
        document.getElementById("reset-email").value.trim(),
        { redirectTo }
      );
      if (error) throw error;
      setStatus("Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.", "ok");
    } catch (error) {
      setStatus(error.message || "Não foi possível iniciar a recuperação.", "error");
    }
  });

  updateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("new-password").value;
    if (password !== document.getElementById("confirm-password").value) {
      setStatus("As senhas não coincidem.", "error");
      return;
    }

    try {
      const c = await client();
      const { error } = await c.auth.updateUser({ password });
      if (error) throw error;
      setStatus("Senha atualizada. Você já pode usar sua conta EditAE.", "ok");
      setTimeout(() => { window.location.href = "../../account/"; }, 1000);
    } catch (error) {
      setStatus(error.message || "Não foi possível atualizar a senha.", "error");
    }
  });

  window.EditAEAuth.init().then((c) => {
    if (!c) return;
    c.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        requestForm.hidden = true;
        updateForm.hidden = false;
        setStatus("Defina uma nova senha.");
      }
    });
  }).catch(() => {});
})();
