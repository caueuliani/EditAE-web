(() => {
  "use strict";

  const loading = document.getElementById("account-loading");
  const content = document.getElementById("account-content");
  const commercialStatus = document.getElementById("account-server-status");
  const avatarRoot = document.getElementById("profile-avatar");
  const avatarImage = document.getElementById("profile-avatar-image");
  const avatarInitials = document.getElementById("profile-avatar-initials");
  const avatarName = document.getElementById("profile-avatar-name");
  const avatarEditor = document.getElementById("avatar-editor");
  const avatarPresetsRoot = document.getElementById("avatar-presets");
  const avatarStatus = document.getElementById("avatar-status");
  const uploadInput = document.getElementById("avatar-upload");

  const presets = [
    ["avatar_01", "Echo", "../avatars/avatar_01.svg"],
    ["avatar_02", "Orbit", "../avatars/avatar_02.svg"],
    ["avatar_03", "Nova", "../avatars/avatar_03.svg"],
    ["avatar_04", "Solar", "../avatars/avatar_04.svg"],
    ["avatar_05", "Vector", "../avatars/avatar_05.svg"],
    ["avatar_06", "Pixel", "../avatars/avatar_06.svg"]
  ];

  let currentObjectUrl = null;
  let currentUser = null;
  let currentClient = null;

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

  function initials(value) {
    return String(value || "EditAE")
      .split(/[\s.@_+-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => Array.from(part)[0])
      .join("")
      .toLocaleUpperCase("pt-BR");
  }

  function presetSource(id) {
    return presets.find(([preset]) => preset === id)?.[2] || null;
  }

  function setAvatarImage(src) {
    if (currentObjectUrl) {
      URL.revokeObjectURL(currentObjectUrl);
      currentObjectUrl = null;
    }
    if (src) {
      avatarImage.src = src;
      avatarImage.hidden = false;
      avatarInitials.hidden = true;
    } else {
      avatarImage.removeAttribute("src");
      avatarImage.hidden = true;
      avatarInitials.hidden = false;
      avatarInitials.textContent = initials(
        currentUser?.user_metadata?.display_name || currentUser?.email || "EditAE"
      );
    }
  }

  async function renderAvatar() {
    const metadata = currentUser?.user_metadata || {};
    const mode = metadata.avatar_mode || "initials";
    avatarName.textContent = metadata.display_name || currentUser?.email || "Perfil EditAE";

    avatarPresetsRoot.querySelectorAll(".web-avatar-option").forEach((button) => {
      button.classList.toggle("selected", mode === "preset" && button.dataset.preset === metadata.avatar_preset);
    });

    if (mode === "preset") {
      setAvatarImage(presetSource(metadata.avatar_preset));
      return;
    }

    if (mode === "upload" && metadata.avatar_path) {
      const { data, error } = await currentClient.storage.from("avatars").download(metadata.avatar_path);
      if (!error && data) {
        currentObjectUrl = URL.createObjectURL(data);
        setAvatarImage(currentObjectUrl);
        return;
      }
    }

    setAvatarImage(null);
  }

  async function updateAvatarMetadata(data) {
    avatarStatus.textContent = "Salvando avatar…";
    const { data: updated, error } = await currentClient.auth.updateUser({ data });
    if (error || !updated.user) throw error || new Error("Não foi possível atualizar o avatar.");
    currentUser = updated.user;
    await renderAvatar();
    avatarStatus.textContent = "Avatar sincronizado com sua conta.";
  }

  async function usePreset(id) {
    if (!presetSource(id)) return;
    try {
      await updateAvatarMetadata({
        avatar_mode: "preset",
        avatar_preset: id,
        avatar_path: null
      });
    } catch (error) {
      avatarStatus.textContent = error.message || "Não foi possível salvar o avatar.";
    }
  }

  async function useInitials() {
    try {
      await updateAvatarMetadata({
        avatar_mode: "initials",
        avatar_preset: null,
        avatar_path: null
      });
    } catch (error) {
      avatarStatus.textContent = error.message || "Não foi possível salvar o avatar.";
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    const allowed = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp"
    };
    const extension = allowed[file.type];
    if (!extension) {
      avatarStatus.textContent = "Use uma imagem PNG, JPEG ou WebP.";
      return;
    }
    if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
      avatarStatus.textContent = "A foto precisa ter no máximo 2 MB.";
      return;
    }

    const path = currentUser.id + "/profile." + extension;
    avatarStatus.textContent = "Enviando foto…";
    const { error: uploadError } = await currentClient.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      avatarStatus.textContent = uploadError.message || "Não foi possível enviar a foto.";
      return;
    }

    try {
      await updateAvatarMetadata({
        avatar_mode: "upload",
        avatar_preset: null,
        avatar_path: path
      });
    } catch (error) {
      avatarStatus.textContent = error.message || "A foto foi enviada, mas o perfil não foi atualizado.";
    }
  }

  function buildAvatarEditor() {
    avatarPresetsRoot.textContent = "";
    for (const [id, label, src] of presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "web-avatar-option";
      button.dataset.preset = id;
      button.innerHTML = '<img alt="" src="' + src + '"><span>' + label + "</span>";
      button.addEventListener("click", () => void usePreset(id));
      avatarPresetsRoot.append(button);
    }

    document.getElementById("toggle-avatar-editor").addEventListener("click", () => {
      avatarEditor.hidden = !avatarEditor.hidden;
    });
    document.getElementById("avatar-initials").addEventListener("click", () => void useInitials());
    uploadInput.addEventListener("change", () => {
      const file = uploadInput.files?.[0] || null;
      uploadInput.value = "";
      if (file) void uploadAvatar(file);
    });
  }

  async function loadCommercialAccount(session) {
    const base = apiBase();
    if (!base) {
      document.getElementById("account-plan").textContent = "Free";
      document.getElementById("account-license").textContent = "Servidor não configurado";
      document.getElementById("account-devices").textContent = "—";
      document.getElementById("account-subscription").textContent = "—";
      commercialStatus.textContent = "O EditAE.Server ainda não foi configurado neste ambiente.";
      avatarRoot.classList.remove("pro");
      return;
    }

    const response = await fetch(base + "/api/account", {
      headers: { "Authorization": "Bearer " + session.access_token }
    });
    if (response.status === 401) throw new Error("Sua sessão expirou. Entre novamente.");
    if (!response.ok) throw new Error("Não foi possível consultar sua conta comercial (HTTP " + response.status + ").");

    const account = await response.json();
    document.getElementById("account-plan").textContent = planLabel(account.plan);
    avatarRoot.classList.toggle("pro", account.plan && account.plan !== "FREE");

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

      currentClient = client;
      currentUser = userData.user;
      buildAvatarEditor();
      await renderAvatar();

      document.getElementById("account-name").textContent =
        currentUser.user_metadata?.display_name || "Usuário EditAE";
      document.getElementById("account-email").textContent = currentUser.email || "—";

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

  window.addEventListener("beforeunload", () => {
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  });

  start();
})();
