use serde::Serialize;
use tauri::State;
use std::sync::Mutex;
use crate::database::Database;

/// 心跳数据统计
#[derive(Debug, Clone, Serialize)]
pub struct HeartbeatData {
    /// Code 按键数 (IDE + Terminal)
    pub code_keystrokes: u64,
    /// Talk 按键数 (Chat 应用)
    pub talk_keystrokes: u64,
    /// 其他应用按键数
    pub other_keystrokes: u64,
    /// Code 比例 (0-100)
    pub code_ratio: f32,
    /// Talk 比例 (0-100)
    pub talk_ratio: f32,
    /// 当前状态
    pub status: WorkStatus,
    /// 心跳频率 (BPM) - 编码时快，摸鱼时慢
    pub heartbeat_bpm: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum WorkStatus {
    /// 编码中
    Coding,
    /// 聊天中
    Talking,
    /// 摸鱼中
    Idle,
    /// 平衡状态
    Balanced,
}

impl HeartbeatData {
    /// 从数据库统计生成心跳数据
    pub fn from_stats(code: i64, talk: i64, other: i64) -> Self {
        let total = code + talk + other;
        let code_ratio = if total > 0 { (code as f32 / total as f32) * 100.0 } else { 0.0 };
        let talk_ratio = if total > 0 { (talk as f32 / total as f32) * 100.0 } else { 0.0 };

        // 判断状态
        let status = if code_ratio > 60.0 {
            WorkStatus::Coding
        } else if talk_ratio > 40.0 {
            WorkStatus::Talking
        } else if total == 0 {
            WorkStatus::Idle
        } else {
            WorkStatus::Balanced
        };

        // 计算心跳频率：编码时 80-120，摸鱼时 40-60
        let heartbeat_bpm = match status {
            WorkStatus::Coding => 80 + ((code_ratio - 60.0) * 0.5) as u32,
            WorkStatus::Talking => 60 + ((talk_ratio - 20.0) * 0.3) as u32,
            WorkStatus::Idle => 40,
            WorkStatus::Balanced => 70,
        };

        Self {
            code_keystrokes: code as u64,
            talk_keystrokes: talk as u64,
            other_keystrokes: other as u64,
            code_ratio,
            talk_ratio,
            status,
            heartbeat_bpm: heartbeat_bpm.min(120),
        }
    }
}

/// Tauri 命令：获取心跳数据
#[tauri::command]
pub fn get_heartbeat_data(db: State<'_, Mutex<Database>>) -> Result<HeartbeatData, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    let stats = db.get_category_stats_today().map_err(|e| e.to_string())?;

    Ok(HeartbeatData::from_stats(
        stats.ide_count + stats.terminal_count,
        stats.chat_count,
        stats.other_count,
    ))
}
