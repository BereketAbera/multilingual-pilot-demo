import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Code, SampleNote } from '../../components/sample/SampleChrome';
import { ScrollArea } from '../../components/ui';
import { LOCALES, i18nFor, useI18n } from '../../i18n';
import { usePlant } from '../../lib/plant';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { usePageTitle } from '../../lib/usePageTitle';

const LANGUAGES = LOCALES.filter((locale) => !locale.developer);

/** Where a step sends the reader. The link is named for the screen it opens, in the menu's own words. */
type Place = [label: string, to: string];

/**
 * One step of the checklist: its number, what to do, what to look for, and where. On a wide
 * screen the links sit in their own column, so the list reads across like a test script. A link
 * is 44px tall at every width; in the wide layout that height reaches into the row's own
 * padding, which keeps the link on the title's line.
 */
function Try({ step, title, places, children }: { step: number; title: string; places: Place[]; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 px-4 pb-1 pt-3 lg:grid-cols-[1.25rem_minmax(0,1fr)_13.5rem] lg:gap-x-4 lg:py-3">
      <span aria-hidden="true" className="font-mono text-sm leading-[1.6] text-muted">
        {step}
      </span>
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-medium">{title}</h3>
        <p className="mt-0.5 text-muted">{children}</p>
      </div>
      <p className="col-start-2 flex flex-wrap gap-x-5 lg:col-start-3 lg:-my-3 lg:self-start">
        {places.map(([label, to]) => (
          <Link key={to} to={to} className="inline-flex min-h-11 items-center font-medium text-action underline underline-offset-2">
            {label}
          </Link>
        ))}
      </p>
    </li>
  );
}

type Row = [label: string, value: (i18n: ReturnType<typeof i18nFor>) => string];

