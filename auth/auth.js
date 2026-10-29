(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const loginForm = $("login-form");
  const signupForm = $("signup-form");
  const status = $("auth-status");
  const tabLogin = $("tab-login");
  const tabSignup = $("tab-signup");
  const notConfigured = $("not-configured");

  function setStatus(message, kind="") {
    status.textContent = message;
    status.className = "portal-status" + (kind ? " " + kind : "");
  }

  function select(mode) {
    const login = mode === "login";
    loginForm.hidden = !login;
    signupForm.hidden = login;
    tabLogin.classList.toggle("active", login);
    tabSignup.classList.toggle("active", !login);
    setStatus("");
  }

  tabLogin.addEventListener("click", () => select("login"));
  tabSignup.addEventListener("click", () => select("signup"));

  async function client() {
    const c = await window.EditAEAuth.init();
    if (!c) {
      notConfigured.hidden = false;
      throw new Error("Supabase ainda não foi configurado.");
    }
    return c;
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("Entrando…");
    try {
      const c = await client();
      const { error } = await c.auth.signInWithPassword({
        email: $("login-email").value.trim(),
        password: $("login-password").value
      });
      if (error) throw error;
      window.location.href = "../account/";
    } catch (error) {
      setStatus(error.message || "Não foi possível entrar.", "error");
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = $("signup-password").value;
    if (password !== $("signup-confirm").value) {
      setStatus("As senhas não coincidem.", "error");
      return;
    }

    setStatus("Criando conta…");
    try {
      const c = await client();
      const redirect = new URL("../account/", window.location.href).href;
      const { data, error } = await c.auth.signUp({
        email: $("signup-email").value.trim(),
        password,
        options: {
          data: { display_name: $("signup-name").value.trim() },
          emailRedirectTo: redirect
        }
      });
      if (error) throw error;

      if (data.session) {
        window.location.href = "../account/";
      } else {
        setStatus("Conta criada. Confira seu e-mail para confirmar o cadastro.", "ok");
      }
    } catch (error) {
      setStatus(error.message || "Não foi possível criar a conta.", "error");
    }
  });

  window.EditAEAuth.session().then((session) => {
    if (session) window.location.href = "../account/";
  }).catch(() => {});
})();
