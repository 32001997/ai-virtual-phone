"use client";

/**
 * 安卓全屏兜底（已停用）：网页调用全屏 API 会触发浏览器无法抑制的
 * 「如需退出全屏模式」提示条（Chrome/Opera 等）。沉浸感改由 PWA
 * standalone 安装模式提供，此组件保留空实现以兼容既有挂载点。
 */
export function AndroidFullscreen() {
  return null;
}
