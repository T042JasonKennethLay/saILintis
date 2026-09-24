use lettre::{
    transport::smtp::authentication::Credentials,AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};

pub async fn send_reset_email(to_email : &str, new_password : &str) -> Result<(),String>{
    dotenvy::dotenv().ok();

    let smtp_email = std::env::var("SMTP_EMAIL").map_err(|_| "SMTP_EMAIL is not set".to_string())?;
    let smtp_password = std::env::var("SMTP_PASSWORD").map_err(|_| "SMTP_PASSWORD is not set".to_string())?;

    let email=Message::builder().from(smtp_email.parse().map_err(|e: lettre::address::AddressError| e.to_string())?).to(to_email.parse().map_err(|e: lettre::address::AddressError| e.to_string())?).subject("Reset Password Request").body(format!(
        "Here's Your New Password : \n\n{}\n\n",new_password
    )).map_err(|e| e.to_string())?;

    let creds = Credentials::new(smtp_email,smtp_password);
    let mailer=AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com").map_err(|e| e.to_string())?.credentials(creds).build();

    mailer.send(email).await.map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn send_welcome_email(to_email: &str, username: &str, password: &str) -> Result<(), String> {
    dotenvy::dotenv().ok();

    let smtp_email = std::env::var("SMTP_EMAIL").map_err(|_| "SMTP_EMAIL is not set".to_string())?;
    let smtp_password = std::env::var("SMTP_PASSWORD").map_err(|_| "SMTP_PASSWORD is not set".to_string())?;

    let email = Message::builder().from(smtp_email.parse().map_err(|e: lettre::address::AddressError| e.to_string())?).to(to_email.parse().map_err(|e: lettre::address::AddressError| e.to_string())?).subject("Congrats on Joining!").body(format!(
        "Congrats on joining, {}!\n\nHere is your password: {}\n\n",
        username, password
    )).map_err(|e| e.to_string())?;

    let creds = Credentials::new(smtp_email, smtp_password);
    let mailer = AsyncSmtpTransport::<Tokio1Executor>::relay("smtp.gmail.com").map_err(|e| e.to_string())?.credentials(creds).build();

    mailer.send(email).await.map_err(|e| e.to_string())?;
    Ok(())
}
