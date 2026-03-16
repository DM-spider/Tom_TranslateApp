import type { ExtensionMessage, ExtensionResponse } from "shared";
import { PageTranslator } from "@/utils/page-translator";
import { hasTranslations } from "@/utils/renderer";

export default defineContentScript({
  matches: ["<all_urls>"],

  main(ctx) {
    let host: HTMLDivElement | null = null;
    let shadow: ShadowRoot | null = null;
    let triggerEl: HTMLDivElement | null = null;
    let bubbleEl: HTMLDivElement | null = null;
    let selectedText = "";
    let autoTranslateEnabled = true;

    const pageTranslator = new PageTranslator();

    // 启动时加载 autoTranslate 设置
    chrome.runtime
      .sendMessage({ type: "GET_SETTINGS", payload: null } as ExtensionMessage)
      .then((res) => {
        if (res?.type === "SETTINGS") {
          autoTranslateEnabled = (res.payload as { autoTranslate: boolean }).autoTranslate;
        }
      })
      .catch(() => {});

    // 监听设置变更
    chrome.storage.onChanged.addListener((changes) => {
      const settingsChange = changes["tom-translate-settings"];
      if (settingsChange?.newValue) {
        autoTranslateEnabled = settingsChange.newValue.autoTranslate ?? true;
      }
    });

    // ---- 监听来自 Popup / Background 的消息 ----

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "TRANSLATE_PAGE") {
        pageTranslator.translatePage().catch(console.error);
        sendResponse({ type: "ok" });
      } else if (message.type === "RESTORE_PAGE") {
        pageTranslator.restore();
        sendResponse({ type: "ok" });
      } else if (message.type === "GET_PAGE_STATE") {
        sendResponse({
          type: "PAGE_STATE",
          payload: {
            state: pageTranslator.getState(),
            hasTranslations: hasTranslations(),
          },
        });
      } else if (message.type === "SHOW_TRANSLATION") {
        const p = message.payload as {
          original: string;
          translated: string;
          engine: string;
        };
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          showBubble(rect.left, rect.bottom + 8);
          updateBubbleResult(p.original, p.translated, p.engine);
        }
      }
      return false;
    });

    function ensureHost() {
      if (host) return;
      host = document.createElement("div");
      host.id = "tom-translate-root";
      host.style.cssText =
        "position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;";
      shadow = host.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = CONTENT_STYLES;
      shadow.appendChild(style);

      document.documentElement.appendChild(host);
    }

    // ---- Trigger Icon ----

    function showTrigger(x: number, y: number) {
      ensureHost();
      hideBubble();

      if (!triggerEl) {
        triggerEl = document.createElement("div");
        triggerEl.className = "tt-trigger";
        triggerEl.textContent = "译";
        triggerEl.addEventListener("click", onTriggerClick);
        shadow!.appendChild(triggerEl);
      }

      const clamped = clampPosition(x, y, 28, 28);
      triggerEl.style.left = `${clamped.x}px`;
      triggerEl.style.top = `${clamped.y}px`;
      triggerEl.style.display = "flex";
    }

    function hideTrigger() {
      if (triggerEl) triggerEl.style.display = "none";
    }

    // ---- Translation Bubble ----

    function showBubble(x: number, y: number) {
      ensureHost();

      if (!bubbleEl) {
        bubbleEl = document.createElement("div");
        bubbleEl.className = "tt-bubble";
        shadow!.appendChild(bubbleEl);
      }

      const clamped = clampPosition(x, y + 8, 360, 200);
      bubbleEl.style.left = `${clamped.x}px`;
      bubbleEl.style.top = `${clamped.y}px`;
      bubbleEl.style.display = "block";

      bubbleEl.innerHTML = `
        <div class="tt-bubble-header">
          <span class="tt-bubble-title">翻译</span>
          <button class="tt-bubble-close">&times;</button>
        </div>
        <div class="tt-bubble-content">
          <div class="tt-loading">翻译中...</div>
        </div>
      `;

      bubbleEl
        .querySelector(".tt-bubble-close")!
        .addEventListener("click", dismissAll);
    }

    function updateBubbleResult(
      original: string,
      translated: string,
      engine: string
    ) {
      if (!bubbleEl) return;
      const content = bubbleEl.querySelector(".tt-bubble-content");
      if (!content) return;

      const truncated =
        original.length > 120 ? original.slice(0, 120) + "…" : original;

      content.innerHTML = `
        <div class="tt-original">${escapeHtml(truncated)}</div>
        <div class="tt-divider"></div>
        <div class="tt-translated">${escapeHtml(translated)}</div>
        <div class="tt-footer">
          <span class="tt-engine">${escapeHtml(engine)}</span>
          <button class="tt-copy">复制</button>
        </div>
      `;

      content.querySelector(".tt-copy")!.addEventListener("click", () => {
        navigator.clipboard.writeText(translated);
        const btn = content.querySelector(".tt-copy") as HTMLButtonElement;
        btn.textContent = "已复制 ✓";
        setTimeout(() => {
          btn.textContent = "复制";
        }, 1500);
      });
    }

    function updateBubbleError(message: string) {
      if (!bubbleEl) return;
      const content = bubbleEl.querySelector(".tt-bubble-content");
      if (!content) return;
      content.innerHTML = `<div class="tt-error">${escapeHtml(message)}</div>`;
    }

    function hideBubble() {
      if (bubbleEl) {
        bubbleEl.style.display = "none";
        bubbleEl.innerHTML = "";
      }
    }

    function dismissAll() {
      hideTrigger();
      hideBubble();
      selectedText = "";
    }

    // ---- Translation Logic ----

    async function onTriggerClick(e: Event) {
      e.stopPropagation();
      if (!selectedText) return;

      const rect = triggerEl!.getBoundingClientRect();
      hideTrigger();
      showBubble(rect.left, rect.bottom);

      try {
        const message: ExtensionMessage = {
          type: "TRANSLATE_SELECTION",
          payload: { text: selectedText },
        };
        const response: ExtensionResponse =
          await chrome.runtime.sendMessage(message);

        if (response.type === "TRANSLATE_RESULT") {
          const result = response.payload as {
            translatedTexts: string[];
            engineUsed: string;
          };
          updateBubbleResult(
            selectedText,
            result.translatedTexts[0] || "",
            result.engineUsed
          );
        } else if (response.type === "ERROR") {
          updateBubbleError(
            (response.payload as { message: string }).message
          );
        }
      } catch (err) {
        updateBubbleError(
          err instanceof Error ? err.message : "翻译失败，请检查后端服务"
        );
      }
    }

    // ---- Event Listeners ----

    function isInsideOurUI(e: MouseEvent): boolean {
      return e.composedPath().some((el) => el === host);
    }

    ctx.addEventListener(document, "mouseup", (e: MouseEvent) => {
      if (isInsideOurUI(e)) return;
      if (!autoTranslateEnabled) return;

      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() || "";

        if (text.length > 0 && text.length <= 5000) {
          selectedText = text;
          const range = selection!.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          showTrigger(rect.right + 8, rect.top - 4);
        } else if (!bubbleEl || bubbleEl.style.display === "none") {
          dismissAll();
        }
      }, 10);
    });

    ctx.addEventListener(document, "mousedown", (e: MouseEvent) => {
      if (isInsideOurUI(e)) return;
      if (bubbleEl && bubbleEl.style.display !== "none") {
        dismissAll();
      }
    });

    ctx.addEventListener(document, "keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissAll();
    });

    ctx.addEventListener(document, "scroll", () => {
      if (triggerEl && triggerEl.style.display !== "none") {
        hideTrigger();
      }
    });

    // ---- Helpers ----

    function clampPosition(
      x: number,
      y: number,
      w: number,
      h: number
    ): { x: number; y: number } {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      return {
        x: Math.max(4, Math.min(x, vw - w - 4)),
        y: Math.max(4, Math.min(y, vh - h - 4)),
      };
    }

    function escapeHtml(text: string): string {
      const el = document.createElement("span");
      el.textContent = text;
      return el.innerHTML;
    }
  },
});

