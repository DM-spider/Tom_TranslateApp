"use client";

import { ChevronDown } from "lucide-react";

interface LanguageSelectProps {
  value: string;
  onChange: (value: string) => void;
  languages: Record<string, string>;
  excludeAuto?: boolean;
  disabled?: boolean;
  label: string;
}

export function LanguageSelect({
  value,
  onChange,
  languages,
  excludeAuto = false,
  disabled = false,
  label,
}: LanguageSelectProps) {
  const entries = Object.entries(languages).filter(
    ([code]) => !(excludeAuto && code === "auto")
  );

  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2 pr-8 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {entries.map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
    </div>
  );
}
