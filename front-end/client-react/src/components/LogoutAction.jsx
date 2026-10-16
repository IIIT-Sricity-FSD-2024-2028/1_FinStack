import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export function LogoutAction({ onLogout, className, children = "Log out", ...buttonProps }) {
  const [open, setOpen] = useState(false);
  return <>
    <button {...buttonProps} type="button" className={className} onClick={() => setOpen(true)}>{children}</button>
    <ConfirmDialog open={open} title="Log out of FinStack?" message="You will need to sign in again." confirmLabel="Log out" danger onCancel={() => setOpen(false)} onConfirm={() => { setOpen(false); onLogout(); }} />
  </>;
}
