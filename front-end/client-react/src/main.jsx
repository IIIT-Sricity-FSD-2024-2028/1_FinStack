import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { createClientStore, installStoreRuntime } from "./app/store.js";
import { ClientApp } from "./app/ClientApp";
import { installSessionRuntime } from "./services/session";
import { applyCachedThemeBeforeRender } from "./services/preferences";
import "./styles/legacy.css";
import "./styles/spa.css";
const root = document.getElementById("finstack-client-root");
if (root && !root.dataset.reactClientRoute) {
  root.dataset.reactClientRoute = "spa";
  installSessionRuntime();
  const store = createClientStore();
  const stopStoreRuntime = installStoreRuntime(store);
  if (import.meta.hot) import.meta.hot.dispose(stopStoreRuntime);
  applyCachedThemeBeforeRender();
  createRoot(root).render(<Provider store={store}><ClientApp /></Provider>);
}