/** The same values through the same helper module, once per language. The selected language is tinted. */
function FormatTable() {
  const current = useI18n();
  const plant = usePlant();
  const wide = useMediaQuery('(min-width: 1024px)');
  const [now] = useState(() => new Date());
  // Until the plant's settings arrive, the browser's own date stands in for the plant's.
  const today = plant?.today ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const rows: Row[] = [
    ['Date, month as a word', (i18n) => i18n.date(today)],
    ['Date and time, in plant time', (i18n) => i18n.dateTime(threeHoursAgo, plant?.timeZone ?? 'America/Chicago')],
    ['Number', (i18n) => i18n.number(1250.5)],
    ['Quantity, in this plant’s unit', (i18n) => i18n.quantity(1250.5, plant?.units.mass ?? 'kilogram')],
    ['Quantity, for a plant set to pounds', (i18n) => i18n.quantity(1250.5, 'pound')],
    ['Temperature', (i18n) => i18n.quantity(88.5, plant?.units.temperature ?? 'celsius')],
    ['Temperature, for a plant set to Fahrenheit', (i18n) => i18n.quantity(190, 'fahrenheit')],
    ['Percent', (i18n) => i18n.percent(0.966)],
    ['Relative time', (i18n) => i18n.relativeTime(threeHoursAgo, now)],
    ['Count of 0', (i18n) => i18n.t('lot:trace.forward.count', { count: 0 })],
    ['Count of 1', (i18n) => i18n.t('lot:trace.forward.count', { count: 1 })],
    ['Count of 3', (i18n) => i18n.t('lot:trace.forward.count', { count: 3 })],
  ];

  if (!wide) {
    // On a phone or tablet: one block per value with the three languages under each other, so nothing is off to the side.
    return (
      <ul className="divide-y divide-line rounded-lg border border-line bg-white" data-testid="format-table">
        {rows.map(([label, value]) => (
          <li key={label} className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <dl className="mt-1 space-y-1">
              {LANGUAGES.map((language) => {
                const selected = language.code === current.locale;
                return (
                  <div key={language.code} className={`flex flex-wrap items-baseline justify-between gap-x-4 rounded px-2 py-1 ${selected ? 'bg-action-tint' : ''}`}>
                    <dt className={`text-sm ${selected ? 'font-medium text-action' : 'text-muted'}`} lang={language.code}>
                      {language.label}
                    </dt>
                    <dd className={`tabular-nums ${selected ? 'font-medium' : ''}`} lang={language.code}>
                      {value(i18nFor(language.code))}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ScrollArea className="overflow-hidden rounded-lg border border-line bg-white" label="Formats in each language">
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
    </ScrollArea>
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

      <h2 className="mb-1 text-lg">What each language does to the same values</h2>
      <p className="mb-3 max-w-3xl text-muted">
        Switch the language, top right, and the tinted column follows. Units belong to the plant, not to the language: the
        number changes its separators, never its unit.
      </p>
      <FormatTable />

      <h2 className="mb-3 mt-8 text-lg">Eight things to try</h2>
      <ol className="divide-y divide-line rounded-lg border border-line bg-white" data-testid="try-list">
        <Try step={1} title="Switch the language, top right" places={[['Production orders', '/orders']]}>
          Each language is named in its own language. The choice is saved and goes to the API as <Code>Accept-Language</Code>.
        </Try>
        <Try step={2} title="Read a date and a number" places={[['Production orders', '/orders']]}>
          The month is a word and only the separators change. Product and supplier names are data and stay as entered; one
          product is in Spanish.
        </Try>
        <Try step={3} title="Open a lot that is on hold" places={[['Lot CF-26-0426', '/lots/CF-26-0426']]}>
          A failed check, no shipments, a history in relative time. Times of day carry the plant’s time zone.
        </Try>
        <Try step={4} title="Type a number your way" places={[['Record output', '/record-output']]}>
          Type 1.250,5 in Portuguese or 1,250.5 in English. The form repeats the number exactly and sends a JSON number.
        </Try>
        <Try step={5} title="Let the server say no" places={[['Record output', '/record-output']]}>
          Press “Lot on hold” above the form. The API sends a code, the client translates it, and the raw response is beside it.
        </Try>
        <Try step={6} title="See what a missing translation looks like" places={[['Production orders', '/orders']]}>
          Choose Português (Brasil): five strings are left in English on purpose, underlined. “Mark fallbacks” in the header,
          or in the menu on a phone, hides the underline.
        </Try>
        <Try step={7} title="Switch to the pseudo-locale" places={[['Receiving', '/receiving']]}>
          Under Developer in the selector: a made-up language used to spot text that was missed and layouts that break when
          words get longer.
        </Try>
        <Try
          step={8}
          title="Read the status page and the handoff"
          places={[
            ['Translation status', '/translation-status'],
            ['Handoff', '/handoff'],
          ]}
        >
          What is translated, missing and unused; and the steps to add a language, enable a screen and check it in staging.
        </Try>
      </ol>

      <h2 className="mb-3 mt-8 text-lg">What is real here, and what is a stand-in</h2>
      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <p>
          <strong className="font-semibold">Real.</strong> The React setup: one small module in front of the i18n library, one
          translation file per screen, the English fallback, the formatting helpers, the number parser, the checks that run in
          the build and the tests.
        </p>
        <p>
          <strong className="font-semibold">Stand-in.</strong> The API: a few serverless functions that answer the way an
          ASP.NET Core API would; no .NET code was written. The Spanish and Portuguese text: written for this sample from a
          glossary and not reviewed by a native speaker, where yours would come from your translators. All of the data.
        </p>
        <p>
          <strong className="font-semibold">What the real milestone adds.</strong> The same work inside your codebase, with
          the localization approach it already has: a string inventory of the agreed screens, the checks in your Azure DevOps
          pipeline, the backend messages those screens can show, and a staging pass in three languages.{' '}
          <Link to="/handoff" className="text-action underline underline-offset-2">
            More on the Handoff page.
          </Link>
        </p>
      </div>
    </div>
  );
}
