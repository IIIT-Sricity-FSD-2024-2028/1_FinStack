import { useLayoutEffect, useState } from "react";
import { Provider } from "react-redux";
import { useAuth } from "../../../auth/AuthContext";
import { SESSION_EVENT } from "../../../services/session";
import { useLiveRefresh } from "../../../hooks/useLiveRefresh";
import { submitterApi } from "../api/submitterApi";
import { createSubmitterStore } from "./submitterStore.js";
import { refreshSubmitter } from "./submitterActions.js";
import { sessionChanged, submitterIdentity } from "./submitterSession.js";

export function SubmitterReduxProvider({ children }) {
  const { user } = useAuth();
  const identity = submitterIdentity(user);
  const [store] = useState(() => createSubmitterStore(submitterApi));

  useLayoutEffect(() => {
    // Clear synchronously on logout, token/session replacement, or API 401,
    // before React unmounts the protected workspace or verifies a new identity.
    const clear = () => store.dispatch(sessionChanged(null));
    window.addEventListener(SESSION_EVENT, clear);
    store.dispatch(sessionChanged(identity));
    if (identity) store.dispatch(refreshSubmitter());
    return () => {
      window.removeEventListener(SESSION_EVENT, clear);
      clear();
    };
  }, [store, identity]);

  useLiveRefresh(
    ({ background }) => store.dispatch(refreshSubmitter({ background })),
    { enabled: Boolean(identity), refreshImmediately: false },
  );

  return <Provider key={identity} store={store}>{children}</Provider>;
}
