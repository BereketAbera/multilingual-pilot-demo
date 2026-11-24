import type { I18n, MessageValues, Unit } from '../i18n';

const UNITS: readonly string[] = ['kilogram', 'pound', 'celsius', 'fahrenheit'] satisfies Unit[];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * The API sends raw, typed values with a code. They are formatted here, for the
 * user's locale, before they go into the translated message. A value that is missing,
 * null or not in a shape this client knows is left out; the message that needed it
 * is then not used, and the server's own text is shown instead.
 */
export function problemValues(values: unknown, i18n: I18n): MessageValues {
  const formatted: MessageValues = {};
  if (!isRecord(values)) return formatted;
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string') formatted[name] = value;
    else if (typeof value === 'number') {
      if (Number.isFinite(value)) formatted[name] = i18n.number(value);
    } else if (!isRecord(value)) continue;
    else if (isRecord(value.quantity)) {
      const { value: amount, unit } = value.quantity;
      if (typeof amount === 'number' && Number.isFinite(amount) && typeof unit === 'string' && UNITS.includes(unit)) {
        formatted[name] = i18n.quantity(amount, unit as Unit);
      }
    } else if (typeof value.ratio === 'number' && Number.isFinite(value.ratio)) formatted[name] = i18n.percent(value.ratio, 0);
    else if (typeof value.date === 'string' && ISO_DATE.test(value.date)) formatted[name] = i18n.date(value.date);
  }
  return formatted;
}
