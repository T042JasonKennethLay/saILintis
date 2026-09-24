use tauri::Manager;
use base64::{engine::general_purpose, Engine as _};

#[tauri::command]
pub async fn get_default_download_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().download_dir()
        .map_err(|e| format!("Failed to get download directory: {}", e))?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn select_directory(default_dir: Option<String>) -> Result<Option<String>, String> {
    let path_opt = tokio::task::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new();
        if let Some(ref dir) = default_dir {
            dialog = dialog.set_directory(dir);
        }
        dialog.pick_folder()
    }).await.map_err(|e| format!("Thread join error: {}", e))?;

    Ok(path_opt.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn save_file_to_directory(
    directory: String,
    filename: String,
    base64_content: String,
) -> Result<String, String> {
    let bytes = general_purpose::STANDARD.decode(&base64_content)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;

    let dir_path = std::path::PathBuf::from(&directory);
    if !dir_path.exists() {
        std::fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let safe_filename = filename.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    let file_path = dir_path.join(safe_filename);
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(file_path.to_string_lossy().into_owned())
}
