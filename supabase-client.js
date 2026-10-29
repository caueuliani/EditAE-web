(() => {
  "use strict";

  const cfg = window.EDITAE_SUPABASE || {};
  const url = localStorage.getItem("editae_supabase_url") || cfg.url || "";
  const key = localStorage.getItem("editae_supabase_publishable_key") || cfg.publishableKey || "";

  window.EditAEAuth = {
    configured: Boolean(url && key),
    client: null,
    async init() {
      if (!this.configured) return null;
      if (!window.supabase?.createClient) {
        throw new Error("Supabase client library not loaded.");
      }
      if (!this.client) {
        this.client = window.supabase.createClient(url, key, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
          }
        });
      }
      return this.client;
    },
    async session() {
      const client = await this.init();
      if (!client) return null;
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async user() {
      const client = await this.init();
      if (!client) return null;
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      return data.user;
    }
  };
})();
