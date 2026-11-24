import { ArrowRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Code, SampleNote } from '../../components/sample/SampleChrome';
import { LOCALES, i18nFor, useI18n } from '../../i18n';
import { usePlant } from '../../lib/plant';
import { usePageTitle } from '../../lib/usePageTitle';

const LANGUAGES = LOCALES.filter((locale) => !locale.developer);

function Try({ step, title, to, children }: { step: number; title: string; to?: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-lg border border-line bg-white p-4">
      <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-action-tint font-semibold text-action">
        {step}
      </span>
      <div className="min-w-0">
        <h3 className="text-base">{title}</h3>
        <p className="mt-1 text-muted">{children}</p>
        {to ? (
          <Link to={to} className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-action underline underline-offset-2">
            Open it <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function FormatTable() {
  const current = useI18n();
  const plant = usePlant();
  const today = plant?.today ?? new Date().toISOString().slice(0, 10);
  const [now] = useState(() => new Date());
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const rows: Array<[string, (i18n: ReturnType<typeof i18nFor>) => string]> = [
    ['Date, month as a word', (i18n) => i18n.date(today)],
    ['Number', (i18n) => i18n.number(1250.5)],
    ['Quantity, in the plant’s unit', (i18n) => i18n.quantity(1250.5, plant?.units.mass ?? 'kilogram')],
    ['Temperature', (i18n) => i18n.quantity(88.5, plant?.units.temperature ?? 'celsius')],
    ['Percent', (i18n) => i18n.percent(0.966)],
    ['Relative time', (i18n) => i18n.relativeTime(threeHoursAgo, now)],
    ['Count of 0', (i18n) => i18n.t('lot:trace.forward.count', { count: 0 })],
    ['Count of 1', (i18n) => i18n.t('lot:trace.forward.count', { count: 1 })],
    ['Count of 3', (i18n) => i18n.t('lot:trace.forward.count', { count: 3 })],
  ];
  return (
    <div className="scroll-x rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Formats in each language">
      <table className="w-full min-w-[40rem] border-collapse" data-testid="format-table">
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="th">One helper module, three languages</th>
            {LANGUAGES.map((language) => (
              <th key={language.code} scope="col" className={`th ${language.code === current.locale ? 'text-action' : ''}`} lang={language.code}>
                {language.label}
                {language.code === current.locale ? <span className="sr-only"> (selected)</span> : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-b border-line last:border-b-0">
              <th scope="row" className="td text-left font-normal text-muted">{label}</th>
              {LANGUAGES.map((language) => (
                <td key={language.code} lang={language.code} className={`td tabular-nums ${language.code === current.locale ? 'bg-action-tint font-medium' : ''}`}>
                  {value(i18nFor(language.code))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  usePageTitle('Multilingual pilot: a working sample');
  return (
    <div className="max-w-5xl">
      <SampleNote title="Multilingual pilot: a working sample">
        <p>
          A small, made-up production and traceability app with reusable localization built in: one shared setup, three screens
          moved onto it in English, Spanish and Brazilian Portuguese, and the checks and written handoff that keep it working when
          a team adds a language or another screen. The app, the plant and every product, lot, supplier and customer are invented.
        </p>
      </SampleNote>

      <h2 className="mb-3 text-lg">Eight things to try</h2>
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Try step={1} title="Switch the language, top right">
          Each language is named in its own language. The choice is saved, sets the page’s <Code>lang</Code> attribute and goes to
          the API as <Code>Accept-Language</Code> on every call.
        </Try>
        <Try step={2} title="Read a date and a number" to="/orders">
          On Production orders, dates show the month as a word, because 11/24/2026 and 24/11/2026 are the same day in two of these
          languages. Quantities stay in the plant’s unit; only the separators change. Filter until nothing matches to see the
          zero plural.
        </Try>
        <Try step={3} title="Open a lot that is on hold" to="/lots/CF-26-0426">
          Lot CF-26-0426 has a failed check, no shipments and a history in relative time. Statuses are an icon, a word and a
          colour.
        </Try>
        <Try step={4} title="Type a number your way" to="/record-output">
          On Record output, type 1.250,5 in Portuguese or 1,250.5 in English or Spanish. The form repeats how it read the number
          and the date, and sends a JSON number and an ISO date.
        </Try>
        <Try step={5} title="Let the server say no" to="/record-output">
          Choose order PO-26-1185: its lot is on hold, a rule only the server knows. The response carries a code and the client
          translates it; the raw response is shown beside the message. Order PO-26-1187 returns a code the client has no text for.
        </Try>
        <Try step={6} title="See what a missing translation looks like">
          Five Portuguese strings are left untranslated on purpose. They appear in English with a dotted violet underline. The
          “Mark fallbacks” switch in the header turns the underline off; the English stays.
        </Try>
        <Try step={7} title="Switch to the pseudo-locale" to="/receiving">
          It sits under Developer in the language selector. Translated text turns accented and about 40% longer; Receiving, a
          screen left un-enabled on purpose, stays in plain English.
        </Try>
        <Try step={8} title="Read the status page and the handoff" to="/translation-status">
          Translation status counts what is translated, missing and unused per language. Handoff has the steps for adding a
          language and enabling another screen.
        </Try>
      </ol>

      <h2 className="mb-3 mt-8 text-lg">What each language does to the same values</h2>
      <FormatTable />

      <h2 className="mb-3 mt-8 text-lg">What is real here, and what is a stand-in</h2>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="text-base">Real</h3>
          <p className="mt-1 text-muted">
            The React setup: one small module in front of the i18n library, one translation file per screen, the English fallback,
            the formatting helpers, the number parser, the checks that run in the build and the tests.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="text-base">Stand-in</h3>
          <p className="mt-1 text-muted">
            The API: a few serverless functions that answer the way an ASP.NET Core API would. The Spanish and Portuguese text:
            written for this sample from a glossary, where yours would come from your translators. All of the data.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <h3 className="text-base">What the real milestone adds</h3>
          <p className="mt-1 text-muted">
            The same work inside your codebase, with the localization approach it already has: a string inventory of the agreed
            screens, the checks in your pipeline, the backend messages those screens can show, and a staging pass in three
            languages. <Link to="/handoff" className="text-action underline underline-offset-2">More on the Handoff page.</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
