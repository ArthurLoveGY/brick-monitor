use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutostartStatus {
    pub enabled: bool,
    pub plist_path: String,
    pub executable_path: String,
}

pub fn get_status(identifier: &str, executable_path: &Path) -> AppResult<AutostartStatus> {
    let plist_path = plist_path(identifier)?;
    Ok(AutostartStatus {
        enabled: plist_path.exists(),
        plist_path: plist_path.display().to_string(),
        executable_path: executable_path.display().to_string(),
    })
}

pub fn set_enabled(identifier: &str, executable_path: &Path, enabled: bool) -> AppResult<AutostartStatus> {
    let plist_path = plist_path(identifier)?;

    if enabled {
        let plist_contents = launch_agent_plist(identifier, executable_path);
        let parent = plist_path.parent().ok_or_else(|| {
            AppError::new(
                "AUTOSTART_PATH_INVALID",
                format!("无法解析 LaunchAgent 目录: {}", plist_path.display()),
            )
        })?;

        fs::create_dir_all(parent).map_err(|error| {
            AppError::new(
                "AUTOSTART_CREATE_DIR_FAILED",
                format!("创建 LaunchAgent 目录失败: {error}"),
            )
        })?;

        fs::write(&plist_path, plist_contents).map_err(|error| {
            AppError::new(
                "AUTOSTART_WRITE_FAILED",
                format!("写入 LaunchAgent 文件失败: {error}"),
            )
        })?;
    } else if plist_path.exists() {
        fs::remove_file(&plist_path).map_err(|error| {
            AppError::new(
                "AUTOSTART_REMOVE_FAILED",
                format!("删除 LaunchAgent 文件失败: {error}"),
            )
        })?;
    }

    get_status(identifier, executable_path)
}

fn plist_path(identifier: &str) -> AppResult<PathBuf> {
    let home_dir = dirs::home_dir().ok_or_else(|| {
        AppError::new("HOME_DIR_NOT_FOUND", "无法解析当前用户目录，无法配置登录启动")
    })?;

    Ok(home_dir
        .join("Library")
        .join("LaunchAgents")
        .join(format!("{identifier}.plist")))
}

fn launch_agent_plist(identifier: &str, executable_path: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{identifier}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{executable}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>ProcessType</key>
  <string>Interactive</string>
</dict>
</plist>
"#,
        identifier = identifier,
        executable = executable_path.display(),
    )
}

#[cfg(test)]
mod tests {
    use super::launch_agent_plist;
    use std::path::Path;

    #[test]
    fn launch_agent_contains_identifier_and_executable() {
        let plist = launch_agent_plist("com.example.test", Path::new("/Applications/Test.app/Contents/MacOS/Test"));
        assert!(plist.contains("com.example.test"));
        assert!(plist.contains("/Applications/Test.app/Contents/MacOS/Test"));
        assert!(plist.contains("<key>RunAtLoad</key>"));
    }
}
