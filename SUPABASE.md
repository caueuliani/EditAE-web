# EditAE Portal / Supabase Auth

This branch adds client-side Supabase Auth to the static GitHub Pages portal.

## Browser configuration

`supabase-config.js` contains only public browser configuration:

- Supabase Project URL
- Supabase Publishable Key (`sb_publishable_...`)

Never put a Supabase Secret Key or legacy `service_role` key in this repository.

For local development, configuration can be supplied without editing files:

```js
localStorage.setItem("editae_supabase_url", "https://PROJECT.supabase.co");
localStorage.setItem("editae_supabase_publishable_key", "sb_publishable_...");
location.reload();
```

Clear with:

```js
localStorage.removeItem("editae_supabase_url");
localStorage.removeItem("editae_supabase_publishable_key");
```

## Supabase dashboard

Configure Auth URL settings with the production GitHub Pages URL as Site URL and add local development redirect URLs before testing email confirmation/password recovery.

Apply `supabase/schema.sql` in the SQL editor to create the initial `profiles` table and RLS policies.

## Current portal routes

- `/auth/` login + signup
- `/auth/reset/` password recovery
- `/account/` authenticated account shell
- `/admin/` existing commercial admin shell (authentication migration pending)

Commercial entities such as licenses, payments, subscriptions and devices remain server-owned and are not exposed directly to the browser yet.
