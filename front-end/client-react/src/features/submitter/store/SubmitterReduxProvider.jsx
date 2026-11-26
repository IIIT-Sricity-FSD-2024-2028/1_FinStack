import { useLayoutEffect } from "react";
import { useDispatch } from "react-redux";
import { useAuth } from "../../../auth/AuthContext";
import { useLiveRefresh } from "../../../hooks/useLiveRefresh";
import { refreshSubmitter } from "./submitterActions.js";
import { sessionChanged, submitterIdentity } from "./submitterSession.js";

export function SubmitterReduxProvider({ children }) {
  const { user } = useAuth();
  const identity = submitterIdentity(user);
  const dispatch = useDispatch();

  useLayoutEffect(() => {
    dispatch(sessionChanged(identity));
    if (identity) dispatch(refreshSubmitter());
    return () => { dispatch(sessionChanged(null)); };
  }, [dispatch, identity]);

  useLiveRefresh(
    ({ background }) => dispatch(refreshSubmitter({ background })),
    { enabled: Boolean(identity), refreshImmediately: false },
  );

  return children;
}