// ---- Styles (injected into Shadow DOM) ----

const CONTENT_STYLES = `
:host {
  all: initial;
}

.tt-trigger {
  position: fixed;
  display: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  font-size: 13px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s, box-shadow 0.15s;
  user-select: none;
}

.tt-trigger:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.tt-bubble {
  position: fixed;
  display: none;
  width: 360px;
  max-height: 400px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #1f2937;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.tt-bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
}

.tt-bubble-title {
  font-weight: 600;
  font-size: 13px;
  color: #6b7280;
}

.tt-bubble-close {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  color: #9ca3af;
  font-size: 18px;
  border-radius: 4px;
  line-height: 1;
  padding: 0;
}

.tt-bubble-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.tt-bubble-content {
  padding: 14px;
  max-height: 320px;
  overflow-y: auto;
}

.tt-original {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.5;
  word-break: break-word;
}

.tt-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 10px 0;
}

.tt-translated {
  font-size: 14px;
  color: #111827;
  line-height: 1.6;
  word-break: break-word;
}

.tt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
}

.tt-engine {
  font-size: 11px;
  color: #9ca3af;
}

.tt-copy {
  border: none;
  background: #f3f4f6;
  color: #374151;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.tt-copy:hover {
  background: #e5e7eb;
}

.tt-loading {
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tt-loading::before {
  content: "";
  width: 16px;
  height: 16px;
  border: 2px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: tt-spin 0.6s linear infinite;
}

@keyframes tt-spin {
  to {
    transform: rotate(360deg);
  }
}

.tt-error {
  color: #dc2626;
  font-size: 13px;
}
`;
