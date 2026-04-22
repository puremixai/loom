//! Native dialog entry points invoked from the tray menu. Each picks a
//! directory via the OS dialog, then calls the sidecar's REST API to
//! mutate state, then navigates the WebView so the user sees the effect.

use anyhow::{anyhow, Result};
use serde_json::json;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

use crate::sidecar::Sidecar;

pub async fn add_project(app: &AppHandle) -> Result<()> {
    let sidecar_url = app.state::<Sidecar>().url();

    let Some(folder) = app.dialog().file().blocking_pick_folder() else {
        // user cancelled
        return Ok(());
    };
    let path = folder.to_string();

    let endpoint = format!("{sidecar_url}/api/projects");
    let resp = reqwest::Client::new()
        .post(&endpoint)
        .json(&json!({ "path": path }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        app.dialog()
            .message(format!("Add Project failed:\n{body}"))
            .kind(MessageDialogKind::Error)
            .blocking_show();
        return Err(anyhow!("add project request failed"));
    }

    navigate_to(app, &format!("{sidecar_url}/"))
}

pub async fn change_user_skills_dir(app: &AppHandle) -> Result<()> {
    let sidecar_url = app.state::<Sidecar>().url();

    let Some(folder) = app.dialog().file().blocking_pick_folder() else {
        return Ok(());
    };
    let path = folder.to_string();

    let endpoint = format!("{sidecar_url}/api/settings");
    let resp = reqwest::Client::new()
        .put(&endpoint)
        .json(&json!({ "userSkillsDir": path }))
        .send()
        .await?;

    if !resp.status().is_success() {
        let body = resp.text().await.unwrap_or_default();
        app.dialog()
            .message(format!("Change user skills directory failed:\n{body}"))
            .kind(MessageDialogKind::Error)
            .blocking_show();
        return Err(anyhow!("settings request failed"));
    }

    navigate_to(app, &format!("{sidecar_url}/settings"))
}

pub async fn show_about(app: &AppHandle) -> Result<()> {
    app.dialog()
        .message(format!(
            "Loom v{}\n\nWeave Claude Code skills into every project.\n\nhttps://github.com/puremixai/loom",
            env!("CARGO_PKG_VERSION")
        ))
        .kind(MessageDialogKind::Info)
        .blocking_show();
    Ok(())
}

/// Navigate the main WebView to the given URL (no-op if window is gone).
fn navigate_to(app: &AppHandle, url: &str) -> Result<()> {
    let parsed = url.parse().map_err(|e| anyhow!("url parse: {e}"))?;
    if let Some(w) = app.get_webview_window("main") {
        w.navigate(parsed).map_err(|e| anyhow!("navigate: {e}"))?;
        w.show().ok();
        w.set_focus().ok();
    }
    Ok(())
}

/// Show a fatal error dialog then exit. Used by startup failures.
pub fn show_fatal(app: &AppHandle, msg: &str) {
    app.dialog()
        .message(msg)
        .kind(MessageDialogKind::Error)
        .blocking_show();
    app.exit(1);
}
