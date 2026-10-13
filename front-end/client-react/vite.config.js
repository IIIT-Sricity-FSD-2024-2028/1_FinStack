import { resolve, extname, relative, sep } from "node:path";
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const frontend = resolve(import.meta.dirname, "..");
const apiProxy = {
  "/api": {
    target: process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:3000",
    changeOrigin: true,
  },
};
const localApi = (html) =>
  html.replace(
    "<head>",
    "<head><script>window.FINSTACK_API_BASE_URL=window.location.origin;</script>",
  );
const isSpa = (path) =>
  path === "/" ||
  /^\/(?:configuration(?:\/[^.]*)?|login|register|registration\/receipt|activate-account|help|contact|support|account-request|forgot-password|reset-password|forbidden)\/?$/.test(
    path,
  );
function clientHosting() {
  return {
    name: "finstack-client-hosting",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url, "http://localhost").pathname;
        if (
          !isSpa(pathname) &&
          !/^(?:\/index.html|\/login.html|\/activate-account.html|\/views\/(?:shared|config-manager)\/[^/]+.html)$/.test(
            pathname,
          )
        )
          return next();
        try {
          let html = readFileSync(resolve(frontend, "index.html"), "utf8")
            .replace(
              'src="/js/react/client/client-react.js"',
              'src="/client-react/src/main.jsx"',
            )
            .replace(
              '<link rel="stylesheet" href="/js/react/client/finstack-client-react-migration.css">',
              "",
            );
          html = await server.transformIndexHtml(pathname, localApi(html));
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          const pathname = decodeURIComponent(
            new URL(req.url, "http://localhost").pathname,
          );
          const file = resolve(
            frontend,
            "." + (isSpa(pathname) ? "/index.html" : pathname),
          );
          if (
            !file.startsWith(frontend + sep) ||
            relative(frontend, file)
              .split(sep)
              .some(
                (part) =>
                  part.startsWith(".") ||
                  part === "node_modules" ||
                  part === "admin",
              )
          )
            return next();
          const content = file.endsWith(".html")
            ? localApi(readFileSync(file, "utf8"))
            : readFileSync(file);
          res.setHeader(
            "Content-Type",
            {
              ".html": "text/html; charset=utf-8",
              ".js": "text/javascript; charset=utf-8",
              ".css": "text/css; charset=utf-8",
              ".svg": "image/svg+xml",
              ".png": "image/png",
            }[extname(file)] || "application/octet-stream",
          );
          res.end(content);
        } catch {
          next();
        }
      });
    },
  };
}
export default defineConfig(({ command }) => ({
  root: frontend,
  resolve: {
    alias: {
      react: resolve(import.meta.dirname, "node_modules/react"),
      "react-dom": resolve(import.meta.dirname, "node_modules/react-dom"),
      "react-router-dom": resolve(
        import.meta.dirname,
        "node_modules/react-router-dom",
      ),
    },
  },
  plugins: [clientHosting(), react()],
  server: { host: "127.0.0.1", port: 5582, strictPort: true, proxy: apiProxy },
  preview: { host: "127.0.0.1", port: 5582, strictPort: true, proxy: apiProxy },
  ...(command === "build"
    ? {
        esbuild: { jsxDev: false },
        define: { "process.env.NODE_ENV": JSON.stringify("production") },
      }
    : {}),
  build: {
    emptyOutDir: true,
    outDir: resolve(frontend, "js/react/client"),
    rollupOptions: { output: { chunkFileNames: "[name]-[hash].js" } },
    lib: {
      entry: resolve(import.meta.dirname, "src/main.jsx"),
      formats: ["es"],
      fileName: () => "client-react.js",
      cssFileName: "finstack-client-react-migration",
    },
  },
}));
