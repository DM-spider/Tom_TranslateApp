export interface TextBlock {
  element: HTMLElement;
  text: string;
}

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "SVG",
  "MATH",
  "CODE",
  "PRE",
  "TEXTAREA",
  "INPUT",
  "SELECT",
  "BUTTON",
  "IFRAME",
  "CANVAS",
  "VIDEO",
  "AUDIO",
  "IMG",
]);

const BLOCK_TAGS = new Set([
  "P",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "TD",
  "TH",
  "DT",
  "DD",
  "BLOCKQUOTE",
  "FIGCAPTION",
  "CAPTION",
  "SUMMARY",
  "LEGEND",
]);

const TRANSLATE_ATTR = "data-tom-translate";

function isVisible(el: HTMLElement): boolean {
  if (el.offsetHeight === 0 && el.offsetWidth === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function isLeafBlock(el: HTMLElement): boolean {
  return BLOCK_TAGS.has(el.tagName);
}

function hasBlockChild(el: HTMLElement): boolean {
  for (const child of el.children) {
    if (child instanceof HTMLElement && isLeafBlock(child)) return true;
  }
  return false;
}

export function extractTextBlocks(): TextBlock[] {
  const blocks: TextBlock[] = [];

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;

    if (SKIP_TAGS.has(el.tagName)) return;
    if (el.hasAttribute(TRANSLATE_ATTR)) return;
    if (el.id === "tom-translate-root") return;
    if (el.id === "tom-translate-progress") return;

    if (!isVisible(el)) return;

    if (isLeafBlock(el)) {
      const text = el.innerText?.trim();
      if (text && text.length > 1) {
        blocks.push({ element: el, text });
      }
      return;
    }

    if (!hasBlockChild(el)) {
      const text = el.innerText?.trim();
      if (text && text.length > 1 && el.tagName !== "BODY" && el.tagName !== "HTML") {
        blocks.push({ element: el, text });
        return;
      }
    }

    for (const child of el.children) {
      walk(child);
    }
  }

  walk(document.body);
  return blocks;
}
