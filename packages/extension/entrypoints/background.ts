import type { ExtensionMessage, ExtensionResponse } from "shared";
import { getSettings, saveSettings, type ExtensionSettings } from "@/utils/settings";
import { translateText, translateBatch } from "@/utils/api";

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: ExtensionResponse) => void
    ) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((err: Error) => {
          sendResponse({
            type: "ERROR",
            payload: { message: err.message },
          });
        });

      return true;
    }
  );

  // ---- 右键菜单 ----
  chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "tom-translate-selection",
      title: "翻译选中文字",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: "tom-translate-page",
      title: "翻译整个页面",
      contexts: ["page"],
    });
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab?.id) return;

    if (info.menuItemId === "tom-translate-selection" && info.selectionText) {
      const settings = await getSettings();
      try {
        const result = await translateText({
          text: info.selectionText,
          targetLang: settings.defaultTargetLang,
          engine: settings.defaultEngine,
          apiUrl: settings.apiUrl,
        });
        await chrome.tabs.sendMessage(tab.id, {
          type: "SHOW_TRANSLATION",
          payload: {
            original: info.selectionText,
            translated: result.translatedTexts[0] || "",
            engine: result.engineUsed,
          },
        });
      } catch (err) {
        console.warn("[TomTranslate] context menu translate failed:", err);
      }
    } else if (info.menuItemId === "tom-translate-page") {
      await chrome.tabs.sendMessage(tab.id, {
        type: "TRANSLATE_PAGE",
        payload: null,
      });
    }
  });

  // ---- 快捷键 ----
  chrome.commands.onCommand.addListener(async (command) => {
    if (command === "translate-page") {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "TRANSLATE_PAGE",
          payload: null,
        });
      }
    }
  });
});

async function handleMessage(
  message: ExtensionMessage
): Promise<ExtensionResponse> {
  const settings = await getSettings();

  switch (message.type) {
    case "TRANSLATE_SELECTION": {
      const payload = message.payload as {
        text: string;
        targetLang?: string;
        engine?: string;
      };
      const result = await translateText({
        text: payload.text,
        targetLang: payload.targetLang || settings.defaultTargetLang,
        engine: payload.engine || settings.defaultEngine,
        apiUrl: settings.apiUrl,
      });
      return { type: "TRANSLATE_RESULT", payload: result };
    }

    case "TRANSLATE_BATCH": {
      const payload = message.payload as {
        texts: string[];
        targetLang?: string;
        engine?: string;
      };
      const result = await translateBatch({
        texts: payload.texts,
        targetLang: payload.targetLang || settings.defaultTargetLang,
        engine: payload.engine || settings.defaultEngine,
        apiUrl: settings.apiUrl,
      });
      return { type: "TRANSLATE_RESULT", payload: result };
    }

    case "GET_SETTINGS":
      return { type: "SETTINGS", payload: settings };

    case "SAVE_SETTINGS": {
      const updated = await saveSettings(
        message.payload as Partial<ExtensionSettings>
      );
      return { type: "SETTINGS", payload: updated };
    }

    default:
      throw new Error(`未知的消息类型: ${message.type}`);
  }
}
