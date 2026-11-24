import { useI18n, type DatePart, type MessageKey } from '../i18n';
import { daysInMonth } from '../lib/plainDate';

const PART_LABEL: Record<DatePart, MessageKey> = {
  day: 'common:date.day',
  month: 'common:date.month',
  year: 'common:date.year',
};

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);
const two = (value: number) => String(value).padStart(2, '0');

type Parts = Record<DatePart, string>;

/** "2026-11-24" into its parts. A date still being chosen keeps its gaps: "2026--24". */
function split(value: string): Parts {
  const [year = '', month = '', day = ''] = value.split('-');
  return { year, month, day };
}

function join(parts: Parts): string {
  return parts.year || parts.month || parts.day ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

interface DateFieldProps {
  id: string;
  name: string;
  /** A plain date, YYYY-MM-DD, or a partly chosen one. Use completeDate() to read it. */
  value: string;
  /** The years on offer, which is also the first guard against a mistyped century. */
  years: number[];
  onChange: (value: string) => void;
  /** The id of the visible label, which names the group of three. */
  labelledBy: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

/**
 * A date as three lists: day, month and year, in the order the app's language writes them,
 * with the month as a word. The browser's own date input follows the browser's language,
 * not the app's, and shows 11/24/2026 or 24/11/2026 depending on the machine; on a
 * best-before date that is the ambiguity this field is here to remove.
 */
export function DateField({ id, name, value, years, onChange, labelledBy, ...aria }: DateFieldProps) {
  const i18n = useI18n();
  const parts = split(value);
  const chosenYear = Number(parts.year);
  const yearOptions = parts.year && !years.includes(chosenYear) ? [...years, chosenYear].sort((a, b) => a - b) : years;
  const dayCount = daysInMonth(parts.year, parts.month);

  const change = (part: DatePart, next: string) => {
    const changed = { ...parts, [part]: next };
    // A day the new month does not have is cleared, never moved to another date.
    if (changed.day && Number(changed.day) > daysInMonth(changed.year, changed.month)) changed.day = '';
    onChange(join(changed));
  };

  const options: Record<DatePart, Array<{ value: string; label: string }>> = {
    day: Array.from({ length: dayCount }, (_, index) => ({ value: two(index + 1), label: i18n.number(index + 1) })),
    month: MONTHS.map((month) => ({ value: two(month), label: i18n.monthName(month) })),
    year: yearOptions.map((year) => ({ value: String(year), label: String(year) })),
  };
  const width: Record<DatePart, string> = { day: 'flex-[2]', month: 'flex-[4]', year: 'flex-[3]' };

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex gap-2">
      {i18n.datePartOrder.map((part, index) => (
        <select
          key={part}
          id={index === 0 ? id : undefined}
          name={`${name}-${part}`}
          aria-label={i18n.t(PART_LABEL[part])}
          aria-describedby={aria['aria-describedby']}
          aria-invalid={aria['aria-invalid']}
          className={`control min-w-0 px-2 ${width[part]}`}
          value={parts[part]}
          onChange={(event) => change(part, event.target.value)}
        >
          <option value="">{i18n.t(PART_LABEL[part])}</option>
          {options[part].map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
