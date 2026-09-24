import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import "../../Home.css";
import logo from "../../assets/logo.jpg";
import { DashboardProps } from "../interfaces/IDashboardProps";
import { LoadingScreen } from "./LoadingScreen";
import { NotificationMailbox } from "./NotificationMailbox";

const navSections = [
  {
    label: "Overview",
    items: [
      "Dashboard",
      "Profile",
      "Settings",
      "Voyage Management",
      "Review Incident Reports",
      "Security Incident Report",
      "Zone Security Alerts",
      "Medical Incident Logging",
      "Recruitment & Screening",
      "Linen Inventory",
      "Performance Reports",
      "Payroll Management",
      "Refund Requests",
      "Restock Approvals",
      "Front Desk Console",
      "Restaurant Management",
      "Supplier Dashboard",
      "Operations Console",
      "Staff Schedules",
    ],
  },
  {
    label: "Engineering",
    items: [
      "Report Malfunction",
      "Engineering Tasks",
      "Staff Directory",
    ],
  },
  {
    label: "Bookings",
    items: ["Travel Booking", "Restaurant Reservation", "Performance Booking"],
  },
  {
    label: "Onboard",
    items: ["Performances", "Dining", "Activities", "Cabin Info", "Live Chat"],
  },
  {
    label: "Account",
    items: ["Notifications","Logout"],
  },
];

const itAdminSection = {
  label: "IT Administration",
  items: [
    "Register Account",
    "User Management",
    "Role Management",
    "System Logs",
    "Backup System",
  ],
};

const moduleMap: Record<string, string> = {
  "Travel Booking": "self_registration",
  "Restaurant Reservation": "restaurant_reservation",
  "Performance Booking": "performance_booking",
  "Performances": "performance_booking",
  "Dining": "restaurant_reservation",
  "Cabin Info": "cabin_service_request",
  "Notifications": "notification_management",
  "Review Incident Reports": "incident_report_review",
  "Security Incident Report": "security_incident_report",
  "Zone Security Alerts": "zone_alert_broadcast",
  "Medical Incident Logging": "medical_incident_logging",
  "Recruitment & Screening": "crew_recruitment",
  "Linen Inventory": "linen_inventory",
  "Payroll Management": "payroll_management",
};

const itemIcons: Record<string, string> = {
  "Dashboard": "fa-solid fa-chart-pie",
  "Profile": "fa-solid fa-user",
  "Settings": "fa-solid fa-gear",
  "Travel Booking": "fa-solid fa-suitcase",
  "Restaurant Reservation": "fa-solid fa-utensils",
  "Performance Booking": "fa-solid fa-ticket",
  "Performances": "fa-solid fa-music",
  "Dining": "fa-solid fa-bowl-food",
  "Activities": "fa-solid fa-volleyball",
  "Cabin Info": "fa-solid fa-bed",
  "Notifications": "fa-solid fa-bell",
  "Logout": "fa-solid fa-right-from-bracket",
  "Register Account": "fa-solid fa-user-plus",
  "User Management": "fa-solid fa-users-gear",
  "Role Management": "fa-solid fa-address-card",
  "System Logs": "fa-solid fa-file-invoice",
  "Backup System": "fa-solid fa-database",
  "Review Incident Reports": "fa-solid fa-triangle-exclamation",
  "Security Incident Report": "fa-solid fa-shield-halved",
  "Zone Security Alerts": "fa-solid fa-satellite-dish",
  "Medical Incident Logging": "fa-solid fa-notes-medical",
  "Recruitment & Screening": "fa-solid fa-user-tie",
  "Linen Inventory": "fa-solid fa-box-open",
  "Performance Reports": "fa-solid fa-microphone-lines",
  "Payroll Management": "fa-solid fa-file-invoice-dollar",
  "Refund Requests": "fa-solid fa-hand-holding-dollar",
  "Restock Approvals": "fa-solid fa-truck-ramp-box",
  "Front Desk Console": "fa-solid fa-concierge-bell",
  "Report Malfunction": "fa-solid fa-bullhorn",
  "Engineering Tasks": "fa-solid fa-screwdriver-wrench",
  "Staff Directory": "fa-solid fa-people-carry-box",
  "Class Diagram": "fa-solid fa-sitemap",
  "Use Case Flow": "fa-solid fa-arrow-right-arrow-left",
  "KPI Scorecard": "fa-solid fa-award",
  "Live Chat": "fa-solid fa-comments",
  "Voyage Management": "fa-solid fa-ship",
  "Restaurant Management": "fa-solid fa-utensils",
  "Supplier Dashboard": "fa-solid fa-truck-field",
  "Operations Console": "fa-solid fa-person-running",
  "Staff Schedules": "fa-solid fa-calendar-days"
};

