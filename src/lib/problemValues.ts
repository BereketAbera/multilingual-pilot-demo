import type { I18n, MessageValues } from '../i18n';
import type { ProblemValue } from './api';

/**
 * The API sends raw, typed values with a code. They are formatted here, for the
 * user's locale, before they go into the translated message.
 */
export function problemValues(values: Record<string, ProblemValue>, i18n: I18n): MessageValues {
  const formatted: MessageValues = {};
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string') formatted[name] = value;
    else if (typeof value === 'number') formatted[name] = i18n.number(value);
    else if ('quantity' in value) formatted[name] = i18n.quantity(value.quantity.value, value.quantity.unit);
    else if ('ratio' in value) formatted[name] = i18n.percent(value.ratio, 0);
    else if ('date' in value) formatted[name] = i18n.date(value.date);
  }
  return formatted;
}
