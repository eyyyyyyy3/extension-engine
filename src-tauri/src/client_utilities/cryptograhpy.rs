#[tauri::command]
pub fn blake3(data: Vec<u8>) -> [u8; 32] {
    blake3::hash(&data).as_bytes().to_owned()
}
