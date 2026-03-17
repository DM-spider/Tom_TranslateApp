import type { TextBlock } from "./dom-parser";
import type { DisplayMode } from "./settings";

const TRANSLATE_ATTR = "data-tom-translate";
const TRANSLATED_ELEMENT_ATTR = "data-tom-translated-element";
const ORIGINAL_WRAPPER_ATTR = "data-tom-original-wrapper";

let currentMode: DisplayMode = "bilingual";

export function renderTranslation(block: TextBlock, translatedText: string): void {
  const originalWrapper = ensureOriginalWrapper(block.element);
  const translationNode = ensureTranslationNode(block.element);

  translationNode.setAttribute("data-tom-raw", translatedText);
  translationNode.textContent = translatedText;
  block.element.setAttribute(TRANSLATED_ELEMENT_ATTR, "");

  applyElementMode(block.element, originalWrapper, translationNode);
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

export function setDisplayMode(mode: DisplayMode): void {
  currentMode = mode;

  const translatedElements = document.querySelectorAll<HTMLElement>(
    `[${TRANSLATED_ELEMENT_ATTR}]`
  );
  translatedElements.forEach((element) => {
    const originalWrapper = element.querySelector<HTMLElement>(
      `:scope > [${ORIGINAL_WRAPPER_ATTR}]`
    );
    const translationNode = element.querySelector<HTMLElement>(
      `:scope > [${TRANSLATE_ATTR}]`
    );
    if (!translationNode) return;
    applyElementMode(element, originalWrapper, translationNode);
  });
}

export function removeAllTranslations(): number {
  const translatedElements = document.querySelectorAll<HTMLElement>(
    `[${TRANSLATED_ELEMENT_ATTR}]`
  );

  translatedElements.forEach((element) => {
    const translationNode = element.querySelector<HTMLElement>(
      `:scope > [${TRANSLATE_ATTR}]`
    );
    translationNode?.remove();

    const originalWrapper = element.querySelector<HTMLElement>(
      `:scope > [${ORIGINAL_WRAPPER_ATTR}]`
    );
    if (originalWrapper) {
      while (originalWrapper.firstChild) {
        element.insertBefore(originalWrapper.firstChild, originalWrapper);
      }
      originalWrapper.remove();
    }

    element.removeAttribute(TRANSLATED_ELEMENT_ATTR);
  });

  return translatedElements.length;
}

export function hasTranslations(): boolean {
  return document.querySelector(`[${TRANSLATED_ELEMENT_ATTR}]`) !== null;
}

function ensureOriginalWrapper(element: HTMLElement): HTMLSpanElement | null {
  const existing = element.querySelector<HTMLSpanElement>(
    `:scope > [${ORIGINAL_WRAPPER_ATTR}]`
  );
  if (existing) {
    return existing;
  }

  if (!canSafelyWrapOriginal(element)) {
    return null;
  }

  const wrapper = document.createElement("span");
  wrapper.setAttribute(ORIGINAL_WRAPPER_ATTR, "");
  wrapper.style.display = "contents";

  const childNodes = Array.from(element.childNodes);
  for (const child of childNodes) {
    if (
      child instanceof HTMLElement &&
      child.hasAttribute(TRANSLATE_ATTR)
    ) {
      continue;
    }
    wrapper.appendChild(child);
  }
  element.appendChild(wrapper);
  return wrapper;
}

function isInlineElement(element: HTMLElement): boolean {
  const display = getComputedStyle(element).display;
  return display === "inline" || display === "inline-block" || display === "inline-flex" || display === "inline-grid";
}

function ensureTranslationNode(element: HTMLElement): HTMLElement {
  const existing = element.querySelector<HTMLElement>(
    `:scope > [${TRANSLATE_ATTR}]`
  );
  if (existing) {
    return existing;
  }

  const tag = isInlineElement(element) ? "span" : "div";
  const translationNode = document.createElement(tag);
  translationNode.setAttribute(TRANSLATE_ATTR, "");
  element.appendChild(translationNode);
  return translationNode;
}

function applyElementMode(
  element: HTMLElement,
  originalWrapper: HTMLElement | null,
  translationNode: HTMLElement
): void {
  const computed = getComputedStyle(element);
  const isHeading = /^H[1-6]$/.test(element.tagName);
  const isDenseBlock = new Set(["LI", "TD", "TH", "DT", "DD"]).has(
    element.tagName
  );

  translationNode.style.cssText = [
    "display: block",
    `margin-top: ${isDenseBlock ? "4px" : "6px"}`,
    `padding: ${isDenseBlock ? "6px 10px" : "8px 12px"}`,
    "background: #eff6ff",
    "border-left: 3px solid #3b82f6",
    "border-radius: 0 6px 6px 0",
    `font-size: ${isHeading ? computed.fontSize : "14px"}`,
    `line-height: ${computed.lineHeight !== "normal" ? computed.lineHeight : "1.6"}`,
    `font-weight: ${isHeading ? computed.fontWeight : "500"}`,
    `text-align: ${computed.textAlign}`,
    "color: #1e40af",
    `font-family: ${computed.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"}`,
    "white-space: pre-wrap",
    "word-break: break-word",
    "box-sizing: border-box",
    "max-width: 100%",
  ].join(";");

  const inline = isInlineElement(element);

  if (inline) {
    if (currentMode === "target-only") {
      if (originalWrapper) {
        originalWrapper.style.display = "none";
      }
      const raw = translationNode.getAttribute("data-tom-raw") || translationNode.textContent || "";
      translationNode.textContent = raw;
      translationNode.style.cssText = [
        "display: inline",
        `color: ${computed.color}`,
        `font-size: ${computed.fontSize}`,
      ].join(";");
    } else {
      if (originalWrapper) {
        originalWrapper.style.display = "contents";
      }
      translationNode.style.cssText = [
        "display: inline",
        "color: #1e40af",
        "font-size: 0.9em",
        "margin-left: 2px",
      ].join(";");
      const raw = translationNode.getAttribute("data-tom-raw") || translationNode.textContent || "";
      translationNode.textContent = `(${raw})`;
    }
    return;
  }

  if (currentMode === "target-only") {
    if (originalWrapper) {
      originalWrapper.style.display = "none";
    }
    translationNode.style.marginTop = "0";
    translationNode.style.borderLeft = "none";
    translationNode.style.background = "transparent";
    translationNode.style.padding = "0";
    translationNode.style.color = computed.color;
  } else {
    if (originalWrapper) {
      originalWrapper.style.display = "contents";
    }
    translationNode.style.marginTop = isDenseBlock ? "4px" : "6px";
  }
}

function canSafelyWrapOriginal(element: HTMLElement): boolean {
  const unsafeTags = new Set([
    "TABLE",
    "THEAD",
    "TBODY",
    "TFOOT",
    "TR",
    "UL",
    "OL",
    "DL",
    "SELECT",
  ]);

  return !unsafeTags.has(element.tagName);
}
