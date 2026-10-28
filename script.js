(() => {
  const config = window.EDITAE_LAUNCH || {};
  const countdown = document.getElementById("countdown");
  const lifetime = document.getElementById("lifetime-count");
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  if (lifetime && Number.isFinite(config.lifetimeRemaining)) {
    const remaining = Math.max(0, Math.min(100, Math.trunc(config.lifetimeRemaining)));
    lifetime.textContent = remaining + " / 100";
  }

  if (!countdown || !config.founderEndsAt) return;
  const end = new Date(config.founderEndsAt);
  if (Number.isNaN(end.getTime())) return;

  const render = () => {
    const diff = end.getTime() - Date.now();
    if (diff <= 0) {
      countdown.textContent = "Encerrada";
      return false;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    countdown.textContent = [d + "d", String(h).padStart(2,"0") + "h", String(m).padStart(2,"0") + "m", String(s).padStart(2,"0") + "s"].join(" ");
    return true;
  };

  if (render()) {
    const timer = setInterval(() => {
      if (!render()) clearInterval(timer);
    }, 1000);
  }
})();
