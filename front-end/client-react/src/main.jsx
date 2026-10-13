import { createRoot } from "react-dom/client";
import { ClientApp } from "./app/ClientApp";
import { installSessionRuntime } from "./services/session";
import { applyCachedThemeBeforeRender } from "./services/preferences";
import "./styles/legacy.css";
import "./styles/spa.css";
const root = document.getElementById("finstack-client-root");
if (root && !root.dataset.reactClientRoute) {
  root.dataset.reactClientRoute = "spa";
  installSessionRuntime();
  applyCachedThemeBeforeRender();
  createRoot(root).render(<ClientApp />);
}
