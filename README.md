# Droit clair

A mobile-first legal information assistant for Cameroonian law, built with the existing Next.js 16 App Router and TypeScript frontend. Next.js was already present in this repository; its Route Handlers provide a same-origin backend-for-frontend proxy so browser requests do not depend on NestJS CORS being enabled.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The public pages are `/` (Ask) and `/search`. Admin tools live separately at `/admin` and are intentionally unavailable unless the secure deployment settings below are configured.

## API configuration and deployment

Set `LAW_API_BASE_URL` to the NestJS service origin (or its configured root). The NestJS API currently has no global `/api` prefix; the frontend proxy calls the documented `/rag/...` and `/admin/...` routes directly. Do not set this to a URL that includes a guessed `/api` prefix.

The browser calls same-origin Next.js Route Handlers under `/api`. This avoids browser-to-NestJS CORS requests in this deployment. If you change the app to call NestJS directly from a browser, configure the backend CORS policy for the deployed frontend origin; the current backend does not enable CORS.

Admin calls are forwarded only by the server-side route handler, which adds `x-admin-api-key`. Keep `LAW_ADMIN_API_KEY` on the server and never rename it to a `NEXT_PUBLIC_*` variable. The handler also requires `ADMIN_ACCESS_GATE_TOKEN` and a trusted deployment access gateway:

1. Authenticate and authorize admin users at the ingress/identity-aware gateway before requests reach this app.
2. The gateway must strip any incoming `x-admin-gateway-token` header and inject its own value, matching the server-only `ADMIN_ACCESS_GATE_TOKEN`.
3. Configure `LAW_API_BASE_URL`, `LAW_ADMIN_API_KEY`, and `ADMIN_ACCESS_GATE_TOKEN` as server-side deployment secrets.

Without these settings, `/admin` displays a deployment-configuration message and admin operations return a configuration error. The gateway token is an application-to-gateway trust check; it does not replace the identity-aware access gate. Do not enable the admin proxy behind an untrusted public ingress.

## Translations and design tokens

All interface copy is in the English/French dictionaries in `components/providers.tsx`. Add each new translation key to both dictionaries and use `usePreferences().t(key)` in components. Browser language is used on first visit, and the selected language and light/dark theme are stored locally.

Color, typography, spacing, responsive layout, focus, motion, and dark-theme tokens are centralized in `app/globals.css`.

## Development fixtures

To preview the interface without NestJS, set `NEXT_PUBLIC_DEMO_MODE=true` in `.env.local` and run the development server. The header includes Success, Empty, Loading, and Error fixture states. Fixtures are guarded by `NODE_ENV === "development"` and are disabled in production builds. They use only the documented API response shapes; citations remain opaque because this frontend repository does not include the backend's `legal.agent.ts` types.

## Validation

```bash
npm run lint
npx tsc --noEmit
npm run build
```
