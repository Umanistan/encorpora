// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() {
    corpus_reader_lib::run();
    // tauri::Builder::default()
    //     .plugin(tauri_plugin_log::Builder::new().build())
    //     .plugin(tauri_plugin_sql::Builder::new().build())
    //     .plugin(tauri_plugin_fs::init())
    //     .plugin(tauri_plugin_store::Builder::new().build())
    //     .plugin(tauri_plugin_dialog::init())
    //     .run(tauri::generate_context!())
    //     .expect("error while running tauri application");
}
