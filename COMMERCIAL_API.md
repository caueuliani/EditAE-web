# EditAE Commercial Web Contract

The public web repository contains no payment credentials, private keys or administrative secrets.

## Public endpoint

`GET /api/public/config`

Expected response:

```json
{
  "mode": "prelaunch",
  "downloadUrl": null,
  "founderStartsAt": null,
  "founderEndsAt": null,
  "lifetimeRemaining": 100,
  "manualActivation": false,
  "checkout": {
    "monthly": null,
    "annual": null,
    "lifetime": null
  }
}
```

Supported modes:

- `prelaunch`: purchases are disabled.
- `manual`: checkout buttons use the URLs returned in `checkout`.
- `automatic`: checkout buttons call `POST /api/checkout`.

If this endpoint is unavailable, the site intentionally fails closed to `prelaunch`.

## Automatic checkout

`POST /api/checkout`

Request:

```json
{ "plan": "PRO_MONTHLY" }
```

Supported plan values:

- `PRO_MONTHLY`
- `PRO_ANNUAL`
- `FOUNDER_LIFETIME`

Expected successful response must contain `checkoutUrl` (preferred) or `url`.

## Admin endpoints

The static admin UI is intentionally not linked from the public site, but its source is public. Security MUST be enforced server-side.

Required endpoints:

- `GET /api/admin/config`
- `PUT /api/admin/config`

The current admin shell sends:

`Authorization: Bearer <admin-token>`

The token is held only in JavaScript memory for the current page session. It is not stored in localStorage. The API base URL is not secret and may be stored locally.

Production requirements:

- HTTPS only.
- Strong server-side authentication.
- CORS restricted to the official EditAE web origin(s).
- Rate limiting for admin endpoints.
- No payment/API secrets returned to the browser.
- Audit admin changes if practical.
