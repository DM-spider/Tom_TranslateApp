import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Tom Translate",
    description: "划词翻译 & 整页翻译浏览器扩展",
    permissions: ["activeTab", "storage", "contextMenus"],
    host_permissions: ["<all_urls>"],
    commands: {
      "translate-page": {
        suggested_key: { default: "Alt+A" },
        description: "翻译当前页面",
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
