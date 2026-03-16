import type { TextBlock } from "./dom-parser";

export interface TranslateBatch {
  items: TextBlock[];
  texts: string[];
  tokenEstimate: number;
}

const MAX_TOKENS_PER_BATCH = 1500;
const MAX_TEXT_LENGTH = 4500;

function estimateTokens(text: string): number {
  let tokens = 0;
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g;
  const cjkChars = text.match(cjkPattern)?.length || 0;
  tokens += cjkChars * 2;

  const nonCjk = text.replace(cjkPattern, " ");
  const words = nonCjk.split(/\s+/).filter(Boolean);
  tokens += Math.ceil(words.length * 1.5);

  return Math.max(tokens, 1);
}

export function segmentIntoBatches(blocks: TextBlock[]): TranslateBatch[] {
  const batches: TranslateBatch[] = [];
  let current: TranslateBatch = { items: [], texts: [], tokenEstimate: 0 };

  for (const block of blocks) {
    if (block.text.length > MAX_TEXT_LENGTH) {
      block.text = block.text.slice(0, MAX_TEXT_LENGTH);
    }
    const tokens = estimateTokens(block.text);

    if (tokens > MAX_TOKENS_PER_BATCH) {
      if (current.items.length > 0) {
        batches.push(current);
        current = { items: [], texts: [], tokenEstimate: 0 };
      }
      batches.push({
        items: [block],
        texts: [block.text],
        tokenEstimate: tokens,
      });
      continue;
    }

    if (current.tokenEstimate + tokens > MAX_TOKENS_PER_BATCH && current.items.length > 0) {
      batches.push(current);
      current = { items: [], texts: [], tokenEstimate: 0 };
    }

    current.items.push(block);
    current.texts.push(block.text);
    current.tokenEstimate += tokens;
  }

  if (current.items.length > 0) {
    batches.push(current);
  }

  return batches;
}
