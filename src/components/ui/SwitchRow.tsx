import React from "react";
import Toggle from "./Toggle";

interface SwitchRowProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

const SwitchRow: React.FC<SwitchRowProps> = ({
  checked,
  onChange,
  label,
  description,
  icon,
  disabled = false,
}) => (
  <div
    onClick={() => !disabled && onChange(!checked)}
    className={`flex items-center justify-between cursor-pointer group p-4 rounded-2xl border transition duration-200 
            ${
              checked
                ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500/50"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700"
            }
            ${disabled ? "opacity-60 cursor-not-allowed" : ""}
        `}
  >
    <div className="flex items-center gap-3 pr-4">
      {icon && (
        <div
          className={`p-2 rounded-lg transition-colors ${checked ? "bg-blue-100 text-blue-600 dark:bg-blue-800 dark:text-blue-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}
        >
          <span className="material-icons !text-xl">{icon}</span>
        </div>
      )}
      <div>
        <span
          className={`text-sm font-bold transition-colors ${checked ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-200"}`}
        >
          {label}
        </span>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
            {description}
          </p>
        )}
      </div>
    </div>

    <Toggle checked={checked} onChange={onChange} disabled={disabled} size="md" />
  </div>
);

export default SwitchRow;
