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
          apiKey: settings.apiKey,
          authToken: settings.authToken,
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
    console.log("[TomTranslate] command received:", command);
    if (command === "translate-page") {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      console.log("[TomTranslate] active tab:", tab?.id, tab?.url);
      if (tab?.id) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: "TRANSLATE_PAGE",
            payload: null,
          });
          console.log("[TomTranslate] TRANSLATE_PAGE sent OK");
        } catch (err) {
          console.error("[TomTranslate] sendMessage failed:", err);
        }
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
        apiKey: settings.apiKey,
        authToken: settings.authToken,
      });
      return { type: "TRANSLATE_RESULT", payload: result };
    }

    case "TRANSLATE_BATCH": {
      const payload = message.payload as {
        texts: string[];
        targetLang?: string;
        engine?: string;
      };
      const targetLang = payload.targetLang || settings.defaultTargetLang;
      const engine = payload.engine || settings.defaultEngine;

      const result = await translateBatch({
        texts: payload.texts,
        targetLang,
        engine,
        apiUrl: settings.apiUrl,
        apiKey: settings.apiKey,
        authToken: settings.authToken,
      });

      if (result.translatedTexts.length !== payload.texts.length) {
        console.warn(
          "[TomTranslate] batch size mismatch, fallback to single for missing:",
          {
            input: payload.texts.length,
            output: result.translatedTexts.length,
          }
        );
        const merged = [...result.translatedTexts];
        // 仅对缺失的索引发起单条翻译，已有结果的保留
        const missingIndices: number[] = [];
        for (let i = merged.length; i < payload.texts.length; i++) {
          missingIndices.push(i);
        }
        if (missingIndices.length > 0) {
          const fallbackResults = await Promise.all(
            missingIndices.map(async (idx) => {
              try {
                const single = await translateText({
                  text: payload.texts[idx],
                  targetLang,
                  engine,
                  apiUrl: settings.apiUrl,
                  apiKey: settings.apiKey,
                  authToken: settings.authToken,
                });
                return single.translatedTexts[0] || "";
              } catch {
                return "";
              }
            })
          );
          for (let j = 0; j < missingIndices.length; j++) {
            merged[missingIndices[j]] = fallbackResults[j];
          }
        }
        // 截断多余的结果
        merged.length = payload.texts.length;

        return {
          type: "TRANSLATE_RESULT",
          payload: {
            ...result,
            translatedTexts: merged,
          },
        };
      }
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
