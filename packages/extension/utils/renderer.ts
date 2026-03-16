import type { TextBlock } from "./dom-parser";

const TRANSLATE_ATTR = "data-tom-translate";

export function renderTranslation(block: TextBlock, translatedText: string): void {
  if (block.element.querySelector(`[${TRANSLATE_ATTR}]`)) return;

  const wrapper = document.createElement("div");
  wrapper.setAttribute(TRANSLATE_ATTR, "");
  wrapper.style.cssText = [
    "display: block",
    "margin-top: 6px",
    "padding: 8px 12px",
    "background: #eff6ff",
    "border-left: 3px solid #3b82f6",
    "border-radius: 0 6px 6px 0",
    "font-size: 14px",
    "line-height: 1.6",
    "color: #1e40af",
    "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "white-space: pre-wrap",
    "word-break: break-word",
  ].join(";");

  wrapper.textContent = translatedText;
  block.element.insertAdjacentElement("afterend", wrapper);
}

export function renderBatchTranslations(
  blocks: TextBlock[],
  translations: string[]
): void {
  for (let i = 0; i < blocks.length; i++) {
    if (translations[i]) {
      renderTranslation(blocks[i], translations[i]);
    }
  }
}

export function removeAllTranslations(): number {
  const nodes = document.querySelectorAll(`[${TRANSLATE_ATTR}]`);
  const count = nodes.length;
  nodes.forEach((node) => node.remove());
  return count;
}

export function hasTranslations(): boolean {
  return document.querySelector(`[${TRANSLATE_ATTR}]`) !== null;
}
