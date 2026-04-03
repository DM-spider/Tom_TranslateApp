"use client";

import { Sparkles, Globe, Languages, Cpu } from "lucide-react";
import type { EngineType } from "shared";

interface EngineSwitchProps {
  value: EngineType;
  onChange: (value: EngineType) => void;
  disabled?: boolean;
}

const ENGINES: { id: EngineType; label: string; icon: typeof Sparkles }[] = [
  { id: "libre", label: "机器翻译（免费）", icon: Cpu },
  { id: "deepseek", label: "DeepSeek", icon: Sparkles },
  { id: "gemini", label: "Gemini", icon: Globe },
  { id: "baidu", label: "百度翻译", icon: Languages },
];

export function EngineSwitch({
  value,
  onChange,
  disabled = false,
}: EngineSwitchProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
      {ENGINES.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        const itemDisabled = disabled || id === "baidu";
        return (
          <button
            key={id}
            onClick={() => !itemDisabled && onChange(id)}
            disabled={itemDisabled}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
              active
                ? "bg-white text-blue-600 shadow-sm"
                : itemDisabled
                  ? "cursor-not-allowed text-gray-300"
                  : "text-gray-500 hover:text-gray-700"
            }`}
            title={id === "baidu" ? "百度引擎暂未实现" : undefined}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
