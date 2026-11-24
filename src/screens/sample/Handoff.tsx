import type { ReactNode } from 'react';
import { Code, SampleNote, ToolTag } from '../../components/sample/SampleChrome';
import { usePageTitle } from '../../lib/usePageTitle';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8 scroll-mt-4">
      <h2 id={id} className="mb-3 text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-3 rounded-lg border border-line bg-white py-4 pl-9 pr-4 marker:font-semibold">{children}</ol>;
}

function Block({ children, label }: { children: string; label: string }) {
  return (
    <pre tabIndex={0} aria-label={label} className="overflow-x-auto rounded-lg border border-line bg-white p-3 font-mono text-[0.8125rem] leading-relaxed">
      {children}
    </pre>
  );
}

const CONTENTS = [
  ['real', 'What is real, what is a stand-in'],
  ['run', 'Run and test'],
  ['language', 'Add a language'],
  ['screen', 'Enable another screen'],
  ['backend', 'Messages from the backend'],
  ['libraries', 'The same steps in three libraries'],
  ['glossary', 'Glossary'],
  ['tests', 'Tests'],
] as const;

const LIBRARIES: Array<[string, string, string, string]> = [
  [
    'One file per screen',
    'Namespaces: locales/<language>/<screen>.json, with a shared "common" file',
    'One JSON per locale (or per route) that you import and pass to IntlProvider',
    'One catalog per locale, loaded with a dynamic import()',
  ],
  [
    'English fallback',
    'fallbackLng: "en". None is set by default',
    'defaultMessage on each message, then the id',
    'fallbackLocales in the config',
  ],
  [
    'Values and plurals',
    '{{name}}; plural keys _one, _other, chosen by Intl.PluralRules',
    'ICU MessageFormat',
    'ICU MessageFormat, written through macros',
  ],
  [
    'List what is not translated',
    'pnpm i18n:check here; i18next-cli status does the same job',
    'formatjs verify --missing-keys',
    'lingui extract prints the counts',
  ],
  [
    'Fail the build',
    'pnpm i18n:check, and --strict before a release',
    'formatjs verify --structural-equality catches a dropped placeholder',
    'lingui compile --strict, lingui check missing, lingui check sync',
  ],
  [
    'Pseudo-locale',
    'Generated as an ordinary locale folder: pnpm i18n:pseudo',
    'formatjs compile --pseudo-locale en-XA',
    'pseudoLocale in the config',
  ],
  [
    'Find hard-coded text',
    'eslint-plugin-i18next (no-literal-string), or i18next-cli lint',
    'eslint-plugin-formatjs (no-literal-string-in-jsx)',
    'Not checked for this sample',
  ],
  [
    'Typed keys',
    'Typed from the English files (keys.ts here), or i18next-cli types',
    'Declare FormatjsIntl.Message.ids',
    'Messages are the source strings, so there is no key to mistype',
  ],
  [
    'Screen tests',
    'A real instance with the real files',
    'Render inside IntlProvider with the real messages',
    'Render inside I18nProvider with a compiled catalog',
  ],
  ['Dates and numbers', 'The browser’s Intl API behind one helper file. The same in all three.', '', ''],
];

interface Term {
  en: string;
  es: string;
  esConfirm?: boolean;
  pt: string;
  ptConfirm?: boolean;
}

// Terms marked "confirm" were not checked against a published source for this sample.
const GLOSSARY: Term[] = [
  { en: 'Production order', es: 'Orden de producción', pt: 'Ordem de produção' },
  { en: 'Lot', es: 'Lote', pt: 'Lote' },
  { en: 'Traceability', es: 'Trazabilidad', pt: 'Rastreabilidade' },
  { en: 'Trace back / trace forward', es: 'Hacia atrás / hacia adelante', esConfirm: true, pt: 'Para trás / para frente', ptConfirm: true },
  { en: 'Raw material', es: 'Materia prima', pt: 'Matéria-prima' },
  { en: 'Yield', es: 'Rendimiento', esConfirm: true, pt: 'Rendimento' },
  { en: 'Shrink', es: 'Merma', esConfirm: true, pt: 'Perdas (also “quebra”)', ptConfirm: true },
  { en: 'Best-before date', es: 'Fecha de caducidad', pt: 'Data de validade' },
  { en: 'On hold', es: 'En retención', esConfirm: true, pt: 'Retido / retida', ptConfirm: true },
  { en: 'Released', es: 'Liberado', esConfirm: true, pt: 'Liberado', ptConfirm: true },
  { en: 'Quarantine', es: 'Cuarentena', pt: 'Quarentena', ptConfirm: true },
  { en: 'HACCP', es: 'HACCP', esConfirm: true, pt: 'APPCC', ptConfirm: true },
  { en: 'Critical control point', es: 'Punto crítico de control', pt: 'Ponto crítico de controle', ptConfirm: true },
  { en: 'Corrective action', es: 'Acción correctiva', pt: 'Ação corretiva', ptConfirm: true },
  { en: 'Supplier', es: 'Proveedor', pt: 'Fornecedor' },
  { en: 'Receiving', es: 'Recepción', esConfirm: true, pt: 'Recebimento', ptConfirm: true },
  { en: 'Shipment', es: 'Envío', pt: 'Expedição', ptConfirm: true },
  { en: 'Quality control', es: 'Control de calidad', pt: 'Controle de qualidade' },
  { en: 'Record output', es: 'Registrar producción', esConfirm: true, pt: 'Registrar produção (shop floor may say “apontamento”)', ptConfirm: true },
  { en: 'Pass / fail (a check)', es: 'Cumple / no cumple', esConfirm: true, pt: 'Conforme / não conforme', ptConfirm: true },
  { en: 'Planned (an order)', es: 'Planeada', esConfirm: true, pt: 'Planejada', ptConfirm: true },
];

