import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Dashboard } from "../../components/Dashboard";
import { LoadingScreen } from "../../components/LoadingScreen";
import "../../../ZoneSecurityAlerts.css";

interface Zone {
  zone_id: string;
  zone_name: string;
  passenger_density: string;
  activity_score: number;
}

interface Crew {
  account_id: string;
  username: string;
  display_name: string;
  role_name: string;
  department: string;
}

interface ZoneAlert {
  alert_id: string;
  zone_id: string;
  message: string;
  sent_by: string;
  sent_by_name: string;
  sent_at: string;
  status: string;
  recipients: string;
}

export function ZoneSecurityAlerts() {
  const navigate = useNavigate();
  const loggedInUser = JSON.parse(localStorage.getItem("user") || "{}");
  const isSecurityOfficer = loggedInUser.role_name === "Security Officer";

  const [activeItem, setActiveItem] = useState("Zone Security Alerts");
  const [activeSection, setActiveSection] = useState("Overview");

  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [alerts, setAlerts] = useState<ZoneAlert[]>([]);
  const [message, setMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isSecurityOfficer) {
      const timer = setTimeout(() => {
        navigate("/home");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSecurityOfficer, navigate]);

  useEffect(() => {
    if (isSecurityOfficer) {
      loadData();
    }
  }, [isSecurityOfficer]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const zonesList = await invoke<Zone[]>("list_zones");
      setZones(zonesList);
      const alertsList = await invoke<ZoneAlert[]>("list_zone_alerts");
      setAlerts(alertsList);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSelectZone = async (zone: Zone) => {
    setSelectedZone(zone);
    setCrew([]);
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const crewList = await invoke<Crew[]>("get_zone_crew", { zoneId: zone.zone_id });
      setCrew(crewList);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedZone) {
      setErrorMsg("Please select a target zone from the floor plan first.");
      return;
    }

    if (!message.trim()) {
      setErrorMsg("Alert message is required before sending.");
      return;
    }

    if (crew.length === 0) {
      setErrorMsg("No crew assigned to this zone.");
      return;
    }

    setLoading(true);
    try {
      await invoke("send_zone_specific_security_alert", {
        payload: {
          zone_id: selectedZone.zone_id,
          message: message.trim(),
          sent_by: loggedInUser.user_id,
        },
      });

      setSuccessMsg(`Security alert successfully sent to ${selectedZone.zone_name} crew!`);
      setMessage("");
      const alertsList = await invoke<ZoneAlert[]>("list_zone_alerts");
      setAlerts(alertsList);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAlert = async (alertId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await invoke("close_zone_alert", {
        alertId,
        closedBy: loggedInUser.user_id,
      });
      setSuccessMsg("Security alert closed and marked as resolved.");
      const alertsList = await invoke<ZoneAlert[]>("list_zone_alerts");
      setAlerts(alertsList);
    } catch (err: any) {
      setErrorMsg(err.toString());
    } finally {
      setLoading(false);
    }
  };

  if (!isSecurityOfficer) {
    return (
      <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
        <div className="zsa-access-denied">
          <i className="fa-solid fa-circle-exclamation zsa-denied-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to view the Security Alert Console. Redirecting to home...</p>
          <div className="zsa-redirect-spinner" />
        </div>
      </Dashboard>
    );
  }

  const decks = {
    "Deck 11 (Pool Deck)": zones.filter(z => z.zone_id === "ZONE_A"),
    "Decks 5-7 (Entertainment & Dining)": zones.filter(z => ["ZONE_B", "ZONE_C", "ZONE_E"].includes(z.zone_id)),
    "Decks 2-3 (Engineering & Operations)": zones.filter(z => ["ZONE_D", "ZONE_F"].includes(z.zone_id)),
  };

  return (
    <Dashboard activeItem={activeItem} activeSection={activeSection} setActiveItem={setActiveItem} setActiveSection={setActiveSection}>
      <LoadingScreen visible={loading} />

      <div className="zsa-container">
        <div>
          <h1 className="zsa-title">Zone Security Alerts</h1>
          <p className="zsa-subtitle">Targeted security dispatching. Monitor deck passenger density and issue quiet zone-specific alert protocols.</p>
        </div>

        {errorMsg && (
          <div className="zsa-alert-box error zsa-mt-20">
            <i className="fa-solid fa-triangle-exclamation" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="zsa-alert-box success zsa-mt-20">
            <i className="fa-solid fa-circle-check" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="zsa-grid">
          <div className="zsa-card">
            <h2 className="zsa-section-title">
              <i className="fa-solid fa-ship zsa-mr-10" />
              Live Vessel Floor Plan & Zone Density Map
            </h2>
            <div className="zsa-ship-layout">
              {Object.entries(decks).map(([deckName, deckZones]) => (
                <div key={deckName} className="zsa-deck-row">
                  <div className="zsa-deck-header">{deckName}</div>
                  <div className="zsa-zones-container">
                    {deckZones.map((zone) => {
                      const isSelected = selectedZone?.zone_id === zone.zone_id;
                      const densityClass = zone.passenger_density.toLowerCase();
                      return (
                        <div
                          key={zone.zone_id}
                          className={`zsa-zone-node ${isSelected ? "selected" : ""}`}
                          onClick={() => handleSelectZone(zone)}
                        >
                          <span className="zsa-zone-name">{zone.zone_name}</span>
                          <div className="zsa-zone-meta">
                            <span className={`zsa-density-badge ${densityClass}`}>
                              {zone.passenger_density}
                            </span>
                            <span className="zsa-activity-indicator">
                              <span className={`zsa-activity-dot pulse ${densityClass === "high" || densityClass === "elevated" ? "red" : densityClass === "medium" ? "orange" : ""}`} />
                              Score: {zone.activity_score}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="zsa-flex-col-gap">
            <div className="zsa-card">
              <h2 className="zsa-section-title">
                <i className="fa-solid fa-users zsa-mr-10" />
                Zone Crew Dispatch
              </h2>
              {selectedZone ? (
                <div>
                  <div className="zsa-mb-16-ink">
                    Selected Zone: <strong className="zsa-blue-strong">{selectedZone.zone_name}</strong>
                  </div>
                  <div className="zsa-crew-list">
                    {crew.map((member) => (
                      <div key={member.account_id} className="zsa-crew-card">
                        <div className="zsa-crew-info">
                          <span className="zsa-crew-name">{member.display_name}</span>
                          <span className="zsa-crew-role">{member.role_name} ({member.department})</span>
                        </div>
                        <span className="zsa-crew-status">
                          <i className="fa-solid fa-circle zsa-dot-size" />
                          On Duty
                        </span>
                      </div>
                    ))}
                    {crew.length === 0 && (
                      <div className="zsa-alert-box error zsa-margin-0">
                        <i className="fa-solid fa-circle-exclamation" />
                        <span>No crew assigned to this zone.</span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendAlert}>
                    <div className="zsa-draft-label">
                      Draft Quiet Alert Message
                    </div>
                    <textarea
                      className="zsa-input-field"
                      placeholder="Type instructions to dispatch to the selected zone crew..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={crew.length === 0}
                    />
                    <button
                      type="submit"
                      className="zsa-btn-send"
                      disabled={crew.length === 0 || !message.trim()}
                    >
                      <i className="fa-solid fa-paper-plane" />
                      Send Zone Alert
                    </button>
                  </form>
                </div>
              ) : (
                <div className="zsa-empty-state">
                  Select a zone from the floor plan map to view active crew and dispatch alerts.
                </div>
              )}
            </div>

            <div className="zsa-card">
              <h2 className="zsa-section-title">
                <i className="fa-solid fa-history zsa-mr-10" />
                Active Alerts Log
              </h2>
              <div className="zsa-alert-log-list">
                {alerts.map((alert) => (
                  <div key={alert.alert_id} className="zsa-log-card">
                    <div className="zsa-log-header">
                      <span className="zsa-log-zone-tag">
                        {zones.find(z => z.zone_id === alert.zone_id)?.zone_name || alert.zone_id}
                      </span>
                      <span className={`zsa-log-status-tag ${alert.status.toLowerCase()}`}>
                        {alert.status}
                      </span>
                    </div>
                    <div className="zsa-log-message">{alert.message}</div>
                    <div className="zsa-log-meta">
                      <span>By: {alert.sent_by_name}</span>
                      <span>{new Date(alert.sent_at).toLocaleTimeString()}</span>
                    </div>
                    <div className="zsa-log-recipients">
                      Recipients: {alert.recipients}
                    </div>
                    {alert.status === "Active" && (
                      <div className="zsa-flex-end-mt-8">
                        <button
                          type="button"
                          className="zsa-btn-close-alert"
                          onClick={() => handleCloseAlert(alert.alert_id)}
                        >
                          Mark Resolved
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="zsa-empty-state">No security alerts sent yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dashboard>
  );
}
