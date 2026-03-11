use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub enum KeyType {
    Char,        // 字符键: a-z, 0-9, 符号
    Function,    // 功能键: F1-F12
    Modifier,    // 修饰键: Ctrl, Alt, Shift, Cmd
    Navigation,  // 导航键: 方向键, Home, End, PageUp/Down
    Editing,     // 编辑键: Backspace, Delete, Insert
    System,      // 系统键: Esc, Tab, Enter, Space
}

#[derive(Debug, Clone, Serialize)]
pub struct KeyEvent {
    pub key_code: u32,
    pub key_name: String,
    pub key_type: KeyType,
    pub timestamp: i64,
    pub is_key_down: bool,
}

pub fn classify_key(key_code: u32, _key_name: &str) -> KeyType {
    match key_code {
        // F1-F12
        0x3A..=0x45 => KeyType::Function,
        // Shift, Ctrl, Alt, Cmd (modifier keys)
        0xE0..=0xE7 => KeyType::Modifier,
        // 方向键
        0x4F..=0x52 => KeyType::Navigation,
        // Backspace, Delete
        0x2A | 0x4C => KeyType::Editing,
        // Enter, Tab, Space, Esc
        0x28 | 0x2B | 0x2C | 0x29 => KeyType::System,
        _ => KeyType::Char,
    }
}
