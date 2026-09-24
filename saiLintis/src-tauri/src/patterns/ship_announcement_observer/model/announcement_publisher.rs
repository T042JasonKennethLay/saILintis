use crate::patterns::ship_announcement_observer::IPublishers::Publisher;
use crate::patterns::ship_announcement_observer::ISubscribers::Subscriber;

pub struct AnnouncementPublisher {
    subscribers: Vec<Box<dyn Subscriber>>,
}

impl AnnouncementPublisher {
    pub fn new() -> Self {
        Self {
            subscribers: Vec::new(),
        }
    }

    pub fn publish(&self, announcement: &str) {
        println!("Publishing announcement: {}", announcement);
        self.notify(announcement);
    }
}

impl Publisher for AnnouncementPublisher {
    fn subscribe(&mut self, sub: Box<dyn Subscriber>) {
        self.subscribers.push(sub);
    }

    fn unsubscribe(&mut self, id: &str) {
        if let Some(pos) = self.subscribers.iter().position(|x| x.get_id() == id) {
            self.subscribers.remove(pos);
        }
    }

    fn notify(&self, announcement: &str) {
        for sub in &self.subscribers {
            sub.update(announcement);
        }
    }
}
