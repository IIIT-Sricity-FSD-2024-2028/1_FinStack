import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store, installReduxRuntime } from "./app/store";
import { ClientApp } from "./app/ClientApp";
import { installSessionRuntime } from "./services/session";
import { applyCachedThemeBeforeRender } from "./services/preferences";
import "./styles/legacy.css";
import "./styles/spa.css";
const root = document.getElementById("finstack-client-root");
if (root && !root.dataset.reactClientRoute) {
  root.dataset.reactClientRoute = "spa";
  installSessionRuntime();
  const disposeReduxRuntime = installReduxRuntime();
  if (import.meta.hot) import.meta.hot.dispose(disposeReduxRuntime);
  applyCachedThemeBeforeRender();
  createRoot(root).render(<Provider store={store}><ClientApp /></Provider>);
}
