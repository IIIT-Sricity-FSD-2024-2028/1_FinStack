import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../auth/AuthContext";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ToastHost } from "../components/ToastHost";
import { AppRouter } from "./router";

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <ToastHost />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
