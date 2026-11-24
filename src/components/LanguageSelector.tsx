import { Languages } from 'lucide-react';
import { LOCALES, setLocale, useI18n, type LocaleCode } from '../i18n';

/**
 * Each language is named in its own language, with no flags. The choice is saved,
 * sets the page's lang attribute and goes out as Accept-Language on every API call.
 */
export function LanguageSelector() {
  const { locale, t } = useI18n();
  return (
    <label className="flex items-center gap-2">
      <Languages aria-hidden="true" className="size-5 shrink-0 text-muted" />
      <span className="sr-only">{t('common:header.language')}</span>
      <select
        data-testid="language"
        value={locale}
        onChange={(event) => void setLocale(event.target.value as LocaleCode)}
        className="control w-auto max-w-[12.5rem] py-1.5 font-medium"
      >
        {LOCALES.filter((entry) => !entry.developer).map((entry) => (
          <option key={entry.code} value={entry.code} lang={entry.code}>
            {entry.label}
          </option>
        ))}
        {/* Developer tooling: this divider is English on purpose. */}
        <optgroup label="Developer">
          {LOCALES.filter((entry) => entry.developer).map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.label}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
