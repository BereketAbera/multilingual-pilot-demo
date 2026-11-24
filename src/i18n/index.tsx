// The public face of localization. Screens import from here and nowhere else:
// useI18n() gives t for text, date, dateTime, number, quantity, percent and relativeTime
// for values, and parseNumber for input; Msg is for visible text.
// The library behind it (i18next) is named only in instance.ts and this file.

import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { SOURCE_LOCALE, STORAGE_KEY, isLocaleCode, localeConfig, type LocaleCode } from './config';
import {
  datePartOrder,
  formatDate,
  formatDateInYear,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatRelativeDays,
  formatRelativeTime,
  monthName,
  unitSymbol,
  type DatePart,
  type Unit,
} from './format';
import { i18n } from './instance';
import type { MessageKey, MessageValues } from './keys';
import { parseNumber } from './parseNumber';
import { fallbackCount, hasOwnMessage, messagePlaceholders } from './resources';

export { LOCALES, type LocaleCode } from './config';
export type { MessageKey, MessageValues } from './keys';
export type { DatePart, Unit } from './format';
export { fractionDigits } from './format';

const REVIEW_KEY = 'pilot.markFallbacks';

interface ReviewState {
  markFallbacks: boolean;
  setMarkFallbacks: (value: boolean) => void;
}

const ReviewContext = createContext<ReviewState>({ markFallbacks: true, setMarkFallbacks: () => undefined });

