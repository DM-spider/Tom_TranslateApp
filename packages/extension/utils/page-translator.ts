import type { ExtensionMessage, ExtensionResponse } from "shared";
import { extractTextBlocks, type TextBlock } from "./dom-parser";
import { segmentIntoBatches, type TranslateBatch } from "./segmenter";
import { renderBatchTranslations, removeAllTranslations } from "./renderer";
import { ProgressUI } from "./progress-ui";

export type PageTranslateState = "idle" | "translating" | "done";

const CONCURRENCY = 4;
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 800;

export class PageTranslator {
  private state: PageTranslateState = "idle";
  private progressUI: ProgressUI;
  private aborted = false;
  private mutationObserver: MutationObserver | null = null;
  private mutationDebounceTimer: number | null = null;
  private pendingMutationRoots = new Set<HTMLElement>();
  private translatedElements = new WeakSet<HTMLElement>();

  constructor() {
    this.progressUI = new ProgressUI(() => this.restore());
  }

  getState(): PageTranslateState {
    return this.state;
  }

  showSameLanguageHint(targetLang: string): void {
    const langNames: Record<string, string> = {
      "zh-CN": "简体中文",
      "zh-TW": "繁體中文",
      en: "English",
      ja: "日本語",
      ko: "한국어",
      fr: "Français",
      de: "Deutsch",
      es: "Español",
      ru: "Русский",
    };
    const name = langNames[targetLang] || targetLang;
    this.progressUI.update({
      state: "error",
      completed: 0,
      total: 0,
      message: `页面语言与目标语言相同（${name}），无需翻译`,
    });
  }

