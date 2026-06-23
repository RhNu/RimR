pub use rimr_bindings::app_config::*;

use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ConfigFileError {
    #[error("failed to read config {path}: {source}")]
    Read {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to parse config {path}: {source}")]
    Parse {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error("failed to write config {path}: {source}")]
    Write {
        path: PathBuf,
        source: std::io::Error,
    },
    #[error("failed to serialize config: {0}")]
    Serialize(serde_json::Error),
}

pub fn load_config_from_file(path: &Path) -> Result<AppConfig, ConfigFileError> {
    tracing::debug!(path = ?path, "loading app config");
    if !path.exists() {
        tracing::debug!(path = ?path, "app config not found, using defaults");
        return Ok(AppConfig::default());
    }
    let bytes = std::fs::read(path).map_err(|source| ConfigFileError::Read {
        path: path.to_path_buf(),
        source,
    })?;

    let bytes = migrate_config_bytes(path, bytes)?;

    serde_json::from_slice(&bytes).map_err(|source| ConfigFileError::Parse {
        path: path.to_path_buf(),
        source,
    })
}

fn migrate_config_bytes(path: &Path, bytes: Vec<u8>) -> Result<Vec<u8>, ConfigFileError> {
    let mut value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|source| ConfigFileError::Parse {
            path: path.to_path_buf(),
            source,
        })?;

    let needs_migration = value
        .get("formatVersion")
        .and_then(|v| v.as_u64())
        .is_some_and(|v| v < 4);

    if !needs_migration {
        return Ok(bytes);
    }

    let Some(paths) = value.get_mut("paths") else {
        return Ok(bytes);
    };
    let Some(paths_obj) = paths.as_object_mut() else {
        return Ok(bytes);
    };

    if paths_obj.contains_key("gameDataDir") {
        return serde_json::to_vec(&value).map_err(ConfigFileError::Serialize);
    }

    if let Some(config_dir) = paths_obj.get("configDir").and_then(|v| v.as_str())
        && let Some(parent) = std::path::Path::new(config_dir).parent()
    {
        let parent_str = parent.to_string_lossy().into_owned();
        tracing::info!(
            config_dir = config_dir,
            game_data_dir = %parent_str,
            "migrating configDir to gameDataDir (v3 → v4)"
        );
        paths_obj.insert(
            "gameDataDir".to_string(),
            serde_json::Value::String(parent_str),
        );
    }

    if let Some(obj) = value.as_object_mut() {
        obj.insert("formatVersion".to_string(), serde_json::json!(4));
    }

    serde_json::to_vec(&value).map_err(ConfigFileError::Serialize)
}

pub fn save_config_to_file(path: &Path, config: &AppConfig) -> Result<(), ConfigFileError> {
    tracing::debug!(path = ?path, "saving app config");
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|source| ConfigFileError::Write {
            path: parent.to_path_buf(),
            source,
        })?;
    }
    let bytes = serde_json::to_vec_pretty(config).map_err(ConfigFileError::Serialize)?;
    std::fs::write(path, bytes).map_err(|source| ConfigFileError::Write {
        path: path.to_path_buf(),
        source,
    })
}

pub fn default_config_path() -> Option<PathBuf> {
    directories::ProjectDirs::from("dev", "rimr", "RimR")
        .map(|dirs| dirs.config_dir().join("config.json"))
}
