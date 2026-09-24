interface NotificationsListProps {
  announcementsList: any[];
}

export function NotificationsList({ announcementsList }: NotificationsListProps) {
  return (
    <div className="ps-dashboard-container">
      <div className="ps-title-section">
        <h1 className="hp-title-giant">Ship Announcements</h1>
        <p className="hp-subtitle-clean">Important announcements and broadcasts from the captain or cruise ship crew.</p>
      </div>

      <div className="ps-notification-list">
        {announcementsList.map((announcement) => (
          <div key={announcement.id} className="ps-notification-card">
            <div className="ps-notification-icon">
              <i className="fa fa-bullhorn" />
            </div>
            <div className="ps-notification-content-block">
              <span className="ps-notification-title">{announcement.title}</span>
              <p className="ps-notification-body">{announcement.content}</p>
              <span className="ps-notification-time">{new Date(announcement.date).toLocaleString()}</span>
            </div>
          </div>
        ))}
        {announcementsList.length === 0 && (
          <p className="ps-text-muted-medium">No new announcements from the ship crew.</p>
        )}
      </div>
    </div>
  );
}
