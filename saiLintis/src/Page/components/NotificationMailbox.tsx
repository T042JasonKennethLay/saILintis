import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../NotificationMailbox.css";

interface NotificationItem {
  alert_id: string;
  message: string;
  sent_at: string;
  recipients: string;
  is_read: boolean;
}

interface ChatNotifItem {
  alert_id: string;
  message: string;
  sent_at: string;
  recipients: string;
  is_read: boolean;
  is_chat: true;
}

type AnyNotifItem = NotificationItem | ChatNotifItem;

interface Props {
  recipientRole: string;
}

export function NotificationMailbox({ recipientRole }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AnyNotifItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const isPassenger = recipientRole === "Passenger";
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const passengerId = user.passenger_id || user.user_id || "";

  const unreadCount = items.filter((n) => !n.is_read).length;

  const fetchAll = async () => {
    try {
      const zone = await invoke<NotificationItem[]>("get_notifications", {
        recipientRole,
      });

      let chatItems: ChatNotifItem[] = [];
      if (isPassenger && passengerId) {
        const count = await invoke<number>("get_chat_unread_count", {
          passengerId,
        });
        if (count > 0) {
          chatItems = [
            {
              alert_id: "chat-unread-summary",
              message: `You have ${count} unread message${count === 1 ? "" : "s"} from the Front Desk.`,
              sent_at: new Date().toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              recipients: "Passenger",
              is_read: false,
              is_chat: true,
            },
          ];
        }
      }

      const merged: AnyNotifItem[] = [...chatItems, ...zone];
      setItems(merged);
    } catch (_) {
      setItems([]);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [recipientRole, passengerId]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const handleMarkRead = async (item: AnyNotifItem) => {
    if ((item as ChatNotifItem).is_chat) {
      if (passengerId) {
        try {
          await invoke("mark_fdo_messages_read", { passengerId });
        } catch (_) {}
      }
      setItems((prev) =>
        prev.filter((n) => n.alert_id !== "chat-unread-summary")
      );
      return;
    }
    try {
      await invoke("mark_notification_read", { alertId: item.alert_id });
      setItems((prev) =>
        prev.map((n) =>
          n.alert_id === item.alert_id ? { ...n, is_read: true } : n
        )
      );
    } catch (_) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await invoke("mark_all_notifications_read", { recipientRole });
      if (isPassenger && passengerId) {
        await invoke("mark_fdo_messages_read", { passengerId });
      }
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })).filter(n => !(n as ChatNotifItem).is_chat || n.is_read));
    } catch (_) {}
  };

  return (
    <div className="nmb-root" ref={ref}>
      <button
        id="notif-mailbox-btn"
        className="nmb-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
      >
        <i className="fa-solid fa-inbox" />
        {unreadCount > 0 && (
          <span className="nmb-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="nmb-panel">
          <div className="nmb-panel-header">
            <span className="nmb-panel-title">
              <i className="fa-solid fa-inbox" /> Notifications
            </span>
            {unreadCount > 0 && (
              <button className="nmb-mark-all-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="nmb-list">
            {items.length === 0 ? (
              <div className="nmb-empty">
                <i className="fa-solid fa-check-circle" />
                <span>No notifications</span>
              </div>
            ) : (
              items.map((n) => {
                const isChat = !!(n as ChatNotifItem).is_chat;
                return (
                  <div
                    key={n.alert_id}
                    id={`notif-item-${n.alert_id}`}
                    className={`nmb-item ${n.is_read ? "nmb-read" : "nmb-unread"}`}
                    onClick={() => !n.is_read && handleMarkRead(n)}
                  >
                    <div className="nmb-item-dot-col">
                      {!n.is_read && <span className="nmb-dot" />}
                    </div>
                    <div className="nmb-item-body">
                      {isChat && (
                        <span className="nmb-chat-tag">
                          <i className="fa-solid fa-comments" /> Chat
                        </span>
                      )}
                      <p className="nmb-item-msg">{n.message}</p>
                      <span className="nmb-item-meta">
                        {n.recipients} · {n.sent_at}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
