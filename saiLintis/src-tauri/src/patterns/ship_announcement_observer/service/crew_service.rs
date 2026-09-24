use crate::patterns::ship_announcement_observer::ISubscribers::Subscriber;

#[allow(dead_code)]
pub struct CrewSubscriber {
    name: String,
}

impl CrewSubscriber {
    #[allow(dead_code)]
    pub fn new(name: &str) -> Self {
        Self {
            name: name.to_string(),
        }
    }
}

impl Subscriber for CrewSubscriber {
    fn update(&self, announcement: &str) {
        println!("Crew member {} received announcement: {}", self.name, announcement);
    }

    fn get_id(&self) -> String {
        self.name.clone()
    }
}
