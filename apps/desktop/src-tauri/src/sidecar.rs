//! Sidecar lifecycle management.
//!
//! Spawns the packaged `loom-server` exe (produced by scripts/build-sidecar.mjs)
//! on an OS-picked port, waits for its "running at http://..." stdout signal,
//! exposes the final URL to the Tauri app, and provides a clean shutdown path.

use std::net::TcpListener;
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, bail, Context, Result};
use tauri::AppHandle;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;
use tokio::time::timeout;

/// Running sidecar process + metadata needed to talk to it.
pub struct Sidecar {
    port: u16,
    child: Arc<Mutex<Option<CommandChild>>>,
}

impl Sidecar {
    /// Pick an OS-assigned free port on 127.0.0.1.
    ///
    /// Small race window between the listener drop and the sidecar's
    /// bind — acceptable for a local-only dev tool; retrying on the
    /// unhappy path is more complex than the risk warrants.
    fn pick_port() -> Result<u16> {
        let listener =
            TcpListener::bind("127.0.0.1:0").context("pick_port: bind 127.0.0.1:0")?;
        let port = listener
            .local_addr()
            .context("pick_port: local_addr")?
            .port();
        drop(listener);
        Ok(port)
    }

    /// Spawn `loom-server` as a sidecar. Blocks until it prints the
    /// expected "running at" marker or the timeout fires.
    ///
    /// `web_dist` is the absolute path to the packaged web SPA folder
    /// (typically Tauri's resolved resource path). The sidecar reads
    /// it via the `LOOM_WEB_DIST` env var and serves index.html + assets
    /// from there.
    pub async fn spawn(app: &AppHandle, web_dist: &str) -> Result<Self> {
        let port = Self::pick_port()?;
        log::info!("sidecar: picked port {port}, spawning loom-server");

        let command = app
            .shell()
            .sidecar("loom-server")
            .context("sidecar binary not bundled with Tauri app")?
            .env("PORT", port.to_string())
            .env("NO_OPEN", "1")
            .env("LOOM_RUNTIME", "tauri-desktop")
            .env("LOOM_WEB_DIST", web_dist);

        let (mut rx, child) = command.spawn().context("failed to spawn sidecar")?;

        let ready_port = timeout(Duration::from_secs(15), wait_for_ready(&mut rx))
            .await
            .map_err(|_| anyhow!("sidecar did not signal ready within 15s"))??;

        if ready_port != port {
            bail!(
                "sidecar bound an unexpected port: assigned {port}, got {ready_port}"
            );
        }
        log::info!("sidecar: ready on http://127.0.0.1:{port}");

        // Spawn a background task to drain remaining stdout/stderr
        // (so the sidecar isn't blocked on pipe backpressure).
        let drain_child = Arc::new(Mutex::new(Some(child)));
        let drain_handle = drain_child.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::debug!(
                            "sidecar stdout: {}",
                            String::from_utf8_lossy(&line).trim_end()
                        );
                    }
                    CommandEvent::Stderr(line) => {
                        log::warn!(
                            "sidecar stderr: {}",
                            String::from_utf8_lossy(&line).trim_end()
                        );
                    }
                    CommandEvent::Terminated(payload) => {
                        log::warn!("sidecar terminated: {:?}", payload);
                        // Clear the child handle so shutdown() becomes a no-op.
                        drain_handle.lock().await.take();
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(Self {
            port,
            child: drain_child,
        })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }

    /// Kill the sidecar process. Idempotent — safe to call multiple times.
    pub async fn shutdown(&self) -> Result<()> {
        if let Some(child) = self.child.lock().await.take() {
            log::info!("sidecar: shutting down");
            child.kill().context("sidecar kill")?;
        }
        Ok(())
    }
}

/// Pull the "running at http://127.0.0.1:PORT" marker out of the
/// sidecar's stdout stream. Returns the port number.
async fn wait_for_ready(
    rx: &mut tokio::sync::mpsc::Receiver<CommandEvent>,
) -> Result<u16> {
    let re = regex::Regex::new(r"running at http://127\.0\.0\.1:(\d+)")
        .expect("static regex");
    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                let text = String::from_utf8_lossy(&line);
                log::debug!("sidecar startup: {}", text.trim_end());
                if let Some(cap) = re.captures(&text) {
                    let port: u16 = cap
                        .get(1)
                        .ok_or_else(|| anyhow!("missing port capture"))?
                        .as_str()
                        .parse()
                        .context("parse port")?;
                    return Ok(port);
                }
            }
            CommandEvent::Stderr(line) => {
                log::warn!("sidecar stderr: {}", String::from_utf8_lossy(&line).trim_end());
            }
            CommandEvent::Terminated(payload) => {
                bail!("sidecar exited during startup: {:?}", payload);
            }
            CommandEvent::Error(err) => {
                bail!("sidecar startup error: {err}");
            }
            _ => {}
        }
    }
    bail!("sidecar stdout closed before ready signal")
}
