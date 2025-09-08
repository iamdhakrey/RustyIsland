use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use sysinfo::System;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemInfo {
    cpu_usage: f32,
    memory_usage: f64,
    memory_total: u64,
    time: String,
    active_processes: Vec<ProcessInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessInfo {
    name: String,
    cpu_usage: f32,
    memory: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DynamicIslandState {
    mode: String,         // "compact", "expanded", "activity"
    content_type: String, // "system", "music", "notification", "timer"
    data: serde_json::Value,
}

// Global system monitor
static SYSTEM_MONITOR: once_cell::sync::Lazy<Arc<Mutex<System>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(System::new_all())));

// Global expansion state
static EXPANSION_STATE: once_cell::sync::Lazy<Arc<Mutex<bool>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(false)));

#[tauri::command]
async fn get_system_info() -> Result<SystemInfo, String> {
    let mut system = SYSTEM_MONITOR.lock().map_err(|e| e.to_string())?;

    // Refresh system information
    system.refresh_all();

    // Calculate overall CPU usage
    let cpu_usage = system.global_cpu_info().cpu_usage();

    // Get memory information
    let memory_total = system.total_memory();
    let memory_used = system.used_memory();
    let memory_usage = memory_used as f64;

    // Get current time
    let now = chrono::Local::now();
    let time = now.format("%H:%M").to_string();

    // Get top processes by CPU usage
    let mut processes: Vec<_> = system.processes().iter().collect();
    processes.sort_by(|a, b| {
        b.1.cpu_usage()
            .partial_cmp(&a.1.cpu_usage())
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let active_processes: Vec<ProcessInfo> = processes
        .iter()
        .take(5)
        .filter(|(_, process)| process.cpu_usage() > 0.1)
        .map(|(_, process)| ProcessInfo {
            name: process.name().to_string(),
            cpu_usage: process.cpu_usage(),
            memory: process.memory(),
        })
        .collect();

    Ok(SystemInfo {
        cpu_usage,
        memory_usage,
        memory_total,
        time,
        active_processes,
    })
}

#[tauri::command]
async fn set_island_mode(mode: String, content_type: String) -> Result<(), String> {
    // This would typically update some global state or configuration
    println!(
        "Setting island mode to: {} with content: {}",
        mode, content_type
    );
    Ok(())
}

#[tauri::command]
async fn update_window_size(
    width: f64,
    height: f64,
    window: tauri::WebviewWindow,
) -> Result<(), String> {
    // Validate dimensions to prevent GDK errors
    if width <= 0.0 || height <= 0.0 {
        eprintln!("ERROR: Invalid window dimensions: {}x{}", width, height);
        return Err(format!("Invalid window dimensions: {}x{}", width, height));
    }

    println!("Setting window size to: {}x{}", width, height);

    match window.set_size(tauri::Size::Logical(tauri::LogicalSize { width, height })) {
        Ok(_) => {
            println!("Successfully set window size to: {}x{}", width, height);
            Ok(())
        }
        Err(e) => {
            eprintln!("Failed to set window size: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn move_window(x: f64, y: f64, window: tauri::WebviewWindow) -> Result<(), String> {
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn start_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    println!("Starting window drag");
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
async fn ensure_always_on_top(window: tauri::WebviewWindow) -> Result<(), String> {
    println!("Ensuring window stays always on top");
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn toggle_island_expansion() -> Result<bool, String> {
    let mut state = EXPANSION_STATE.lock().map_err(|e| e.to_string())?;
    *state = !*state;
    let new_state = *state;

    println!("Toggled island expansion to: {}", new_state);
    Ok(new_state)
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Handle Ctrl+C
    ctrlc::set_handler(move || {
        println!("Ctrl+C pressed. Exiting app...");
        std::process::exit(0);
    })
    .expect("Error setting Ctrl+C handler");

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_decorations(false)?;
            window.set_always_on_top(true)?;
            window.set_resizable(true)?;
            window.set_skip_taskbar(true)?; // Ensure it doesn't appear in taskbar

            // Additional always-on-top enforcement for Linux/Wayland
            window.set_focus()?; // Give it focus initially

            // Try to set always on top again after a short delay (for Wayland)
            let window_clone = window.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = window_clone.set_always_on_top(true);
                let _ = window_clone.set_focus();
            });

            // Dynamic Island positioning (top center of screen)
            let monitor = window.current_monitor()?.unwrap();
            let monitor_size = monitor.size();
            let scale_factor = monitor.scale_factor();

            println!(
                "Monitor size: {}x{}, scale factor: {}",
                monitor_size.width, monitor_size.height, scale_factor
            );

            // Position the window at the top center, aligned with GNOME top bar
            let window_width = 320.0;
            let window_height = 40.0;

            // Calculate center X position
            let monitor_width = monitor_size.width as f64 / scale_factor;
            let x = (monitor_width - window_width) / 2.0;

            // Position it at the very top (y=0) to align with GNOME top bar
            // The GNOME top bar typically occupies the top ~32-36px of the screen
            let y = 0.0; // Align with very top of screen where GNOME top bar is

            println!("Calculated position: x={}, y={}", x, y);
            println!("Window dimensions: {}x{}", window_width, window_height);

            // Validate dimensions before setting
            if window_width <= 0.0 || window_height <= 0.0 {
                eprintln!(
                    "ERROR: Invalid window dimensions in setup: {}x{}",
                    window_width, window_height
                );
                return Err("Invalid window dimensions".into());
            }

            // Set size first
            match window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: window_width,
                height: window_height,
            })) {
                Ok(_) => println!(
                    "Successfully set window size in setup: {}x{}",
                    window_width, window_height
                ),
                Err(e) => {
                    eprintln!("Failed to set window size in setup: {}", e);
                    return Err(e.into());
                }
            }

            // Then set position - ensure it's at the top
            window.set_position(tauri::Position::Logical(tauri::LogicalPosition { x, y }))?;

            println!(
                "Window positioned at: x={}, y={} (monitor: {}x{})",
                x,
                y,
                monitor_width,
                monitor_size.height as f64 / scale_factor
            );

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            close_app,
            get_system_info,
            set_island_mode,
            toggle_island_expansion,
            update_window_size,
            move_window,
            start_drag,
            ensure_always_on_top
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn close_app(app: tauri::AppHandle) {
    app.exit(0);
}
