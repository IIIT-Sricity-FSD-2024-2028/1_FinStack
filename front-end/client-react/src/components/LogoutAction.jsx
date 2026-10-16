import { useMemo, useReducer } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import { createConfirmedAction } from "./confirmedAction";
import { confirmationReducer } from "./confirmationState";

export function LogoutAction({ onLogout, className, children = "Log out", ...buttonProps }) {
  const [open, dispatch] = useReducer(confirmationReducer, false);
  const runConfirmedLogout = useMemo(() => createConfirmedAction(), []);
  return <>
    <button {...buttonProps} type="button" className={className} onClick={() => dispatch("open")}>{children}</button>
    <ConfirmDialog open={open} title="Log out of FinStack?" message="You will need to sign in again." confirmLabel="Log out" danger onCancel={() => dispatch("cancel")} onConfirm={() => { dispatch("confirm"); void runConfirmedLogout(onLogout, { confirmed: open }); }} />
  </>;
}