function readReviewSetting(): boolean {
  try {
    return globalThis.localStorage?.getItem(REVIEW_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [markFallbacks, setMark] = useState(readReviewSetting);
  const setMarkFallbacks = useCallback((value: boolean) => {
    setMark(value);
    try {
      globalThis.localStorage?.setItem(REVIEW_KEY, value ? 'on' : 'off');
    } catch {
      // Not saved; the setting still applies to this page view.
    }
  }, []);
  const review = useMemo(() => ({ markFallbacks, setMarkFallbacks }), [markFallbacks, setMarkFallbacks]);

  return (
    <I18nextProvider i18n={i18n}>
      <ReviewContext.Provider value={review}>
        <LangAttribute />
        {children}
      </ReviewContext.Provider>
    </I18nextProvider>
  );
}

/** Keeps <html lang> in step with the selector, for screen readers and hyphenation. */
function LangAttribute() {
  const { locale } = useI18n();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

export function useReview(): ReviewState {
  return useContext(ReviewContext);
}

export function getLocale(): LocaleCode {
  return isLocaleCode(i18n.language) ? i18n.language : SOURCE_LOCALE;
}

export async function setLocale(locale: LocaleCode): Promise<void> {
  await i18n.changeLanguage(locale);
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, locale);
  } catch {
    // Not saved; the choice still applies to this page view.
  }
}

/** The value for Accept-Language on API calls. */
export function acceptLanguage(): string {
  return localeConfig(getLocale()).acceptLanguage;
}

function splitKey(key: string): [namespace: string, name: string] {
  const index = key.indexOf(':');
  return [key.slice(0, index), key.slice(index + 1)];
}

export interface I18n {
  locale: LocaleCode;
  formatLocale: string;
  /** Translates a message. Falls back to English when the language does not have it yet. */
  t: (key: MessageKey, values?: MessageValues) => string;
  /** True when t would answer in English because the translation is missing. */
  isFallback: (key: MessageKey, count?: number) => boolean;
  /**
   * Translates a code sent by the API. Null when this client has no text for it, or when
   * the text needs a value the API did not send: the caller then shows the server's own text.
   */
  tCode: (code: string, values?: MessageValues) => { text: string; fallback: boolean } | null;
  /** How many messages this language does not have yet and shows in English. */
  fallbackCount: number;
  date: (isoDate: string) => string;
  /** A date in a list, without the year while it is the same as the reference date's. */
  dateInYear: (isoDate: string, referenceIsoDate?: string) => string;
  dateTime: (instant: string | Date, timeZone?: string) => string;
  /** Day, month and year in the order this language writes them, and the months as words, for a date field. */
  datePartOrder: DatePart[];
  monthName: (month: number) => string;
  number: (value: number, maximumFractionDigits?: number) => string;
  percent: (ratio: number, minimumFractionDigits?: number) => string;
  quantity: (value: number, unit: Unit, maximumFractionDigits?: number) => string;
  unit: (unit: Unit) => string;
  relativeTime: (instant: string | Date, now?: Date) => string;
  relativeDays: (isoDate: string, todayIso: string) => string;
  parseNumber: (input: string) => number | null;
}

function createI18n(locale: LocaleCode): I18n {
  const { formatLocale } = localeConfig(locale);
  const translate = i18n.getFixedT(locale);
  const isFallback = (key: string, count?: number) => {
    if (locale === SOURCE_LOCALE) return false;
    const [namespace, name] = splitKey(key);
    return !hasOwnMessage(locale, namespace, name, count);
  };
  return {
    locale,
    formatLocale,
    t: (key, values) => translate(key, values ?? {}),
    isFallback,
    tCode: (code, values) => {
      if (typeof code !== 'string' || !hasOwnMessage(SOURCE_LOCALE, 'errors', code)) return null;
      const key = `errors:${code}`;
      const supplied = values ?? {};
      const own = hasOwnMessage(locale, 'errors', code) ? locale : SOURCE_LOCALE;
      if (messagePlaceholders(own, 'errors', code).some((name) => !Object.hasOwn(supplied, name))) return null;
      return { text: translate(key, supplied), fallback: isFallback(key) };
    },
    fallbackCount: fallbackCount(locale, SOURCE_LOCALE),
    date: (isoDate) => formatDate(isoDate, formatLocale),
    dateInYear: (isoDate, reference) => formatDateInYear(isoDate, reference, formatLocale),
    dateTime: (instant, timeZone) => formatDateTime(instant, formatLocale, timeZone),
    datePartOrder: datePartOrder(formatLocale),
    monthName: (month) => monthName(month, formatLocale),
    number: (value, digits) => formatNumber(value, formatLocale, digits),
    percent: (ratio, digits) => formatPercent(ratio, formatLocale, digits),
    quantity: (value, unit, digits) => formatQuantity(value, unit, formatLocale, digits),
    unit: (unit) => unitSymbol(unit, formatLocale),
    relativeTime: (instant, now = new Date()) => formatRelativeTime(instant, now, formatLocale),
    relativeDays: (isoDate, todayIso) => formatRelativeDays(isoDate, todayIso, formatLocale),
    parseNumber: (input) => parseNumber(input, formatLocale),
  };
}

/** The same helpers for a named language, for places that show several side by side. */
export function i18nFor(locale: LocaleCode): I18n {
  return createI18n(locale);
}

export function useI18n(): I18n {
  const { i18n: instance } = useTranslation(undefined, { i18n });
  const locale = isLocaleCode(instance.language) ? instance.language : SOURCE_LOCALE;
  return useMemo(() => createI18n(locale), [locale]);
}

interface MsgProps {
  id: MessageKey;
  values?: MessageValues;
  /** Elements to place inside the sentence, by placeholder name: a code in mono, a link. */
  nodes?: Record<string, ReactNode>;
}

const NODE_MARK = /\uE000(\w+)\uE001/;

/**
 * Visible text. When the language has no translation yet it shows the English text,
 * marked lang="en" for screen readers and, in review mode, with a dotted underline.
 * The translator decides where a node goes in the sentence; the code never joins pieces.
 */
export function Msg({ id, values, nodes }: MsgProps) {
  const { t, isFallback } = useI18n();
  const { markFallbacks } = useReview();
  const marks = Object.fromEntries(Object.keys(nodes ?? {}).map((name) => [name, `\uE000${name}\uE001`]));
  const text = t(id, { ...values, ...marks });
  const content: ReactNode = nodes
    ? text.split(NODE_MARK).map((part, index) => (index % 2 === 1 ? <Fragment key={index}>{nodes[part]}</Fragment> : part))
    : text;
  const count = typeof values?.count === 'number' ? values.count : undefined;
  if (!isFallback(id, count)) return <>{content}</>;
  return (
    <span
      lang="en"
      data-fallback={id}
      className={markFallbacks ? 'i18n-fallback' : undefined}
      title={markFallbacks ? `Not translated yet: ${id}` : undefined}
    >
      {content}
    </span>
  );
}
