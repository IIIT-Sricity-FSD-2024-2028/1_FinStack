# FinStack client React SPA

One React Router application owns the public client entry pages and Configuration Manager workspace. `src/main.jsx` installs the JWT transport and mounts `ClientApp` once into `#finstack-client-root`. `AuthContext` verifies identity with the backend; nested protected routes render through `ConfigurationManagerLayout`. Existing actor HTML and the standalone Admin app retain their own entry points.

From this directory:

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Dev/preview default to `http://127.0.0.1:5582`; dev proxies `/api` to the ordinary local backend on 3000. Set `VITE_API_PROXY_TARGET` for a different local backend. Build output is `../js/react/client/`, with stable `client-react.js` and stylesheet entry points plus route chunks. The small HTML documents and Vite/manual-QA history fallback serve the same SPA. Existing Configuration Manager HTML URLs redirect inside React to `/configuration/<page>`; query strings and hashes survive.

The isolated QA stack uses the existing `back-end/scripts/manual-qa.cjs` launcher (backend 3401, client 5581, Admin 5174). See `back-end/docs/config-manager-react-spa-verification.md` for exact routes, verification, safety boundaries, limitations and manual checks.

## Actor integration contract

Add future actor screens to the existing `ClientApp` router and a dedicated actor layout only after coordinating ownership. The old per-HTML registry files remain reference compatibility material; `ClientApp` is the active route owner. Do not reintroduce separate React mounts for Configuration Manager pages.

Use `services/session.ts` for JSON transport; reused JS adapters delegate to its installed runtime. Backend-derived identity from `/api/v1/tenant/auth/me` is authoritative. Never authorize with cached role values or arbitrary organization headers. Other actor login destinations remain their existing HTML routes. Do not redirect other actors into Configuration Manager. Legacy APIs and scripts were preserved, but do not import legacy DOM initializers into SPA pages. Tenant permissions are enforced by NestJS guards, separately from the platform RBAC system.

The API base is configurable through `window.FINSTACK_API_BASE_URL` / existing application configuration, and defaults to `http://localhost:3000` outside the provided hosts. Vite injects same-origin API access; manual QA injects its isolated 3401 API. Any future hosting must use the same restricted SPA fallback, preserve static actor/assets, and proxy the API securely. No deployment was performed.
