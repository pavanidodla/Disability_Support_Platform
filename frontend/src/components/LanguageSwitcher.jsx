import { useI18n } from "@/i18n";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ className = "" }) {
  const { lang, setLang, languages, t } = useI18n();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Languages className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        aria-label={t("Language")}
        className="h-9 w-full cursor-pointer rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </div>
  );
}