export function Dashboard({ activeItem, activeSection, setActiveItem, setActiveSection, children }: DashboardProps) {
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem("hp-sidebar-collapsed") === "true";
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [isCrewAssigned, setIsCrewAssigned] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(() => {
    const EXEMPTED_ROLES = [
      "IT Admin",
      "Cruise Operations Director",
      "Cruise Director",
      "Operations Manager",
      "Finance Manager",
      "Restaurant Manager",
      "Chief Engineer",
      "Security Officer",
      "Housekeeping Supervisor",
      "Entertainment Manager",
      "Passenger",
      "Supplier"
    ];
    return !!(user.role_name && !EXEMPTED_ROLES.includes(user.role_name));
  });
  const isITAdmin = user.role_name === "IT Admin";
  const [showIncompleteBanner, setShowIncompleteBanner] = useState(() => {
    return localStorage.getItem("profile_incomplete") === "true";
  });
  const [hasBooking, setHasBooking] = useState(false);

  useEffect(() => {
    if (!user.role_name) {
      setIsCrewAssigned(true);
      return;
    }
    const EXEMPTED_ROLES = [
      "IT Admin",
      "Cruise Operations Director",
      "Cruise Director",
      "Operations Manager",
      "Finance Manager",
      "Restaurant Manager",
      "Chief Engineer",
      "Security Officer",
      "Housekeeping Supervisor",
      "Entertainment Manager",
      "Passenger",
      "Supplier"
    ];
    if (EXEMPTED_ROLES.includes(user.role_name)) {
      setIsCrewAssigned(true);
    } else {
      const checkAssignment = async () => {
        try {
          const res = await invoke<boolean>("is_crew_assigned_to_voyage", { accountId: user.account_id || user.user_id });
          setIsCrewAssigned(res);
        } catch (err) {
          console.error(err);
          setIsCrewAssigned(false);
        } finally {
          setLoading(false);
        }
      };
      checkAssignment();
    }
  }, [user.role_name, user.account_id, user.user_id]);

  useEffect(() => {
    if (user.role_name === "Passenger" && user.user_id) {
      const checkBooking = async () => {
        try {
          const res: any = await invoke("view_booking_reservation_and_itinerary", { passengerId: user.user_id });
          const hasActive = Array.isArray(res.bookings) && res.bookings.length > 0;
          setHasBooking(hasActive);
        } catch (err) {
          console.error(err);
        }
      };
      checkBooking();

      const handleUpdate = () => {
        checkBooking();
      };
      window.addEventListener("voyage_booking_updated", handleUpdate);
      return () => {
        window.removeEventListener("voyage_booking_updated", handleUpdate);
      };
    }
  }, [user.role_name, user.user_id]);

  const handleDismissBanner = () => {
    setShowIncompleteBanner(false);
    localStorage.removeItem("profile_incomplete");
  };

  const allowedSections = useMemo(() => {
    if (isCrewAssigned === false) {
      return [
        {
          label: "Overview",
          items: ["Dashboard", "Profile", "Settings"]
        },
        {
          label: "Account",
          items: ["Logout"]
        }
      ];
    }
    const userMods = Array.isArray(user.accessible_modules) ? user.accessible_modules : [];
    const isPassenger = user.role_name === "Passenger";
    const allowedList = navSections.map((section) => {
      const allowedItems = section.items.filter((item) => {
        if (!isPassenger && item === "Notifications") {
          return false;
        }
        if (item === "Linen Inventory" && user.role_name === "Housekeeping Supervisor") {
          return true;
        }
        if (item === "Zone Security Alerts") {
          return user.role_name === "Security Officer";
        }
        if (item === "Security Incident Report") {
          return user.role_name === "Safety Officer";
        }
        if (item === "Review Incident Reports") {
          return user.role_name === "Security Officer" || user.role_name === "Ship Captain" || user.role_name === "Cruise Operations Director";
        }
        if (item === "Voyage Management") {
          return user.role_name === "Cruise Operations Director" || user.role_name === "Cruise Director";
        }
        if (item === "Staff Schedules") {
          return user.role_name === "Entertainment Manager";
        }
        if (item === "Performance Reports") {
          return user.role_name === "Entertainment Staff" || user.role_name === "Entertainment Manager";
        }
        if (item === "Performance Booking" || item === "Performances") {
          return (isPassenger && hasBooking) || (!isPassenger && (user.role_name === "Entertainment Staff" || user.role_name === "Entertainment Manager"));
        }
        if (item === "Restaurant Reservation" || item === "Dining") {
          return (isPassenger && hasBooking) || (!isPassenger && user.role_name === "Restaurant Manager");
        }
        if (item === "Restaurant Management") {
          return user.role_name === "Restaurant Manager";
        }
        if (item === "Payroll Management") {
          return user.role_name === "Finance Manager";
        }
        if (item === "Refund Requests") {
          return user.role_name === "Finance Manager";
        }
        if (item === "Restock Approvals") {
          return user.role_name === "Finance Manager";
        }
        if (item === "Operations Console") {
          return user.role_name === "Operations Manager";
        }
        if (item === "Supplier Dashboard") {
          return user.role_name === "Supplier";
        }
        if (item === "Front Desk Console") {
          return user.role_name === "Front Desk Officer";
        }
        if (item === "Report Malfunction") {
          return user.role_name === "Engineer";
        }
        if (item === "Engineering Tasks") {
          return user.role_name === "Engineer" || user.role_name === "Chief Engineer";
        }
        if (item === "Staff Directory") {
          return user.role_name === "Chief Engineer";
        }
        if (["Activities", "Cabin Info", "Live Chat"].includes(item)) {
          return isPassenger && hasBooking;
        }
        if (item === "Travel Booking") {
          return isPassenger;
        }
        const modName = moduleMap[item];
        if (!modName) return true;
        return userMods.includes(modName);
      });
      return { ...section, items: allowedItems };
    }).filter((section) => section.items.length > 0);

    return isITAdmin ? [...allowedList, itAdminSection] : allowedList;
  }, [isITAdmin, user.accessible_modules, user.role_name, hasBooking, isCrewAssigned]);

  const handleItemClick = (item: string) => {
    if (item === "Profile") {
      navigate("/profile");
    } else if (item === "Dashboard") {
      navigate("/home");
    } else if (item === "Settings") {
      navigate("/settings");
    } else if (item === "Voyage Management") {
      navigate("/voyages");
    } else if (item === "Review Incident Reports") {
      navigate("/review-incidents");
    } else if (item === "Security Incident Report") {
      navigate("/security-report");
    } else if (item === "Zone Security Alerts") {
      navigate("/zone-alerts");
    } else if (item === "Medical Incident Logging") {
      navigate("/medical-report");
    } else if (item === "Recruitment & Screening") {
      navigate("/hr-dashboard");
    } else if (item === "Linen Inventory") {
      navigate("/housekeeping-dashboard");
    } else if (item === "Payroll Management") {
      navigate("/payroll");
    } else if (item === "Refund Requests") {
      navigate("/refunds");
    } else if (item === "Restock Approvals") {
      navigate("/restocks");
    } else if (item === "Operations Console") {
      navigate("/opm-dashboard");
    } else if (item === "Supplier Dashboard") {
      navigate("/supplier-dashboard");
    } else if (item === "Front Desk Console") {
      navigate("/fdo-dashboard");
    } else if (item === "Report Malfunction") {
      navigate("/engineering-dashboard", { state: { activeTab: "orders", openCreateForm: true } });
    } else if (item === "Engineering Tasks") {
      navigate("/engineering-dashboard", { state: { activeTab: "orders" } });
    } else if (item === "Staff Directory") {
      navigate("/engineering-dashboard", { state: { activeTab: "staff" } });
    } else if (item === "Restaurant Management") {
      navigate("/restaurant-dashboard");
    } else if (item === "Performance Reports") {
      navigate("/home");
    } else if (item === "Staff Schedules") {
      navigate("/home");
    } else if (item === "Logout") {
      setShowLogoutModal(true);
      return;
    } else if ([ "Register Account","User Management","Role Management","System Logs","Backup System" ].includes(item)){
      navigate("/it-dashboard", { state: { activeItem: item } });
    }
    setActiveItem(item);
  };

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("hp-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="hp-root-top">
      <aside className={`hp-sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="hp-sidebar-header">
          <img src={logo} alt="Logo" className="hp-logo-sm" />
          {!isCollapsed && <span className="hp-brand-name">SaiLintis</span>}
        </div>
        <div className="hp-sidebar-menu">
          {allowedSections.map((section) => (
            <div key={section.label} className={`hp-sidebar-group ${activeSection === section.label ? "hp-active-group" : ""}`}>
              <div className="hp-sidebar-group-label">{section.label}</div>
              {section.items.map((item) => {
                const isActive = activeItem === item;
                return (
                  <button
                    key={item}
                    className={`hp-sidebar-item ${isActive ? "hp-active" : ""}`}
                    onClick={() => {
                      const sectionOfItem = allowedSections.find(s => s.items.includes(item));
                      if (sectionOfItem) {
                        setActiveSection(sectionOfItem.label);
                      }
                      handleItemClick(item);
                    }}
                    title={isCollapsed ? item : undefined}
                  >
                    <i className={itemIcons[item] || "fa-solid fa-circle"} />
                    {!isCollapsed && <span>{item}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hp-sidebar-footer">
          <button
            className="hp-sidebar-item hp-logout-btn"
            onClick={() => handleItemClick("Logout")}
            title={isCollapsed ? "Logout" : undefined}
          >
            <i className="fa-solid fa-right-from-bracket" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <header className={`hp-top-nav ${isCollapsed ? "collapsed" : ""}`}>
        <div className="hp-nav-container">
          <div className="hp-nav-left-top">
            <button className="hp-hamburger-btn" onClick={toggleSidebar}>
              <i className="fa-solid fa-bars" />
            </button>
          </div>

          <div className="hp-nav-right-top">
            <NotificationMailbox recipientRole={user.role_name || ""} />
            <div className="hp-user-badge">
              {user.profile_picture ? (
                <img
                  src={user.profile_picture}
                  alt="Avatar"
                  className="hp-user-avatar-top"
                />
              ) : (
                <span className="hp-user-initials">
                  {user.display_name?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="hp-user-info">
                <span className="hp-user-name-top">{user.display_name}</span>
                <span className="hp-user-role">{user.role_name}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className={`hp-main-scroll ${isCollapsed ? "collapsed" : ""}`}>
        <div className="hp-content-centered">
          {showIncompleteBanner && (
            <div className="hp-profile-incomplete-banner">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>
                Your profile is incomplete. Please update your{" "}
                <a onClick={() => { navigate("/profile"); handleDismissBanner(); }}>bio and profile photo</a>
                {" "}to complete your account setup.
              </span>
              <button className="hp-banner-dismiss" onClick={handleDismissBanner}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          )}
          {isCrewAssigned === false && activeItem !== "Profile" && activeItem !== "Settings" ? (
            <div className="hp-unassigned-container" style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 32px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
              maxWidth: "500px",
              margin: "100px auto",
              textAlign: "center"
            }}>
              <div className="hp-unassigned-icon-container" style={{
                background: "#fef2f2",
                borderRadius: "50%",
                width: "80px",
                height: "80px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "24px",
                color: "#ef4444",
                border: "4px solid #fee2e2"
              }}>
                <i className="fa-solid fa-lock" style={{ fontSize: "32px" }} />
              </div>
              <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", marginBottom: "12px", letterSpacing: "-0.02em" }}>
                Voyage Assignment Required
              </h2>
              <p style={{ fontSize: "14px", color: "#64748b", lineHeight: "1.6", marginBottom: "24px" }}>
                You have not been assigned to any active voyage. Non-manager crew members must be assigned to a voyage by the Cruise Operations Director to access system modules.
              </p>
              <div style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "16px",
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                textAlign: "left"
              }}>
                <i className="fa-solid fa-circle-info" style={{ color: "#3b82f6", fontSize: "18px" }} />
                <span style={{ fontSize: "13px", color: "#475569", fontWeight: "500" }}>
                  Please contact the <strong>Cruise Operations Director</strong> or your department manager to assign your account to an upcoming or active voyage.
                </span>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon-container">
              <i className="fa-solid fa-right-from-bracket" />
            </div>
            <div className="logout-modal-body">
              <h2>Confirm Logout</h2>
              <p>Are you sure you want to end your session? You will need to log back in to access your dashboard.</p>
            </div>
            <div className="logout-modal-footer">
              <button className="logout-modal-btn cancel" onClick={() => setShowLogoutModal(false)}>
                Cancel
              </button>
              <button
                className="logout-modal-btn confirm"
                onClick={() => {
                  setShowLogoutModal(false);
                  setLoading(true);
                  setTimeout(() => {
                    localStorage.removeItem("user");
                    localStorage.removeItem("token");
                    navigate("/");
                  }, 1500);
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingScreen visible={loading} />
    </div>
  );
}
