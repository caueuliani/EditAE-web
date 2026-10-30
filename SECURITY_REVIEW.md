# Security review — EditAE Web account portal

## Changes in this branch

- Web logout now explicitly uses Supabase Auth `scope: "local"`, so signing out of the portal does not revoke the user's other device/browser sessions.
- Avatar download paths are validated before calling Supabase Storage: path must be short, relative, contain only the expected path characters, avoid traversal segments, and begin with the authenticated user's own UUID prefix.

## Reviewed properties

- The browser uses only the Supabase publishable key; no service-role/secret key is present in the client.
- The commercial account endpoint receives the current access token in the Authorization header; the server independently verifies the JWT and derives ownership from its subject.
- User-facing profile text is assigned with `textContent`; avatar preset HTML is built from fixed repository constants, not user-supplied markup.
- Admin token is held only in page memory and is cleared when disconnecting; only the admin API base URL is persisted in localStorage.
- Supabase JS persists the browser session in browser storage by default. This is expected for a static client-side portal, but browser XSS would be able to act as the user. Keep third-party scripts minimal and never add user-controlled HTML rendering.

## External configuration still requiring verification

- Supabase Storage bucket `avatars` must be private.
- Storage RLS policies must require the first object-path segment to equal `auth.uid()` for SELECT, INSERT and UPDATE. Client-side path validation is defense-in-depth, not a replacement for RLS.
- Confirm production Supabase Auth site URL and allowed redirect URLs include only the intended EditAE portal routes.
