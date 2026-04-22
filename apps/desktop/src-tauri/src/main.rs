#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod dialog;
mod sidecar;
mod tray;

use sidecar::Sidecar;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            log::info!("Loom desktop starting");
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Resolve the bundled web SPA shipped as a Tauri resource
                // (see `bundle.resources` in tauri.conf.json). The sidecar
                // reads this path from LOOM_WEB_DIST and serves index.html
                // + assets from there (see packages/server/src/utils/static.ts).
                let web_dist = match handle.path().resource_dir() {
                    Ok(dir) => dir.join("web-dist"),
                    Err(e) => {
                        log::error!("resource_dir lookup failed: {e:?}");
                        dialog::show_fatal(
                            &handle,
                            &format!("Failed to locate bundled web assets:\n\n{e}"),
                        );
                        return;
                    }
                };
                let web_dist_str = web_dist.to_string_lossy().into_owned();
                log::info!("LOOM_WEB_DIST = {web_dist_str}");

                match Sidecar::spawn(&handle, &web_dist_str).await {
                    Ok(sc) => {
                        let url = sc.url();
                        handle.manage(sc);

                        if let Some(window) = handle.get_webview_window("main") {
                            match url.parse() {
                                Ok(u) => {
                                    if let Err(e) = window.navigate(u) {
                                        log::error!("webview navigate failed: {e}");
                                    }
                                }
                                Err(e) => log::error!("sidecar url parse failed: {e}"),
                            }
                            window.show().ok();
                        }

                        if let Err(e) = tray::install(&handle) {
                            // Tray failure is non-fatal: the user can still
                            // use the app via the window, just without the
                            // tray menu entry points.
                            log::error!("tray install failed: {e:?}");
                        }
                    }
                    Err(e) => {
                        log::error!("sidecar startup failed: {e:?}");
                        dialog::show_fatal(
                            &handle,
                            &format!("Failed to start Loom server:\n\n{e}"),
                        );
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri app");
}
