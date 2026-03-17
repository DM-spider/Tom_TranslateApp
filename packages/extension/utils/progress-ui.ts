export type ProgressState = "idle" | "translating" | "done" | "error";

export interface ProgressInfo {
  state: ProgressState;
  completed: number;
  total: number;
  errorCount?: number;
  message?: string;
}

export class ProgressUI {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private container: HTMLDivElement | null = null;
  private onRestore: (() => void) | null = null;

  constructor(onRestore?: () => void) {
    this.onRestore = onRestore || null;
  }

  private ensureHost() {
    if (this.host) return;

    this.host = document.createElement("div");
    this.host.id = "tom-translate-progress";
    this.host.style.cssText =
      "position:fixed;bottom:20px;right:20px;z-index:2147483646;";
    this.shadow = this.host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = PROGRESS_STYLES;
    this.shadow.appendChild(style);

    this.container = document.createElement("div");
    this.container.className = "tt-progress";
    this.shadow.appendChild(this.container);

    document.documentElement.appendChild(this.host);
  }

  private escapeHtml(text: string): string {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  }

  update(info: ProgressInfo) {
    this.ensureHost();
    if (!this.container) return;

    const percent =
      info.total > 0 ? Math.round((info.completed / info.total) * 100) : 0;

    if (info.state === "translating") {
      this.container.innerHTML = `
        <div class="tt-progress-header">
          <span class="tt-progress-icon">&#9654;</span>
          <span class="tt-progress-text">翻译中 ${info.completed}/${info.total}</span>
        </div>
        <div class="tt-progress-bar-bg">
          <div class="tt-progress-bar-fill" style="width:${percent}%"></div>
        </div>
        <div class="tt-progress-percent">${percent}%</div>
      `;
    } else if (info.state === "done") {
      const errText =
        info.errorCount && info.errorCount > 0
          ? `<span class="tt-progress-warn">（${info.errorCount} 段失败）</span>`
          : "";
      this.container.innerHTML = `
        <div class="tt-progress-header">
          <span class="tt-progress-icon tt-done">&#10003;</span>
          <span class="tt-progress-text">翻译完成 ${errText}</span>
        </div>
        <div class="tt-progress-actions">
          <button class="tt-btn-restore">还原页面</button>
          <button class="tt-btn-close">关闭</button>
        </div>
      `;
      this.container
        .querySelector(".tt-btn-restore")
        ?.addEventListener("click", () => this.onRestore?.());
      this.container
        .querySelector(".tt-btn-close")
        ?.addEventListener("click", () => this.destroy());
    } else if (info.state === "error") {
      const safeMessage = this.escapeHtml(info.message || "翻译出错");
      this.container.innerHTML = `
        <div class="tt-progress-header">
          <span class="tt-progress-icon tt-err">!</span>
          <span class="tt-progress-text">${safeMessage}</span>
        </div>
        <div class="tt-progress-actions">
          <button class="tt-btn-close">关闭</button>
        </div>
      `;
      this.container
        .querySelector(".tt-btn-close")
        ?.addEventListener("click", () => this.destroy());
    }
  }

  destroy() {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.container = null;
  }
}

const PROGRESS_STYLES = `
.tt-progress {
  min-width: 220px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  padding: 14px 16px;
  font-size: 13px;
  color: #1f2937;
  border: 1px solid rgba(0,0,0,0.06);
}
.tt-progress-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.tt-progress-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  font-size: 11px;
  flex-shrink: 0;
}
.tt-progress-icon.tt-done {
  background: #22c55e;
}
.tt-progress-icon.tt-err {
  background: #ef4444;
  font-weight: bold;
}
.tt-progress-text {
  font-weight: 500;
}
.tt-progress-warn {
  color: #f59e0b;
  font-size: 12px;
}
.tt-progress-bar-bg {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}
.tt-progress-bar-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 3px;
  transition: width 0.3s ease;
}
.tt-progress-percent {
  text-align: right;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.tt-progress-actions {
  display: flex;
  gap: 8px;
}
.tt-btn-restore, .tt-btn-close {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 7px 12px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
.tt-btn-restore {
  background: #3b82f6;
  color: white;
}
.tt-btn-restore:hover {
  background: #2563eb;
}
.tt-btn-close {
  background: #f3f4f6;
  color: #374151;
}
.tt-btn-close:hover {
  background: #e5e7eb;
}
`;
