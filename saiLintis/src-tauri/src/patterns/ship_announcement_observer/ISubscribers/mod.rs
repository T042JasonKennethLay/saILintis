#[allow(dead_code)]
pub trait Subscriber {
    fn update(&self, announcement: &str);
    fn get_id(&self) -> String;
}
