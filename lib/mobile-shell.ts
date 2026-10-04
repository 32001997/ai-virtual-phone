// lib/mobile-shell.ts — 手机壳布局的统一判定。
// CSS 媒体查询只能相信浏览器报告的视口，而"桌面版网站"、国产浏览器私有缩放、
// 系统显示大小调小等都会让视口虚大、真手机被误判成桌面环境。物理屏幕尺寸
// (screen.width/height) 和触摸点数是浏览器改不了的"物理证据"——app/layout.tsx
// 的 head 内联脚本据此在 <html> 上打 data-force-mobile 标记，CSS 镜像规则与
// 这里的 JS 判定共同消费它。

// 不限宽度：纯触摸设备（无悬停能力）一律全屏手机壳。平板（CSS 短边 720~1024）
// 之前被 max-width: 620px 划进桌面模式，出现居中 mockup + 白边。
export const MOBILE_SHELL_MQ = "(hover: none) and (pointer: coarse)";

/** 物理判定：有触摸屏且物理短边 ≤620px ⇒ 真手机。 */
export function isPhysicallyPhone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const touch = (navigator.maxTouchPoints ?? 0) > 0;
    const shortSide = Math.min(window.screen.width, window.screen.height);
    return touch && shortSide > 0 && shortSide <= 620;
  } catch {
    return false;
  }
}

/** 是否应使用手机壳布局（媒体查询命中，或被物理判定强制）。 */
export function isMobileShell(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_SHELL_MQ).matches
    || document.documentElement.hasAttribute("data-force-mobile");
}

// ── 大屏档整屏缩放 ──
// 手机（物理短边 <520）永远 zoom=1，走原有流式布局，零影响。
// 平板/折叠屏内屏（短边 ≥520）把整个壳按 min(宽/390, 高/844) 等比放大，
// 视觉上等于一台放大的手机：组件/字体/间距全部等比，不存在组件变形。
// --phone-screen-width/height 会除以 zoom（见 phone-shell.css），壳内仍铺满全屏。
// 与 app/layout.tsx 的 head 内联脚本（首屏防闪）保持同步。
export const SHELL_DESIGN_WIDTH = 390;
export const SHELL_DESIGN_HEIGHT = 844;
export const SHELL_ZOOM_MIN_SHORT_SIDE = 520;

export function computeShellZoom(): number {
  if (typeof window === "undefined") return 1;
  try {
    if (!isMobileShell()) return 1;
    // stable 渠道且用户未强制手机壳时不缩放——与主线行为一致；beta 渠道照常
    if (shellChannel() === "stable" && readShellModeOverride() !== "phone") return 1;
    const shortSide = Math.min(window.screen.width, window.screen.height);
    if (shortSide < SHELL_ZOOM_MIN_SHORT_SIDE) return 1;
    const z = Math.min(
      window.innerWidth / SHELL_DESIGN_WIDTH,
      window.innerHeight / SHELL_DESIGN_HEIGHT,
    );
    return Number.isFinite(z) && z > 1 ? z : 1;
  } catch {
    return 1;
  }
}

/** 计算并把 --shell-zoom 写到 <html>；z=1 时移除（CSS 回退值就是 1）。 */
export function applyShellZoom(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const z = computeShellZoom();
  if (z > 1.001) {
    root.style.setProperty("--shell-zoom", z.toFixed(4));
  } else {
    root.style.removeProperty("--shell-zoom");
  }
}

// ── 部署渠道与人工覆盖 ──

export type ShellChannel = "beta" | "stable";
export type ShellModeOverride = "auto" | "phone" | "desktop";
export const SHELL_MODE_STORAGE_KEY = "ai_phone_shell_mode_v1";

/** 部署渠道：决定各行为"用户没动过开关"时的默认值。
 *  灰测期本分支缺省 beta（= 测试线既有行为：物理判定 + 不强制全屏）；
 *  转正合入 main 时把缺省改为 stable，测试站在 Netlify 设 NEXT_PUBLIC_SHELL_CHANNEL=beta。 */
export function shellChannel(): ShellChannel {
  return (process.env.NEXT_PUBLIC_SHELL_CHANNEL || "").trim() === "stable" ? "stable" : "beta";
}

/** 读三挡显示形态覆盖：auto=按渠道默认判定 / phone=强制手机壳 / desktop=禁用物理强制。 */
export function readShellModeOverride(): ShellModeOverride {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = localStorage.getItem(SHELL_MODE_STORAGE_KEY);
    return raw === "phone" || raw === "desktop" ? raw : "auto";
  } catch { return "auto"; }
}

/** 写三挡覆盖并立即应用能即时生效的部分（data-force-mobile 标记 + 缩放）。
 *  真触屏设备由 CSS 媒体查询直接命中手机壳，desktop 挡对它们无效（文案已说明）。 */
export function writeShellModeOverride(mode: ShellModeOverride): void {
  if (typeof window === "undefined") return;
  try {
    if (mode === "auto") localStorage.removeItem(SHELL_MODE_STORAGE_KEY);
    else localStorage.setItem(SHELL_MODE_STORAGE_KEY, mode);
  } catch { /* 隐私模式写不进，只影响下次启动的记忆 */ }
  const root = document.documentElement;
  const mqMatches = window.matchMedia(MOBILE_SHELL_MQ).matches;
  const shouldForce = !mqMatches && (
    mode === "phone" || (mode === "auto" && shellChannel() === "beta" && isPhysicallyPhone())
  );
  if (shouldForce) root.setAttribute("data-force-mobile", "1");
  else root.removeAttribute("data-force-mobile");
  applyShellZoom();
}
