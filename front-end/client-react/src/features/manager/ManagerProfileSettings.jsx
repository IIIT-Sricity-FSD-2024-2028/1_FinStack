import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { notify } from "../../components/ToastHost";
import { request } from "../../services/session";
import { readPreferences, savePreferences } from "../../services/preferences";

const settingsUrl = "/api/v1/tenant/me/settings";
export function managerLandingPath() {
  const page = readPreferences().managerDefaultPage;
  return ["dashboard", "expenses", "history", "notifications"].includes(page) ? page : "dashboard";
}

const Label = ({ title, children }) => <label className="manager-setting-field">{title}{children}</label>;
const Input = (props) => <input className="form-input" {...props} />;

export function ManagerProfileSettings() {
  const auth = useAuth();
  const [profile, setProfile] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [preferences, setPreferences] = useState(readPreferences);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    request(`${settingsUrl}/profile`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setProfile({ ...result, fullName: `${result.firstName || ""} ${result.lastName || ""}`.trim() }); setStatus("success"); } })
      .catch((caught) => { if (!controller.signal.aborted) { setError(caught instanceof Error ? caught.message : "Profile could not be loaded."); setStatus("error"); } });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const syncPreferences = () => setPreferences(readPreferences());
    window.addEventListener("finstack:preferences", syncPreferences);
    return () => window.removeEventListener("finstack:preferences", syncPreferences);
  }, []);

  function updateProfile(name, value) { setProfile((current) => ({ ...current, [name]: value })); }
  function updatePreference(name, value) { setPreferences((current) => ({ ...current, [name]: value })); }

  async function submitProfile(event) {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const saved = await request(`${settingsUrl}/profile`, { method: "PATCH", body: { fullName: profile.fullName, phone: profile.phone || "", location: profile.location || "", avatarColor: profile.avatarColor } });
      setProfile({ ...saved, fullName: `${saved.firstName || ""} ${saved.lastName || ""}`.trim() });
      auth.retry();
      notify("Profile updated.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Profile could not be saved.", "error"); }
    finally { setSavingProfile(false); }
  }

  async function submitPreferences(event) {
    event.preventDefault();
    setSavingPreferences(true);
    try {
      const saved = await savePreferences(preferences);
      setPreferences(saved);
      notify("Preferences saved to your account.", "success");
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Preferences could not be saved.", "error"); }
    finally { setSavingPreferences(false); }
  }

  async function submitPassword(event) {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) { notify("The new passwords do not match.", "error"); return; }
    setSavingPassword(true);
    try {
      await request(`${settingsUrl}/password-changes`, { method: "POST", body: password });
      notify("Password changed. Sign in again with your new password.", "success");
      auth.logout();
    } catch (caught) { notify(caught instanceof Error ? caught.message : "Password could not be changed.", "error"); }
    finally { setSavingPassword(false); }
  }

  async function revokeSessions() {
    if (!window.confirm("Sign out this account from all devices? You will need to sign in again.")) return;
    setRevoking(true);
    try { await request(`${settingsUrl}/session-revocations`, { method: "POST", body: {} }); auth.logout(); }
    catch (caught) { notify(caught instanceof Error ? caught.message : "Sessions could not be revoked.", "error"); setRevoking(false); }
  }

  if (status === "loading") return <section className="manager-page"><p role="status">Loading profile…</p></section>;
  if (status === "error") return <section className="manager-page"><div className="card manager-section"><h1>Profile &amp; Settings</h1><p role="alert">{error}</p><button type="button" className="btn btn-secondary" onClick={() => { setStatus("loading"); request(`${settingsUrl}/profile`).then((value) => { setProfile({ ...value, fullName: `${value.firstName || ""} ${value.lastName || ""}`.trim() }); setStatus("success"); }).catch((caught) => { setError(caught.message || "Profile could not be loaded."); setStatus("error"); }); }}>Try again</button></div></section>;

  return <section className="manager-page">
    <header className="page-header"><div><h1>Profile &amp; Settings</h1><p>Manage your profile, workspace preferences, and account security.</p></div></header>
    <form className="card manager-section manager-settings-form" onSubmit={submitProfile}>
      <div><h2>Personal information</h2><p className="manager-settings-note">Your account identity and organization are managed by your Configuration Manager.</p></div>
      <div className="manager-settings-grid">
        <Label title="Full name"><Input required maxLength={201} value={profile.fullName || ""} onChange={(event) => updateProfile("fullName", event.target.value)} /></Label>
        <Label title="Email address"><Input type="email" value={profile.email || ""} disabled /></Label>
        <Label title="Employee ID"><Input value={profile.employeeId || ""} disabled /></Label>
        <Label title="Department"><Input value={profile.department || ""} disabled /></Label>
        <Label title="Phone number"><Input value={profile.phone || ""} maxLength={40} onChange={(event) => updateProfile("phone", event.target.value)} placeholder="+91 90000 00000" /></Label>
        <Label title="Location"><Input value={profile.location || ""} maxLength={180} onChange={(event) => updateProfile("location", event.target.value)} /></Label>
        <Label title="Role"><Input value={profile.role || "Manager"} disabled /></Label>
      </div>
      <div className="manager-settings-actions"><button className="btn btn-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</button></div>
    </form>

    <form className="card manager-section manager-settings-form" onSubmit={submitPreferences}>
      <div><h2>Workspace preferences</h2><p className="manager-settings-note">Workspace preferences are saved to your account. Email alerts and weekly digest are saved preferences; email delivery is not configured.</p></div>
      <div className="manager-settings-grid">
        <Label title="Default currency"><select className="form-input" value={preferences.managerCurrency} onChange={(event) => updatePreference("managerCurrency", event.target.value)}><option value="INR">INR (₹)</option><option value="USD">USD ($)</option></select></Label>
        <Label title="Interface theme"><select className="form-input" value={preferences.theme} onChange={(event) => updatePreference("theme", event.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">Use device setting</option></select></Label>
        <Label title="Default landing page"><select className="form-input" value={preferences.managerDefaultPage} onChange={(event) => updatePreference("managerDefaultPage", event.target.value)}><option value="dashboard">Dashboard</option><option value="expenses">Review expenses</option><option value="history">Approval history</option><option value="notifications">Notifications</option></select></Label>
        <Label title="Language"><select className="form-input" value={preferences.language} onChange={(event) => updatePreference("language", event.target.value)}><option value="en-US">English (US)</option><option value="en-GB">English (India)</option></select></Label>
        <Label title="Time zone"><select className="form-input" value={preferences.timezone} onChange={(event) => updatePreference("timezone", event.target.value)}>{["Asia/Kolkata", "UTC", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"].map((zone) => <option key={zone} value={zone}>{zone}</option>)}</select></Label>
        <Label title="Date format"><select className="form-input" value={preferences.dateFormat} onChange={(event) => updatePreference("dateFormat", event.target.value)}>{["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((format) => <option key={format}>{format}</option>)}</select></Label>
        <Label title="Number format"><select className="form-input" value={preferences.numberLocale} onChange={(event) => updatePreference("numberLocale", event.target.value)}>{[["en-US", "English (US)"], ["de-DE", "German"], ["fr-FR", "French"]].map(([locale, label]) => <option key={locale} value={locale}>{label}</option>)}</select></Label>
        <Label title="Rows per page"><select className="form-input" value={preferences.pageSize} onChange={(event) => updatePreference("pageSize", Number(event.target.value))}>{[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select></Label>
      </div>
      <div className="manager-setting-toggles">
        {[["compactMode", "Compact layout"], ["animations", "Interface animations"], ["desktopNotifications", "Desktop notifications"], ["autoRefresh", "Automatically refresh workspace"]].map(([name, label]) => <label className="manager-setting-toggle" key={name}><strong>{label}</strong><input type="checkbox" checked={preferences[name]} onChange={(event) => updatePreference(name, event.target.checked)} /></label>)}
        {[["emailAlerts", "Email alerts"], ["weeklyDigest", "Weekly digest"]].map(([name, label]) => <label className="manager-setting-toggle" key={name}><strong>{label}</strong><input type="checkbox" checked={preferences[name]} onChange={(event) => updatePreference(name, event.target.checked)} /></label>)}
      </div>
      <div className="manager-settings-actions"><button className="btn btn-primary" disabled={savingPreferences}>{savingPreferences ? "Saving…" : "Save preferences"}</button></div>
    </form>

    <form className="card manager-section manager-settings-form" onSubmit={submitPassword}>
      <div><h2>Change password</h2><p className="manager-settings-note">Use at least 12 characters, including uppercase, lowercase, a number, and a symbol. Changing your password signs out all sessions.</p></div>
      <div className="manager-settings-grid">
        <Label title="Current password"><Input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={(event) => setPassword((current) => ({ ...current, currentPassword: event.target.value }))} /></Label>
        <Label title="New password"><Input type="password" autoComplete="new-password" minLength={12} required value={password.newPassword} onChange={(event) => setPassword((current) => ({ ...current, newPassword: event.target.value }))} /></Label>
        <Label title="Confirm new password"><Input type="password" autoComplete="new-password" minLength={12} required value={password.confirmPassword} onChange={(event) => setPassword((current) => ({ ...current, confirmPassword: event.target.value }))} /></Label>
      </div>
      <div className="manager-settings-actions"><button className="btn btn-primary" disabled={savingPassword}>{savingPassword ? "Updating…" : "Update password"}</button></div>
    </form>
    <section className="card manager-section manager-security-row"><div><h2>Active sessions</h2><p className="manager-settings-note">Sign out your account from other devices.</p></div><button className="btn btn-secondary" type="button" disabled={revoking} onClick={revokeSessions}>{revoking ? "Signing out…" : "Sign out all devices"}</button></section>
  </section>;
}
