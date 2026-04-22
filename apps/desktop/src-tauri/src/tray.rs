//! System tray icon + menu. Entry points that call the sidecar via HTTP
//! live in `dialog.rs`; this module only wires menu events.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use crate::dialog;

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Loom", true, None::<&str>)?;
    let add_project =
        MenuItem::with_id(app, "add_project", "Add Project…", true, None::<&str>)?;
    let change_usk = MenuItem::with_id(
        app,
        "change_user_skills_dir",
        "Change user skills dir…",
        true,
        None::<&str>,
    )?;
    let sep = PredefinedMenuItem::separator(app)?;
    let about = MenuItem::with_id(app, "about", "About Loom", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[&show, &add_project, &change_usk, &sep, &about, &quit],
    )?;

    TrayIconBuilder::with_id("loom-tray")
        .tooltip("Loom")
        .icon(
            app.default_window_icon()
                .expect("app icon bundled")
                .clone(),
        )
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let app_handle = app.clone();
            match event.id.as_ref() {
                "show" => reveal_window(&app_handle),
                "add_project" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = dialog::add_project(&a).await {
                            log::warn!("add_project failed: {e:?}");
                        }
                    });
                }
                "change_user_skills_dir" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = dialog::change_user_skills_dir(&a).await {
                            log::warn!("change_user_skills_dir failed: {e:?}");
                        }
                    });
                }
                "about" => {
                    let a = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = dialog::show_about(&a).await {
                            log::warn!("show_about failed: {e:?}");
                        }
                    });
                }
                "quit" => app_handle.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn reveal_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        w.show().ok();
        w.set_focus().ok();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let visible = w.is_visible().unwrap_or(false);
        if visible {
            w.hide().ok();
        } else {
            w.show().ok();
            w.set_focus().ok();
        }
    }
}