function Confirm() {
  return (
    <span className="ml-2 inline-block">
      <ToolTag>to confirm with your translators</ToolTag>
    </span>
  );
}

export default function Handoff() {
  usePageTitle('Handoff');
  return (
    <div className="max-w-4xl">
      <SampleNote title="Handoff">
        <p>
          How this sample is put together, and how a team would run it, add a language to it and move another screen onto it. In a
          real project this is the document that travels with the pull request.
        </p>
      </SampleNote>

      <nav aria-label="On this page" className="rounded-lg border border-line bg-white p-4">
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {CONTENTS.map(([id, title]) => (
            <li key={id}>
              <a href={`#${id}`} className="inline-flex min-h-9 items-center text-action underline underline-offset-2">
                {title}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="real" title="What is real, what is a stand-in">
        <div className="space-y-3 rounded-lg border border-line bg-white p-4">
          <p>
            <strong className="font-semibold">Real.</strong> The React side. Screens talk to one small module (<Code>src/i18n</Code>)
            and never to the library behind it. That module gives them <Code>t</Code> and <Code>Msg</Code> for text,{' '}
            <Code>formatDate</Code>, <Code>formatNumber</Code>, <Code>formatQuantity</Code>, <Code>formatPercent</Code> and{' '}
            <Code>formatRelativeTime</Code> for values, and <Code>parseNumber</Code> for input. The translation files, the English
            fallback, the checks in the build and the tests all work as described on this page.
          </p>
          <p>
            <strong className="font-semibold">Stand-in.</strong> The API is a few serverless functions that answer the way an
            ASP.NET Core API would: JSON, problem details with a stable <Code>code</Code> and its <Code>values</Code>, and the
            request’s language read from <Code>Accept-Language</Code>. It stores nothing. The Spanish and Portuguese text was
            written for this sample; yours would come from your translators. The app, the plant and all data are invented.
          </p>
          <p>
            <strong className="font-semibold">What the real first milestone adds.</strong> The same work in your codebase, using
            the localization approach it already has where practical: a count of the strings on the agreed screens on day one,
            the checks wired into your pipeline, a list of the backend messages those screens can show and who translates them,
            a staging pass in English, Spanish and Brazilian Portuguese, and this handoff in the pull request.
          </p>
        </div>
      </Section>

      <Section id="run" title="Run and test">
        <Block label="Commands">{`pnpm install
pnpm dev                    # the app and the stand-in API on http://localhost:3901
pnpm i18n:check             # checks the translation files; runs as part of pnpm build
pnpm i18n:check --strict    # also fails while anything would fall back; for a release
pnpm i18n:pseudo            # rewrites the pseudo-locale after an English change
pnpm lint                   # includes the hard-coded text rule on enabled screens
pnpm typecheck              # a mistyped message key fails here
pnpm test                   # helpers, parser, file checks, every screen in every language
pnpm test:e2e               # one browser run per language, plus the pseudo-locale layout run`}</Block>
        <p className="mt-3 text-muted">
          The language is chosen in the header, saved in the browser and sent to the API on every call. “Mark fallbacks” is the
          review mode: it underlines English text that is standing in for a missing translation.
        </p>
      </Section>

      <Section id="language" title="Add a language">
        <p className="mb-3 text-muted">
          Five steps. They were followed once already: the pseudo-locale, <Code>en-XA</Code>, was added to this sample exactly this
          way.
        </p>
        <Steps>
          <li>
            Add one entry to <Code>src/i18n/config.ts</Code>: the code, the language’s name in that language, the region used
            for dates and numbers, and the value to send as <Code>Accept-Language</Code>.
          </li>
          <li>
            Add the folder <Code>src/i18n/locales/&lt;code&gt;/</Code> with one file per screen. For a real language these are the
            files your translators return. For the pseudo-locale, <Code>pnpm i18n:pseudo</Code> writes them. Files are picked up by
            folder; nothing else is registered.
          </li>
          <li>
            Run <Code>pnpm i18n:check</Code>. It fails on a key English does not have and on a placeholder that differs from the
            English one, and it lists what is not translated yet. Those strings show in English until the files catch up.
          </li>
          <li>
            Add the language to the tests: its code in <Code>tests/locales.ts</Code> and a row of expected formats in{' '}
            <Code>tests/unit/format.test.ts</Code>. The screen tests and the browser run then cover it.
          </li>
          <li>
            Check it in the running app, then run <Code>pnpm i18n:check --strict</Code> before the release so nothing ships in
            fallback by accident.
          </li>
        </Steps>
        <p className="mt-3 text-muted">
          Spanish here is formatted as US Spanish (<Code>es-US</Code>), which writes numbers the way English does, with the text in
          a plain <Code>es</Code> folder in Latin American wording. For a partner in Mexico, <Code>es-MX</Code> formats dates and
          numbers the same; for Spain, <Code>es-ES</Code> flips the comma and the point. Either is one value in the config.
        </p>
      </Section>

      <Section id="screen" title="Enable another screen">
        <p className="mb-3 text-muted">
          Five steps, with Receiving as the example. It is left un-enabled in this sample so the starting point is visible: hard-coded
          text, a date built by hand, a number glued to its unit.
        </p>
        <Steps>
          <li>
            Take the inventory. Add the screen’s file to the hard-coded text rule in <Code>eslint.config.mjs</Code> and run{' '}
            <Code>pnpm lint</Code>: every literal string is listed with its line. Sort them into plain labels, messages with
            values, plurals, validation, backend messages, and dates or numbers formatted by hand.
          </li>
          <li>
            Create <Code>src/i18n/locales/en/receiving.json</Code> and add <Code>receiving</Code> to the list of files in{' '}
            <Code>config.ts</Code> and <Code>keys.ts</Code>. English is the source, and keys are typed from it.
          </li>
          <li>
            Replace the literals: <Code>Msg</Code> for visible text, <Code>t</Code> for attributes, the format helpers for every
            date, number and quantity, and an explicit map from each status code to its message. Sentences are never joined from
            pieces; counts use plural keys.
          </li>
          <li>
            Add the screen to the list in <Code>tests/component/screens.test.tsx</Code>, so it renders in every language with no
            raw key showing, and to the pages in the browser run.
          </li>
          <li>
            Run <Code>pnpm i18n:pseudo</Code> and open the screen under the pseudo-locale at 1280 and 768 wide. Anything still in
            plain English is hard-coded or data; anything that overflows needs room. Then send the new English file for
            translation. Until it comes back the screen shows English, marked in review mode.
          </li>
        </Steps>
        <p className="mt-3 text-muted">
          Three things found while building these screens that are worth knowing before the next one. A status word cannot be
          shared between an order and a lot: Portuguese says “ordem retida” but “lote retido”, so they are separate messages.
          Portuguese treats zero as singular, so counts that can be zero get their own “none” message. And a sentence built around
          a time of day breaks in Spanish (“a la 1:05”, “a las 2:05”), so times are shown as a full date and time instead.
        </p>
      </Section>

      <Section id="backend" title="Messages from the backend">
        <div className="space-y-3 rounded-lg border border-line bg-white p-4">
          <p>
            The sample uses one pattern throughout: the API answers an error with problem details that carry a stable{' '}
            <Code>code</Code> (for example <Code>lot.on_hold</Code>) and typed <Code>values</Code> (a lot code, a quantity with its
            unit, a ratio). The client translates the code and formats the values for the user’s language. There is one translation
            store and one fallback: when the client has no text for a code, the user sees the server’s English{' '}
            <Code>detail</Code> and the code is listed on Translation status.
          </p>
          <p>
            Every call also sends <Code>Accept-Language</Code>, and the stand-in reads it into a request culture the way ASP.NET
            Core does. Nothing uses it yet. It is there for the text only a server can produce: emails, exports and reports.
          </p>
          <p>Dependencies to raise before work starts, because each one sits outside the React code:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Validation and model-binding messages produced by the API, which are two separate sets in ASP.NET Core.</li>
            <li>Business-rule errors returned as finished English sentences instead of codes.</li>
            <li>Status names and units stored as text in the database.</li>
            <li>Dates and numbers already formatted on the server.</li>
            <li>Emails, exports and printed documents. Printed product labels are regulated text and are best left out of scope.</li>
            <li>
              Third-party grids and date pickers, which carry their own language packs. The date fields on Record output are the
              browser’s own, and follow the browser’s language rather than the app’s; the line under each field repeats the date
              in the app’s language for that reason.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="libraries" title="The same steps in three libraries">
        <p className="mb-3 text-muted">
          The sample is built on react-i18next, the most widely used of the three. The checks and the pseudo-locale are plain
          scripts over the JSON files, so the steps above hold whichever one your app already has.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="The same steps in three libraries">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="th">Step</th>
                <th scope="col" className="th">react-i18next (this sample)</th>
                <th scope="col" className="th">FormatJS (react-intl)</th>
                <th scope="col" className="th">Lingui</th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map(([step, i18next, formatjs, lingui]) => (
                <tr key={step} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="td text-left font-medium">{step}</th>
                  {formatjs === '' ? (
                    <td className="td" colSpan={3}>{i18next}</td>
                  ) : (
                    <>
                      <td className="td">{i18next}</td>
                      <td className="td">{formatjs}</td>
                      <td className="td">{lingui}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="glossary" title="Glossary">
        <p className="mb-3 text-muted">
          The terms the sample’s Spanish and Portuguese are built on. Spanish is Latin American, Portuguese is Brazilian. Terms
          tagged in violet were not checked against a published source and should be confirmed.
        </p>
        <div className="overflow-x-auto rounded-lg border border-line bg-white" tabIndex={0} role="region" aria-label="Glossary">
          <table className="w-full min-w-[44rem] border-collapse" data-testid="glossary">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="th">English</th>
                <th scope="col" className="th">Español</th>
                <th scope="col" className="th">Português (Brasil)</th>
              </tr>
            </thead>
            <tbody>
              {GLOSSARY.map((term) => (
                <tr key={term.en} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="td text-left font-medium">{term.en}</th>
                  <td className="td">
                    <span lang="es">{term.es}</span>
                    {term.esConfirm ? <Confirm /> : null}
                  </td>
                  <td className="td">
                    <span lang="pt-BR">{term.pt}</span>
                    {term.ptConfirm ? <Confirm /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          <li>
            Spain says APPCC, “retirada” and “seguridad alimentaria” where the Americas say HACCP, “retiro” and “inocuidad”.
          </li>
          <li>Brazil says “estoque” and “controle” where Portugal says “stock” and “controlo”.</li>
          <li>“Etiqueta” is a printed tag; “rótulo” is the regulated product label.</li>
          <li>Product, raw material, supplier and customer names are data. They stay as they were entered, in every language.</li>
        </ul>
      </Section>

      <Section id="tests" title="Tests">
        <ul className="list-disc space-y-2 rounded-lg border border-line bg-white py-4 pl-9 pr-4">
          <li>
            <Code>tests/unit/format.test.ts</Code> and <Code>parseNumber.test.ts</Code>: every helper and the number parser, with
            the exact expected text for each language.
          </li>
          <li>
            <Code>tests/unit/catalog.test.ts</Code>: the file checks. A key missing from English fails; a changed placeholder
            fails; a string not translated yet is reported and fails only with <Code>--strict</Code>; the real files pass.
          </li>
          <li>
            <Code>tests/unit/api.test.ts</Code>: the stand-in API’s problem details, its codes against the published list, and how
            it reads <Code>Accept-Language</Code>.
          </li>
          <li>
            <Code>tests/component/screens.test.tsx</Code>: each pilot screen rendered in each language, with no raw key and no
            unfilled placeholder on it, and the fallback marked where a translation is missing.
          </li>
          <li>
            <Code>e2e/locale.spec.ts</Code>: in a browser, once per language: switch language, read a date and a number, submit the
            form with a number typed that language’s way, trigger the server-only rule and read the translated message.
          </li>
          <li>
            <Code>e2e/layout.spec.ts</Code> and <Code>e2e/a11y.spec.ts</Code>: under the pseudo-locale no page may scroll sideways
            at 1280 or 768 wide; every page passes an automated accessibility check; the page’s <Code>lang</Code> follows the
            selector.
          </li>
        </ul>
      </Section>
    </div>
  );
}
