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

const LEAF_BLOCK_TAGS = new Set([
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

const CONTAINER_TAGS = new Set([
  "DIV",
  "SECTION",
  "ARTICLE",
  "NAV",
  "ASIDE",
  "HEADER",
  "FOOTER",
  "MAIN",
  "DETAILS",
  "FIGURE",
  "FORM",
  "FIELDSET",
  "UL",
  "OL",
  "DL",
  "TABLE",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
]);

const TRANSLATE_ATTR = "data-tom-translate";
const TRANSLATED_ELEMENT_ATTR = "data-tom-translated-element";

const NON_CONTENT_HINTS = [
  "nav",
  "menu",
  "sidebar",
  "toc",
  "breadcrumb",
  "footer",
  "header",
  "toolbar",
  "pagination",
];

const EXTRACT_SKIP_SELECTOR = [
  "script", "style", "noscript", "svg", "math",
  "code", "pre", "textarea", "button",
  ".katex", ".MathJax", "mjx-container",
  "[aria-hidden='true']",
].join(",");

function isVisible(el: HTMLElement): boolean {
  if (el.offsetHeight === 0 && el.offsetWidth === 0) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

function isLikelyNonContent(el: HTMLElement): boolean {
  if (
    el.closest(
      "nav,aside,header,footer,[role='navigation'],[role='menu'],[aria-hidden='true']"
    )
  ) {
    return true;
  }

  const id = el.id.toLowerCase();
  const classes = (typeof el.className === "string" ? el.className : "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return NON_CONTENT_HINTS.some(
    (hint) =>
      id === hint ||
      id.startsWith(`${hint}-`) ||
      id.startsWith(`${hint}_`) ||
      classes.some(
        (cls) =>
          cls === hint ||
          cls.startsWith(`${hint}-`) ||
          cls.startsWith(`${hint}_`)
      )
  );
}

function isInsideSkippedContainer(el: HTMLElement): boolean {
  return Boolean(
    el.closest(
      [
        "pre",
        "code",
        "[role='code']",
        ".highlight",
        ".hljs",
        "code[class*='language-']",
        ".katex",
        ".MathJax",
        "mjx-container",
        "[aria-hidden='true']",
        "[contenteditable='true']",
      ].join(",")
    )
  );
}

function isLeafBlock(el: HTMLElement): boolean {
  return LEAF_BLOCK_TAGS.has(el.tagName);
}

function isBlockElement(el: HTMLElement): boolean {
  return LEAF_BLOCK_TAGS.has(el.tagName) || CONTAINER_TAGS.has(el.tagName);
}

function hasBlockChild(el: HTMLElement): boolean {
  for (const child of el.children) {
    if (child instanceof HTMLElement && isBlockElement(child)) return true;
  }
  return false;
}

function extractTextContent(el: HTMLElement): string {
  if (!el.querySelector(EXTRACT_SKIP_SELECTOR)) {
    return el.innerText?.trim() || "";
  }
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(EXTRACT_SKIP_SELECTOR).forEach((s) => s.remove());
  return clone.textContent?.trim() || "";
}

export function extractTextBlocks(root: ParentNode = document.body): TextBlock[] {
  const blocks: TextBlock[] = [];
  let _dbgVisited = 0;
  let _dbgSkipTag = 0;
  let _dbgSkipContainer = 0;
  let _dbgNonContent = 0;
  let _dbgInvisible = 0;

  function walk(node: Node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    _dbgVisited++;

    if (SKIP_TAGS.has(el.tagName)) { _dbgSkipTag++; return; }
    if (el.hasAttribute(TRANSLATE_ATTR)) return;
    if (el.hasAttribute(TRANSLATED_ELEMENT_ATTR)) return;
    if (el.id === "tom-translate-root") return;
    if (el.id === "tom-translate-progress") return;
    if (isInsideSkippedContainer(el)) { _dbgSkipContainer++; return; }
    if (isLikelyNonContent(el)) { _dbgNonContent++; return; }

    if (!isVisible(el)) { _dbgInvisible++; return; }

    if (isLeafBlock(el)) {
      if (hasBlockChild(el)) {
        for (const child of el.children) {
          walk(child);
        }
        return;
      }
      const text = extractTextContent(el);
      if (text && text.length > 1) {
        blocks.push({ element: el, text });
      }
      return;
    }

    if (!hasBlockChild(el)) {
      const text = extractTextContent(el);
      if (text && text.length > 1 && el.tagName !== "BODY" && el.tagName !== "HTML") {
        blocks.push({ element: el, text });
        return;
      }
    }

    for (const child of el.children) {
      walk(child);
    }
  }

  if (root instanceof HTMLElement) {
    walk(root);
  } else {
    walk(document.body);
  }
  console.log(
    `[TomTranslate] extractTextBlocks: visited=${_dbgVisited}, skipTag=${_dbgSkipTag}, skipContainer=${_dbgSkipContainer}, nonContent=${_dbgNonContent}, invisible=${_dbgInvisible}, blocks=${blocks.length}`
  );
  if (blocks.length > 0) {
    console.log("[TomTranslate] 首个block:", blocks[0].element.tagName, blocks[0].text.substring(0, 60));
  }
  return blocks;
}
