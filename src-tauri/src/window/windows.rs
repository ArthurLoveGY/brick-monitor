use winapi::um::winuser::{GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId};
use winapi::um::processthreadsapi::OpenProcess;
use winapi::um::psapi::GetProcessImageFileNameW;
use winapi::um::winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
use winapi::um::handleapi::CloseHandle;
use std::ffi::OsString;
use std::os::windows::ffi::OsStringExt;
use super::{ActiveWindow, classify_app};

pub fn get_active_window() -> Option<ActiveWindow> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        // 获取窗口标题
        let mut title: [u16; 512] = [0; 512];
        let title_len = GetWindowTextW(hwnd, title.as_mut_ptr(), 512);
        let window_title = String::from_utf16_lossy(&title[..title_len as usize]);

        // 获取进程ID
        let mut process_id: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        // 获取进程名
        let process_handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);
        if process_handle.is_null() {
            return None;
        }

        let mut process_name: [u16; 512] = [0; 512];
        let name_len = GetProcessImageFileNameW(process_handle, process_name.as_mut_ptr(), 512);

        // Close handle immediately after use to prevent handle leak
        CloseHandle(process_handle);

        let full_name = OsString::from_wide(&process_name[..name_len as usize]);

        let app_name = full_name
            .to_string_lossy()
            .split('\\')
            .next_back()
            .unwrap_or("Unknown")
            .replace(".exe", "");

        let category = classify_app(&app_name);

        Some(ActiveWindow {
            app_name,
            window_title,
            process_id,
            category,
        })
    }
}