  async translatePage(): Promise<void> {
    if (this.state === "translating") return;

    this.state = "translating";
    this.aborted = false;
    this.stopMutationObserver();
    this.clearPendingMutationQueue();

    const blocks = this.prioritizeViewportBlocks(extractTextBlocks()).filter(
      (block) => !this.translatedElements.has(block.element)
    );
    if (blocks.length === 0) {
      this.state = "idle";
      this.progressUI.update({
        state: "error",
        completed: 0,
        total: 0,
        message: "未找到可翻译文本",
      });
      this.startMutationObserver();
      return;
    }

    const batches = segmentIntoBatches(blocks);
    const total = batches.length;
    let completed = 0;
    let errorCount = 0;

    this.progressUI.update({ state: "translating", completed: 0, total });

    for (let i = 0; i < total; i += CONCURRENCY) {
      if (this.aborted) break;

      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((batch) => this.translateBatch(batch))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled") {
          renderBatchTranslations(chunk[j].items, result.value);
          chunk[j].items.forEach((item) => this.translatedElements.add(item.element));
        } else {
          errorCount++;
          console.warn("[TomTranslate] batch failed:", result.reason);
        }
        completed++;
        this.progressUI.update({
          state: "translating",
          completed,
          total,
        });
      }
    }

    if (this.aborted) {
      this.state = "idle";
      this.progressUI.destroy();
      return;
    }

    this.state = "done";
    if (total > 0 && completed === errorCount) {
      this.progressUI.update({
        state: "error",
        completed,
        total,
        errorCount,
        message: "翻译请求全部失败，请检查 API 配置",
      });
    } else {
      this.progressUI.update({
        state: "done",
        completed,
        total,
        errorCount,
      });
    }
    this.startMutationObserver();
  }

  private async translateBatch(batch: TranslateBatch): Promise<string[]> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      try {
        const message: ExtensionMessage = {
          type: "TRANSLATE_BATCH",
          payload: { texts: batch.texts },
        };

        const response: ExtensionResponse =
          await chrome.runtime.sendMessage(message);

        if (!response) {
          throw new Error("未收到 background 响应，请刷新页面重试");
        }
        if (response.type === "TRANSLATE_RESULT") {
          const result = response.payload as { translatedTexts: string[] };
          return result.translatedTexts;
        } else if (response.type === "ERROR") {
          throw new Error(
            (response.payload as { message: string }).message
          );
        }
        throw new Error(`未知响应类型: ${JSON.stringify(response).slice(0, 200)}`);
      } catch (err: unknown) {
        const errMsg =
          err instanceof Error
            ? err.message
            : typeof err === "object" && err !== null && "message" in err
              ? String((err as { message: unknown }).message)
              : JSON.stringify(err);
        lastError = new Error(errMsg);
        console.warn(
          `[TomTranslate] batch attempt ${attempt + 1}/${MAX_RETRIES + 1} failed:`,
          errMsg
        );
      }
    }

    throw lastError!;
  }

  restore(): void {
    removeAllTranslations();
    this.state = "idle";
    this.progressUI.destroy();
    this.stopMutationObserver();
    this.clearPendingMutationQueue();
    this.translatedElements = new WeakSet();
  }

  abort(): void {
    this.aborted = true;
  }

  destroy(): void {
    this.abort();
    this.stopMutationObserver();
    this.clearPendingMutationQueue();
    this.progressUI.destroy();
  }

  private prioritizeViewportBlocks(blocks: TextBlock[]): TextBlock[] {
    const inView: TextBlock[] = [];
    const outView: TextBlock[] = [];
    for (const block of blocks) {
      if (this.isInViewport(block.element)) {
        inView.push(block);
      } else {
        outView.push(block);
      }
    }
    return [...inView, ...outView];
  }

  private isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    const margin = 180;
    return (
      rect.bottom >= -margin &&
      rect.right >= -margin &&
      rect.top <= window.innerHeight + margin &&
      rect.left <= window.innerWidth + margin
    );
  }

  private startMutationObserver(): void {
    if (this.mutationObserver || !document.body) return;

    this.mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type !== "childList" || mutation.addedNodes.length === 0) continue;
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.id === "tom-translate-root" || node.id === "tom-translate-progress") {
            continue;
          }
          this.pendingMutationRoots.add(node);
        }
      }
      this.scheduleMutationProcessing();
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private stopMutationObserver(): void {
    this.mutationObserver?.disconnect();
    this.mutationObserver = null;
  }

  private scheduleMutationProcessing(): void {
    if (this.mutationDebounceTimer !== null) return;
    this.mutationDebounceTimer = window.setTimeout(() => {
      this.mutationDebounceTimer = null;
      this.processMutationRoots().catch((err) => {
        console.warn("[TomTranslate] mutation translate failed:", err);
      });
    }, 600);
  }

  private clearPendingMutationQueue(): void {
    this.pendingMutationRoots.clear();
    if (this.mutationDebounceTimer !== null) {
      clearTimeout(this.mutationDebounceTimer);
      this.mutationDebounceTimer = null;
    }
  }

  private async processMutationRoots(): Promise<void> {
    if (this.aborted || this.state === "idle") return;

    const roots = Array.from(this.pendingMutationRoots);
    this.pendingMutationRoots.clear();
    if (roots.length === 0) return;

    const uniqueBlocks = new Map<HTMLElement, TextBlock>();
    for (const root of roots) {
      const blocks = extractTextBlocks(root);
      for (const block of blocks) {
        if (this.translatedElements.has(block.element)) continue;
        uniqueBlocks.set(block.element, block);
      }
    }

    const blocks = this.prioritizeViewportBlocks(Array.from(uniqueBlocks.values()));
    if (blocks.length === 0) return;

    const batches = segmentIntoBatches(blocks);
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      if (this.aborted) break;
      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map((batch) => this.translateBatch(batch))
      );
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status !== "fulfilled") {
          console.warn("[TomTranslate] dynamic batch failed:", result.reason);
          continue;
        }
        renderBatchTranslations(chunk[j].items, result.value);
        chunk[j].items.forEach((item) => this.translatedElements.add(item.element));
      }
    }
  }
}
