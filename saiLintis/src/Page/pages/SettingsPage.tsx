import { useState, useEffect } from "react";
import "../../Home.css";
import "../../SettingsPage.css";
import { Dashboard } from "../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";

export function SettingsPage() {
  const [activeItem, setActiveItem] = useState("Settings");
  const [activeSection, setActiveSection] = useState("Overview");
  const [activeTab, setActiveTab] = useState("Account");

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [securitySuccess, setSecuritySuccess] = useState("");

  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(false);

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-theme");
    } else {
      document.body.classList.remove("dark-theme");
    }
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  const handleChangePassword = async () => {
    setSecurityError("");
    setSecuritySuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityError("Every Column needs to be inputted");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityError("Confirm Password did not match");
      return;
    }

    try {
      await invoke("change_password", {userId: user.user_id,currentPassword, newPassword});
      setSecuritySuccess("Password Change Successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setSecurityError(String(err));
    }
  };

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="hp-page-header-top">
        <h1 className="hp-title-giant">Settings</h1>
        <p className="hp-subtitle-clean">Manage your account preferences, security, and interface appearance.</p>
      </div>

      <div className="settings-grid">
        <div className="settings-sidebar">
          <button
            onClick={() => setActiveTab("Account")}
            className={`settings-tab-btn ${activeTab === "Account" ? "active" : ""}`}
          >
            <i className="fa-solid fa-user-gear" /> Account
          </button>
          <button
            onClick={() => setActiveTab("Security")}
            className={`settings-tab-btn ${activeTab === "Security" ? "active" : ""}`}
          >
            <i className="fa-solid fa-shield-halved" /> Security
          </button>
          <button
            onClick={() => setActiveTab("Appearance")}
            className={`settings-tab-btn ${activeTab === "Appearance" ? "active" : ""}`}
          >
            <i className="fa-solid fa-palette" /> Appearance
          </button>
          <button
            onClick={() => setActiveTab("Notifications")}
            className={`settings-tab-btn ${activeTab === "Notifications" ? "active" : ""}`}
          >
            <i className="fa-solid fa-bell" /> Notifications
          </button>
        </div>

        <div className="settings-pane">
          {activeTab === "Account" && (
            <div>
              <h2 className="settings-pane-title">Account Settings</h2>
              <div className="settings-form-list">
                <div className="settings-info-row">
                  <span className="settings-info-label">Display Name</span>
                  <span className="settings-info-value">{user.display_name}</span>
                </div>
                <div className="settings-info-row">
                  <span className="settings-info-label">Username</span>
                  <span className="settings-info-value">@{user.username}</span>
                </div>
                <div className="settings-info-row">
                  <span className="settings-info-label">Email</span>
                  <span className="settings-info-value">{user.email}</span>
                </div>
                <div className="settings-info-row">
                  <span className="settings-info-label">Role</span>
                  <span className="settings-info-value">{user.role_name}</span>
                </div>
                <div className="settings-info-row">
                  <span className="settings-info-label">Department</span>
                  <span className="settings-info-value">{user.department}</span>
                </div>
                <div className="settings-info-row no-border">
                  <span className="settings-info-label">Hierarchy Level</span>
                  <span className="settings-info-value">Tier {user.hierarchy_level}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Security" && (
            <div>
              <h2 className="settings-pane-title">Security Settings</h2>
              <div className="settings-form-list">
                <div className="hp-field">
                  <label>Current Password</label>
                  <input type="password" placeholder="current password..." value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div className="hp-field">
                  <label>New Password</label>
                  <input type="password" placeholder="new password..." value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="hp-field">
                  <label>Confirm New Password</label>
                  <input type="password" placeholder="confirm new password..." value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                {securityError && <p className="settings-message error">{securityError}</p>}
                {securitySuccess && <p className="settings-message success">{securitySuccess}</p>}
                <button onClick={handleChangePassword} className="hp-btn-primary-sharp settings-btn-submit">Change Password</button>
              </div>
            </div>
          )}

          {activeTab === "Appearance" && (
            <div>
              <h2 className="settings-pane-title">Appearance Preferences</h2>
              <div className="settings-pref-list">
                <div className="settings-pref-row no-border">
                  <div>
                    <span className="settings-pref-title">Dark Mode Theme</span>
                    <span className="settings-pref-desc">Switch interface between light and dark backgrounds.</span>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`settings-toggle-btn ${theme === "dark" ? "active" : ""}`}
                  >
                    {theme === "dark" ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "Notifications" && (
            <div>
              <h2 className="settings-pane-title">Notifications Preferences</h2>
              <div className="settings-pref-list">
                <div className="settings-pref-row">
                  <div>
                    <span className="settings-pref-title">Email Notifications</span>
                    <span className="settings-pref-desc">Receive critical account alerts and details via email.</span>
                  </div>
                  <button
                    onClick={() => setEmailNotif(!emailNotif)}
                    className={`settings-toggle-btn ${emailNotif ? "active" : ""}`}
                  >
                    {emailNotif ? "On" : "Off"}
                  </button>
                </div>
                <div className="settings-pref-row no-border">
                  <div>
                    <span className="settings-pref-title">Push Notifications</span>
                    <span className="settings-pref-desc">Receive system alerts in real-time on your screen.</span>
                  </div>
                  <button
                    onClick={() => setPushNotif(!pushNotif)}
                    className={`settings-toggle-btn ${pushNotif ? "active" : ""}`}
                  >
                    {pushNotif ? "On" : "Off"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
