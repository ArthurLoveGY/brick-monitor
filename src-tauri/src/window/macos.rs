use super::{classify_app, ActiveWindow};
use crate::error::{AppError, AppResult};
use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowLayer, kCGWindowListExcludeDesktopElements,
    kCGWindowListOptionOnScreenOnly, kCGWindowName, kCGWindowOwnerName, kCGWindowOwnerPID,
};
use std::borrow::Cow;

pub fn get_active_window() -> AppResult<ActiveWindow> {
    let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
    let windows = copy_window_info(options, kCGNullWindowID).ok_or_else(|| {
        AppError::new("MACOS_WINDOW_LIST_UNAVAILABLE", "无法读取当前屏幕窗口列表")
    })?;

    for entry in &windows {
        let dictionary: CFDictionary<CFString, CFType> =
            unsafe { CFDictionary::wrap_under_get_rule(*entry as _) };

        if window_layer(&dictionary)? != 0 {
            continue;
        }

        let app_name = owner_name(&dictionary)?;
        let process_id = owner_pid(&dictionary)?;
        let window_title = window_name(&dictionary);
        let category = classify_app(&app_name);

        return Ok(ActiveWindow {
            app_name,
            window_title,
            process_id,
            category,
        });
    }

    Err(AppError::new(
        "MACOS_ACTIVE_WINDOW_NOT_FOUND",
        "当前没有可用于监控的前台窗口",
    ))
}

fn owner_pid(dictionary: &CFDictionary<CFString, CFType>) -> AppResult<u32> {
    let key = unsafe { CFString::wrap_under_get_rule(kCGWindowOwnerPID) };
    let value = dictionary.find(&key).ok_or_else(|| {
        AppError::new("MACOS_WINDOW_PID_MISSING", "窗口字典缺少 owner PID 字段")
    })?;
    let number = value.downcast::<CFNumber>().ok_or_else(|| {
        AppError::new("MACOS_WINDOW_PID_INVALID", "窗口 owner PID 字段类型错误")
    })?;
    let pid = number.to_i64().ok_or_else(|| {
        AppError::new("MACOS_WINDOW_PID_INVALID", "窗口 owner PID 字段无法转换为整数")
    })?;

    u32::try_from(pid).map_err(|_| {
        AppError::new(
            "MACOS_WINDOW_PID_INVALID",
            format!("窗口 owner PID 超出有效范围: {pid}"),
        )
    })
}

fn owner_name(dictionary: &CFDictionary<CFString, CFType>) -> AppResult<String> {
    let key = unsafe { CFString::wrap_under_get_rule(kCGWindowOwnerName) };
    let value = dictionary.find(&key).ok_or_else(|| {
        AppError::new("MACOS_WINDOW_OWNER_NAME_MISSING", "窗口字典缺少 owner name 字段")
    })?;
    let name = value.downcast::<CFString>().ok_or_else(|| {
        AppError::new("MACOS_WINDOW_OWNER_NAME_INVALID", "窗口 owner name 字段类型错误")
    })?;
    Ok(Cow::from(&name).into_owned())
}

fn window_layer(dictionary: &CFDictionary<CFString, CFType>) -> AppResult<i64> {
    let key = unsafe { CFString::wrap_under_get_rule(kCGWindowLayer) };
    let value = dictionary.find(&key).ok_or_else(|| {
        AppError::new("MACOS_WINDOW_LAYER_MISSING", "窗口字典缺少 layer 字段")
    })?;
    let number = value.downcast::<CFNumber>().ok_or_else(|| {
        AppError::new("MACOS_WINDOW_LAYER_INVALID", "窗口 layer 字段类型错误")
    })?;
    number.to_i64().ok_or_else(|| {
        AppError::new("MACOS_WINDOW_LAYER_INVALID", "窗口 layer 字段无法转换为整数")
    })
}

fn window_name(dictionary: &CFDictionary<CFString, CFType>) -> String {
    let key = unsafe { CFString::wrap_under_get_rule(kCGWindowName) };
    let Some(value) = dictionary.find(&key) else {
        return String::new();
    };
    let Some(name) = value.downcast::<CFString>() else {
        return String::new();
    };

    Cow::from(&name).into_owned()
}
