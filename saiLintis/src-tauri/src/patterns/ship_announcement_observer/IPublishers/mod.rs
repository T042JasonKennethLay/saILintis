use crate::patterns::ship_announcement_observer::ISubscribers::Subscriber;

#[allow(dead_code)]
pub trait Publisher {
    fn subscribe(&mut self, sub: Box<dyn Subscriber>);
    fn unsubscribe(&mut self, id: &str);
    fn notify(&self, announcement: &str);
}
