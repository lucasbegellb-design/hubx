//! Hub XTIM — hôte desktop Tauri : zone de notification, fermeture = réduction, instance unique,
//! fenêtre de capture rapide, démarrage automatique, mises à jour.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent,
};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};

const FENETRE_PRINCIPALE: &str = "main";
const FENETRE_CAPTURE: &str = "capture";

/// Démarrage avec `--minimized` (démarrage automatique) : la fenêtre reste dans la zone de notification.
static DEMARRAGE_REDUIT: AtomicBool = AtomicBool::new(false);
/// L'interface a signalé son premier affichage (évite le flash blanc au lancement).
static INTERFACE_PRETE: AtomicBool = AtomicBool::new(false);

/// Windows : WebView2 libère un maximum de mémoire quand la fenêtre est cachée
/// (l'application vit surtout dans la zone de notification), sans suspendre les rappels.
#[cfg(windows)]
fn regler_memoire(fenetre: &tauri::WebviewWindow, reduite: bool) {
    let _ = fenetre.with_webview(move |webview| {
        use webview2_com::Microsoft::Web::WebView2::Win32::{
            ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
            COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
        };
        use windows::core::Interface;
        unsafe {
            if let Ok(coeur) = webview.controller().CoreWebView2() {
                if let Ok(coeur19) = coeur.cast::<ICoreWebView2_19>() {
                    let _ = coeur19.SetMemoryUsageTargetLevel(if reduite {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW
                    } else {
                        COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL
                    });
                }
            }
        }
    });
}

#[cfg(not(windows))]
fn regler_memoire(_fenetre: &tauri::WebviewWindow, _reduite: bool) {}

fn montrer_principale_impl(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(FENETRE_PRINCIPALE) {
        regler_memoire(&w, false);
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn masquer_principale(fenetre: &tauri::WebviewWindow) {
    let _ = fenetre.hide();
    regler_memoire(fenetre, true);
}

/// Appelé par l'interface après son premier rendu : affiche la fenêtre principale
/// (sauf démarrage réduit dans la zone de notification).
#[tauri::command]
fn interface_prete(app: AppHandle) {
    if INTERFACE_PRETE.swap(true, Ordering::SeqCst) {
        return;
    }
    if !DEMARRAGE_REDUIT.load(Ordering::SeqCst) {
        montrer_principale_impl(&app);
    }
}

fn ouvrir_capture_impl(app: &AppHandle) -> tauri::Result<()> {
    if let Some(w) = app.get_webview_window(FENETRE_CAPTURE) {
        w.show()?;
        w.set_focus()?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, FENETRE_CAPTURE, WebviewUrl::App("index.html#/capture".into()))
        .title("Capture rapide — Hub XTIM")
        .inner_size(720.0, 184.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .center()
        .focused(true)
        .visible(false)
        .build()?;
    Ok(())
}

/// Affiche la fenêtre principale (depuis la capture ou une notification).
#[tauri::command]
fn montrer_principale(app: AppHandle) {
    montrer_principale_impl(&app);
}

/// Ouvre la petite fenêtre de capture (raccourci global ou menu de la zone de notification).
#[tauri::command]
fn ouvrir_capture(app: AppHandle) -> Result<(), String> {
    ouvrir_capture_impl(&app).map_err(|e| e.to_string())
}

fn quitter(app: &AppHandle) {
    let _ = app.save_window_state(StateFlags::all());
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Doit être enregistré en premier : une seconde instance ré-affiche la première.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            montrer_principale_impl(app);
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .with_denylist(&[FENETRE_CAPTURE])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![montrer_principale, ouvrir_capture, interface_prete])
        .setup(|app| {
            // Zone de notification
            let ouvrir = MenuItem::with_id(app, "ouvrir", "Ouvrir Hub XTIM", true, None::<&str>)?;
            let capture = MenuItem::with_id(app, "capture", "Capture rapide", true, None::<&str>)?;
            let separateur = PredefinedMenuItem::separator(app)?;
            let quitter_item = MenuItem::with_id(app, "quitter", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&ouvrir, &capture, &separateur, &quitter_item])?;

            let mut tray = TrayIconBuilder::with_id("hubx")
                .tooltip("Hub XTIM")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "ouvrir" => montrer_principale_impl(app),
                    "capture" => {
                        let _ = ouvrir_capture_impl(app);
                    }
                    "quitter" => quitter(app),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        montrer_principale_impl(tray.app_handle());
                    }
                });
            if let Some(icone) = app.default_window_icon() {
                tray = tray.icon(icone.clone());
            }
            tray.build(app)?;

            // Démarrage automatique : l'app démarre réduite dans la zone de notification.
            let reduite = std::env::args().any(|a| a == "--minimized");
            DEMARRAGE_REDUIT.store(reduite, Ordering::SeqCst);
            if let Some(w) = app.get_webview_window(FENETRE_PRINCIPALE) {
                if reduite {
                    regler_memoire(&w, true);
                }
            }
            // Filet de sécurité : si l'interface ne s'est pas signalée (erreur), la fenêtre s'affiche quand même.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(5));
                if !INTERFACE_PRETE.load(Ordering::SeqCst) && !DEMARRAGE_REDUIT.load(Ordering::SeqCst) {
                    montrer_principale_impl(&handle);
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fermer la fenêtre principale = la réduire dans la zone de notification.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == FENETRE_PRINCIPALE {
                    api.prevent_close();
                    let _ = window.app_handle().save_window_state(StateFlags::all());
                    if let Some(w) = window.app_handle().get_webview_window(FENETRE_PRINCIPALE) {
                        masquer_principale(&w);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Hub XTIM");
}
