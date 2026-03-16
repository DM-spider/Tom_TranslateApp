import type { ExtensionMessage, ExtensionResponse } from "shared";
import { extractTextBlocks } from "./dom-parser";
import { segmentIntoBatches, type TranslateBatch } from "./segmenter";
import { renderBatchTranslations, removeAllTranslations } from "./renderer";
import { ProgressUI, type ProgressInfo } from "./progress-ui";

export type PageTranslateState = "idle" | "translating" | "done";

const CONCURRENCY = 3;

export class PageTranslator {
  private state: PageTranslateState = "idle";
  private progressUI: ProgressUI;
  private aborted = false;

  constructor() {
    this.progressUI = new ProgressUI(() => this.restore());
  }

  getState(): PageTranslateState {
    return this.state;
  }

  async translatePage(): Promise<void> {
    if (this.state === "translating") return;

    this.state = "translating";
    this.aborted = false;

    const blocks = extractTextBlocks();
    if (blocks.length === 0) {
      this.state = "idle";
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

    this.state = "done";
    this.progressUI.update({
      state: "done",
      completed: total,
      total,
      errorCount,
    });
  }

  private async translateBatch(batch: TranslateBatch): Promise<string[]> {
    const message: ExtensionMessage = {
      type: "TRANSLATE_BATCH",
      payload: { texts: batch.texts },
    };

    const response: ExtensionResponse =
      await chrome.runtime.sendMessage(message);

    if (response.type === "TRANSLATE_RESULT") {
      const result = response.payload as { translatedTexts: string[] };
      return result.translatedTexts;
    } else if (response.type === "ERROR") {
      throw new Error(
        (response.payload as { message: string }).message
      );
    }
    throw new Error("未知响应类型");
  }

  restore(): void {
    removeAllTranslations();
    this.state = "idle";
    this.progressUI.destroy();
  }

  abort(): void {
    this.aborted = true;
  }

  destroy(): void {
    this.abort();
    this.progressUI.destroy();
  }
}
