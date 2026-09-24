import { useState, useEffect } from "react";
import "../../Home.css";
import "../../ProfilePage.css";
import { Dashboard } from "../components/Dashboard";
import { invoke } from "@tauri-apps/api/core";

export function ProfilePage() {
  const [activeItem, setActiveItem] = useState("Profile");
  const [activeSection, setActiveSection] = useState("Overview");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const [displayName, setDisplayName] = useState(user.display_name || "");
  const [email, setEmail] = useState(user.email || "");
  const [bio, setBio] = useState(user.bio || "");
  const [profilePicture, setProfilePicture] = useState(user.profile_picture || "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [passengerDetails, setPassengerDetails] = useState<any>(null);
  const [cabinPreference, setCabinPreference] = useState("");
  const [roomTemperature, setRoomTemperature] = useState("");
  const [pillowStyle, setPillowStyle] = useState("");
  const [dietaryRequirements, setDietaryRequirements] = useState("");
  const [newspaperPreference, setNewspaperPreference] = useState("");
  const [minibarSelection, setMinibarSelection] = useState("");
  const [specialRequestsText, setSpecialRequestsText] = useState("");
  const [vipConciergeChannel, setVipConciergeChannel] = useState("");

  const roleName = user.role_name;
  const username = user.username;
  const department = user.department;
  const hierarchyLevel = user.hierarchy_level;
  const accessibleModules = user.accessible_modules;

  const isPassenger = roleName === "Passenger";

  const stats = [
    { label: "Bookings", value: user.bookings || "0" },
    { label: "Favorites", value: user.favorites || "0" },
    { label: "Reviews", value: user.reviews || "0" },
  ];
  const isActive = user.is_active !== false;
  const lastLoginFormatted = user.last_login ? new Date(user.last_login).toLocaleString() : "Never";

  const initials = (displayName || "User").split(" ").map((word: string) => word[0]).filter(Boolean).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (isPassenger) {
      loadPassengerProfile();
    }
  }, [isPassenger]);

  const loadPassengerProfile = async () => {
    try {
      const details = await invoke("get_passenger", { passengerId: user.user_id }) as any;
      setPassengerDetails(details);
      setVipConciergeChannel(details.vip_contact_channel || "");
      if (details.preferences) {
        setCabinPreference(details.preferences.cabin_preference || "");
        setRoomTemperature(details.preferences.temperature || "");
        setPillowStyle(details.preferences.pillow_type || "");
        setDietaryRequirements(details.preferences.dietary_notes || "");
        setNewspaperPreference(details.preferences.preferred_newspaper || "");
        setMinibarSelection(details.preferences.minibar_preference || "");
        setSpecialRequestsText(details.preferences.special_requests || "");
      }
    } catch (err) {
      setError("Failed to load passenger preferences: " + String(err));
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicture(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveChanges = async () => {
    setError("");
    setSuccess("");
    try {
      const updatedUser = await invoke("update_profile", {
        userId: user.user_id,
        displayName: displayName.trim(),
        email: email.trim(),
        bio: bio.trim() || null,
        profilePicture: profilePicture || null,
      }) as any;

      if (isPassenger) {
        await invoke("update_passenger_profile", {
          payload: {
            passenger_id: user.user_id,
            display_name: displayName.trim(),
            email: email.trim(),
            vip_contact_channel: vipConciergeChannel.trim() || null
          }
        });

        if (passengerDetails?.status?.toLowerCase() === "vip") {
          await invoke("update_passenger_preference", {
            payload: {
              passenger_id: user.user_id,
              cabin_preference: cabinPreference.trim() || null,
              temperature: roomTemperature.trim() || null,
              pillow_type: pillowStyle.trim() || null,
              dietary_notes: dietaryRequirements.trim() || null,
              preferred_newspaper: newspaperPreference.trim() || null,
              minibar_preference: minibarSelection.trim() || null,
              special_requests: specialRequestsText.trim() || null
            }
          });
        }
      }

      localStorage.setItem("user", JSON.stringify(updatedUser));
      setSuccess("Profile updated successfully!");
      if (isPassenger) {
        loadPassengerProfile();
      }
    } catch (err) {
      setError(String(err));
    }
  };

  const formatModuleName = (module: string) => {
    const customMapping: Record<string, string> = {
      self_registration: "Self Registration",
      profile_management: "Profile Management",
      performance_booking: "Performance Booking",
      restaurant_reservation: "Restaurant Reservation",
      medical_request_submission: "Medical Request Submission",
      onboard_spending_view: "Onboard Spending View",
      complaint_submission: "Complaint Submission",
      in_app_chat_passenger: "In-App Chat Passenger",
      notification_management: "Notification Management",
      cabin_service_request: "Cabin Service Request"
    };
    return customMapping[module] || module.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <Dashboard
      activeItem={activeItem}
      activeSection={activeSection}
      setActiveItem={setActiveItem}
      setActiveSection={setActiveSection}
    >
      <div className="pf-banner">
        <div className="pf-banner-content">
          <div className="pf-avatar" onClick={() => document.getElementById("avatar-upload")?.click()}>
            {profilePicture ? (
              <img src={profilePicture} alt="Avatar" />
            ) : (
              initials
            )}
            <div className="pf-avatar-overlay">
              Change
            </div>
          </div>
          <input
            type="file"
            id="avatar-upload"
            accept="image/*"
            className="pf-hidden-input"
            onChange={handleAvatarChange}
          />
          <div>
            <h1 className="pf-title">{displayName}</h1>
            <p className="pf-subtitle">{roleName} · {department || "Voyage Passenger"}</p>
            <div className="pf-pill">@{username}</div>
          </div>
        </div>
      </div>

      <div className="pf-grid">
        <div className="pf-sidebar-card">
          <div className="pf-card-label">About</div>
          <p className="pf-bio">{bio || "No bio set."}</p>

          <div className="pf-card-label mt-32">Account Details</div>
          <div className="pf-meta-list">
            <div className="pf-meta-item">
              <span className="pf-meta-label">
                <i className="fa fa-calendar" /> Joined Date
              </span>
              <span className="pf-meta-value">June 2026</span>
            </div>
            <div className="pf-meta-item">
              <span className="pf-meta-label">
                <i className="fa fa-circle-check" /> Status
              </span>
              <span className="pf-meta-value">
                <span className={`pf-status-indicator ${isActive ? "active" : "inactive"}`} />
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="pf-meta-item">
              <span className="pf-meta-label">
                <i className="fa fa-clock" /> Last Login
              </span>
              <span className="pf-meta-value">{lastLoginFormatted}</span>
            </div>
            <div className="pf-meta-item">
              <span className="pf-meta-label">
                <i className="fa fa-shield" /> Security
              </span>
              <span className="pf-meta-value">
                <span className="pf-security-badge">HIGH</span>
              </span>
            </div>
            <div className="pf-meta-item">
              <span className="pf-meta-label">
                <i className="fa fa-layer-group" /> Authority Level
              </span>
              <span className="pf-meta-value">Tier {hierarchyLevel ?? 1}</span>
            </div>
          </div>

          <div className="pf-card-label mt-32">Module Permissions</div>
          <div className="pf-pill-list">
            {accessibleModules && accessibleModules.length > 0 ? (
              accessibleModules.map((module: string, index: number) => (
                <span key={index} className="pf-module-small-pill">
                  <i className="fa fa-circle-notch fa-xs" />
                  {formatModuleName(module)}
                </span>
              ))
            ) : (
              <span className="pf-module-small-pill">No Module Access</span>
            )}
          </div>
        </div>

        <div>
          <div className="pf-stat-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="pf-stat-card">
                <div className="pf-stat-value">{stat.value}</div>
                <div className="pf-stat-label">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="hp-form-card-sharp">
            <div className="hp-block-header">
              <h2>Profile Details</h2>
            </div>
            <div className="hp-grid-2">
              <div className="hp-field">
                <label>Name</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="hp-field">
                <label>Role</label>
                <input type="text" value={roleName} readOnly />
              </div>
              <div className="hp-field">
                <label>Email</label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="hp-field">
                <label>Department</label>
                <input type="text" value={department || "Voyage Passenger"} readOnly />
              </div>
              <div className="hp-field hp-full">
                <label>Hierarchy Level</label>
                <input type="text" value={String(hierarchyLevel ?? 1)} readOnly />
              </div>

              {isPassenger && passengerDetails?.status?.toLowerCase() === "vip" && (
                <div className="hp-field hp-full">
                  <label>VIP Dedicated Contact Channel</label>
                  <input
                    type="text"
                    value={vipConciergeChannel}
                    onChange={(e) => setVipConciergeChannel(e.target.value)}
                    placeholder="e.g. Concierge Desk Ext 404"
                  />
                </div>
              )}

              <div className="hp-field hp-full">
                <label>About Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={200}
                />
                <div className="hp-textarea-counter">
                  {bio.length}/200
                </div>
              </div>
            </div>
            {error && <p className="text-error">{error}</p>}
            {success && <p className="text-success">{success}</p>}
            <button className="hp-btn-primary-sharp" onClick={handleSaveChanges}>
              Save Changes
            </button>
          </div>

          {isPassenger && passengerDetails?.status?.toLowerCase() === "vip" && (
            <div className="hp-form-card-sharp ps-margin-top-24">
              <div className="hp-block-header">
                <h2>VIP Travel Preferences</h2>
              </div>
              <div className="hp-grid-2">
                <div className="hp-field">
                  <label>Cabin Preference</label>
                  <select value={cabinPreference} onChange={(e) => setCabinPreference(e.target.value)} className="hp-select-sharp">
                    <option value="">None</option>
                    <option value="Suite">Suite Room</option>
                    <option value="Balcony">Balcony Cabin</option>
                    <option value="Oceanview">Ocean View</option>
                    <option value="Inside">Inside Cabin</option>
                  </select>
                </div>
                <div className="hp-field">
                  <label>Preferred Room Temperature</label>
                  <select value={roomTemperature} onChange={(e) => setRoomTemperature(e.target.value)} className="hp-select-sharp">
                    <option value="">None</option>
                    <option value="18°C">18°C</option>
                    <option value="20°C">20°C</option>
                    <option value="22°C">22°C</option>
                    <option value="24°C">24°C</option>
                    <option value="26°C">26°C</option>
                  </select>
                </div>
                <div className="hp-field">
                  <label>Pillow Selection</label>
                  <select value={pillowStyle} onChange={(e) => setPillowStyle(e.target.value)} className="hp-select-sharp">
                    <option value="">None</option>
                    <option value="Feather">Feather Pillow</option>
                    <option value="Memory Foam">Memory Foam</option>
                    <option value="Latex">Latex Pillow</option>
                    <option value="Contour">Contour Pillow</option>
                  </select>
                </div>
                <div className="hp-field">
                  <label>Preferred Daily Newspaper</label>
                  <select value={newspaperPreference} onChange={(e) => setNewspaperPreference(e.target.value)} className="hp-select-sharp">
                    <option value="">None</option>
                    <option value="The New York Times">The New York Times</option>
                    <option value="Financial Times">Financial Times</option>
                    <option value="The Straits Times">The Straits Times</option>
                    <option value="Le Monde">Le Monde</option>
                  </select>
                </div>
                <div className="hp-field hp-full">
                  <label>Minibar Preference</label>
                  <select value={minibarSelection} onChange={(e) => setMinibarSelection(e.target.value)} className="hp-select-sharp">
                    <option value="">None</option>
                    <option value="Cleared">Cleared (Empty)</option>
                    <option value="Stocked">Fully Stocked</option>
                    <option value="Soft Drinks Only">Soft Drinks Only</option>
                    <option value="Alcohol Only">Alcoholic Beverages Only</option>
                  </select>
                </div>
                <div className="hp-field hp-full">
                  <label>Dietary Restrictions / Culinary Notes</label>
                  <textarea value={dietaryRequirements} onChange={(e) => setDietaryRequirements(e.target.value)} maxLength={200} placeholder="e.g. Vegetarian, vegan, low-sodium requirements..." />
                </div>
                <div className="hp-field hp-full">
                  <label>Special Requests</label>
                  <textarea value={specialRequestsText} onChange={(e) => setSpecialRequestsText(e.target.value)} maxLength={300} placeholder="Any other specific VIP accommodations you require..." />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dashboard>
  );
}
