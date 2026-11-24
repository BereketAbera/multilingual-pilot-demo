import type { ReactNode } from 'react';
import { Code, SampleNote } from '../../components/sample/SampleChrome';
import { ScrollArea } from '../../components/ui';
import { usePageTitle } from '../../lib/usePageTitle';

/** The id is on the section, with room above it, so a link from the contents list lands with the heading in view. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-8 scroll-mt-20">
      <h2 id={`${id}-title`} className="mb-3 text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="list-decimal space-y-3 rounded-lg border border-line bg-white py-4 pl-9 pr-4 marker:font-semibold">{children}</ol>;
}

const COMMANDS: Array<[command: string, note: string]> = [
  ['pnpm install', 'Node 22.12 or newer'],
  ['pnpm dev', 'the app and the stand-in API on http://localhost:3901'],
  ['pnpm i18n:check', 'checks the translation files; runs as part of pnpm build'],
  ['pnpm i18n:check --strict', 'also fails while anything would fall back; for a release'],
  ['pnpm i18n:pseudo', 'rewrites the pseudo-locale after an English change'],
  ['pnpm lint', 'includes the hard-coded text rule on enabled screens'],
  ['pnpm typecheck', 'a mistyped message key fails here'],
  ['pnpm test', 'helpers, parser, file checks, the API, every screen in every language'],
  ['pnpm exec playwright install chromium', 'once, before the first browser run'],
  ['pnpm test:e2e', 'one browser run per language, plus the layout and accessibility runs'],
  ['BASE_URL=https://… pnpm test:live', 'the same browser tests against a deployed copy, staging included'],
];

/** Each command with what it is for. On a phone the note sits above its command, so neither is cut off. */
function Commands() {
  return (
    <dl className="divide-y divide-line rounded-lg border border-line bg-white" data-testid="commands">
      {COMMANDS.map(([command, note]) => (
        <div key={command} className="flex flex-col gap-x-6 gap-y-0.5 px-3 py-2 sm:flex-row sm:items-baseline">
          <dt className="order-2 font-mono text-[0.8125rem] [overflow-wrap:anywhere] sm:order-1 sm:w-80 sm:shrink-0">{command}</dt>
          <dd className="order-1 text-sm text-muted sm:order-2">{note}</dd>
        </div>
      ))}
    </dl>
  );
}

const CONTENTS = [
  ['real', 'What is real, what is a stand-in'],
  ['run', 'Run and test'],
  ['language', 'Add a language'],
  ['screen', 'Enable another screen'],
  ['backend', 'Messages from the backend'],
  ['devops', 'In Azure DevOps'],
  ['staging', 'Checking it in staging'],
  ['libraries', 'The same steps in three libraries'],
  ['glossary', 'Glossary'],
  ['tests', 'Tests'],
] as const;

interface LibraryRow {
  step: string;
  /** react-i18next, FormatJS, Lingui; or one cell that holds for all three. */
  cells: [ReactNode, ReactNode, ReactNode] | [ReactNode];
}

const LIBRARIES: LibraryRow[] = [
  {
    step: 'One file per screen',
    cells: [
      <>
        Namespaces: <Code wrap>locales/&lt;lang&gt;/&lt;screen&gt;.json</Code>, with a shared <Code>common</Code> file
      </>,
      <>
        One JSON per locale (or per route) that you import and pass to <Code>IntlProvider</Code>
      </>,
      <>
        One catalog per locale, loaded with a dynamic <Code>import()</Code>
      </>,
    ],
  },
  {
    step: 'English fallback',
    cells: [
      <>
        <Code>fallbackLng: "en"</Code>. None is set by default
      </>,
      <>
        <Code>defaultMessage</Code> on each message, then the id
      </>,
      <>
        <Code>fallbackLocales</Code> in the config
      </>,
    ],
  },
  {
    step: 'Values and plurals',
    cells: [
      <>
        <Code>{'{{name}}'}</Code>; plural keys <Code>_one</Code>, <Code>_other</Code>, chosen by <Code>Intl.PluralRules</Code>
      </>,
      'ICU MessageFormat',
      'ICU MessageFormat, written through macros',
    ],
  },
  {
    step: 'List what is not translated',
    cells: [
      <>
        <Code>pnpm i18n:check</Code> here; <Code>i18next-cli status</Code> does the same job
      </>,
      <Code wrap>formatjs verify --missing-keys</Code>,
      <>
        <Code>lingui extract</Code> prints the counts
      </>,
    ],
  },
  {
    step: 'Fail the build',
    cells: [
      <>
        <Code>pnpm i18n:check</Code>, and <Code>--strict</Code> before a release
      </>,
      <>
        <Code wrap>formatjs verify --structural-equality</Code> catches a dropped placeholder
      </>,
      <>
        <Code wrap>lingui compile --strict</Code>, <Code>lingui check missing</Code>, <Code>lingui check sync</Code>
      </>,
    ],
  },
  {
    step: 'Pseudo-locale',
    cells: [
      <>
        Written as an ordinary locale folder by <Code>pnpm i18n:pseudo</Code>
      </>,
      <Code wrap>formatjs compile --ast --pseudo-locale en-XA</Code>,
      <>
        <Code>pseudoLocale</Code> in the config
      </>,
    ],
  },
  {
    step: 'Find hard-coded text',
    cells: [
      <>
        <Code>eslint-plugin-i18next</Code> (<Code>no-literal-string</Code>), or <Code>i18next-cli lint</Code>
      </>,
      <>
        <Code>eslint-plugin-formatjs</Code> (<Code>no-literal-string-in-jsx</Code>)
      </>,
      <>
        <Code>eslint-plugin-lingui</Code> (<Code>no-unlocalized-strings</Code>, set up per project)
      </>,
    ],
  },
  {
    step: 'Typed keys',
    cells: [
      <>
        Typed from the English files (<Code>keys.ts</Code> here), or <Code>i18next-cli types</Code>
      </>,
      <>
        Declare <Code>FormatjsIntl.Message.ids</Code>
      </>,
      'Messages are the source strings, so there is no key to mistype',
    ],
  },
  {
    step: 'Screen tests',
    cells: [
      'A real instance with the real files',
      <>
        Render inside <Code>IntlProvider</Code> with the real messages
      </>,
      <>
        Render inside <Code>I18nProvider</Code> with a compiled catalog
      </>,
    ],
  },
  { step: 'Dates and numbers', cells: ['The browser’s Intl API behind one helper file. The same in all three.'] },
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
  { en: 'Best-before date', es: 'Fecha de consumo preferente', esConfirm: true, pt: 'Data de validade', ptConfirm: true },
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

/** A small violet mark after a term, explained once above the table. */
function Confirm() {
  return (
    <>
      <span aria-hidden="true" className="ml-1 font-semibold text-tool" title="To confirm with your translators">
        *
      </span>
      <span className="sr-only"> (to confirm with your translators)</span>
    </>
  );
}

export default function Handoff() {
  usePageTitle('Handoff');
  return (
    <div className="max-w-4xl">
      <SampleNote title="Handoff">
        <p>
          How this sample is put together, and how a team would run it, add a language to it, move another screen onto it and
          check it in staging. In a real project this is the document that travels with the pull request.
        </p>
      </SampleNote>

      <nav aria-label="On this page" className="rounded-lg border border-line bg-white p-4">
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
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
            and never to the library behind it. From that module, <Code>useI18n()</Code> gives a screen <Code>t</Code> for text;{' '}
            <Code>date</Code>, <Code>dateTime</Code>, <Code>number</Code>, <Code>quantity</Code>, <Code>percent</Code> and{' '}
            <Code>relativeTime</Code> for values; and <Code>parseNumber</Code> for input. <Code>Msg</Code> is for visible text. The
            translation files, the English fallback, the checks in the build and the tests all work as described on this page.
          </p>
          <p>
            <strong className="font-semibold">Stand-in.</strong> The API is a few serverless functions that answer the way an
            ASP.NET Core API would: JSON, problem details with a stable <Code>code</Code> and its <Code>values</Code>, and the
            request’s language read from <Code>Accept-Language</Code>. It stores nothing, and no .NET code was written. The Spanish
            and Portuguese text was written for this sample from the glossary below and has not been reviewed by a native speaker;
            yours would come from your translators. The app, the plant and all data are invented.
          </p>
          <p>
            <strong className="font-semibold">What the real first milestone adds.</strong> The same work in your codebase, using
            the localization approach it already has where practical: a count of the strings on the agreed screens on day one,
            the checks wired into your Azure DevOps pipeline, a list of the backend messages those screens can show and who
            translates them, a staging pass in English, Spanish and Brazilian Portuguese, and this handoff in the pull request.
          </p>
        </div>
      </Section>

      <Section id="run" title="Run and test">
        <Commands />
        <p className="mt-3 text-muted">
          The language is chosen in the header, saved in the browser and sent to the API on every call. “Mark fallbacks” is the
          review mode: it underlines English text that is standing in for a missing translation, and shows how many there are in
          the current language.
        </p>
        <p className="mt-3 text-muted">
          Two kinds of date are kept apart. A plain date, such as a best-before date, has no time zone and never shifts. A moment,
          such as “recorded at”, is shown in the plant’s time zone and labelled with it, so a reader in another zone does not take
          it for their own clock. The plant’s “today” comes from the API, worked out in the plant’s zone, not from the browser.
        </p>
      </Section>

      <Section id="language" title="Add a language">
        <p className="mb-3 text-muted">
          Five steps. The pseudo-locale, <Code>en-XA</Code>, is wired into this sample by the same five: one config entry, one
          folder, the check, the tests.
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
            Add the language to the tests in three places: its code in <Code>tests/locales.ts</Code>, which the screen tests and
            the browser tests both read; a row of expected formats in <Code>tests/unit/format.test.ts</Code>; and a row of
            expected text in <Code>e2e/locale.spec.ts</Code>. The type check fails until both rows exist.
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
            <Code>pnpm lint</Code>: every literal string in the markup is listed with its line. On Receiving that is 10 findings,
            including the two strings joined from pieces. Sort them into plain labels, messages with values, plurals, validation,
            backend messages, and dates or numbers formatted by hand. The rule cannot see words that sit in data, such as the
            status column here, or a date built by hand; step five catches those.
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
            plain English is hard-coded or data; anything that overflows needs room. Then look at it in the longest real
            language at laptop width, because a pseudo-locale pads every string alike and a real one does not. Send the new
            English file for translation; until it comes back the screen shows English, marked in review mode.
          </li>
        </Steps>
        <p className="mt-3 text-muted">
          Four things found while building these screens that are worth knowing before the next one. A status word cannot be
          shared between an order and a lot: Portuguese says “ordem retida” but “lote retido”, so they are separate messages.
          Portuguese treats zero as singular, so counts that can be zero get their own “none” message. A sentence built around
          a time of day breaks in Spanish (“a la 1:05”, “a las 2:05”), so times are shown as a full date and time instead. And
          the orders table passed at the pseudo-locale but wrapped badly in real Portuguese at 1280 wide, which is why the
          browser run now measures row height in the real languages too.
        </p>
      </Section>

      <Section id="backend" title="Messages from the backend">
        <div className="space-y-3 rounded-lg border border-line bg-white p-4">
          <p>
            The sample uses one pattern throughout: the API answers an error with problem details that carry a stable{' '}
            <Code>code</Code> (for example <Code>lot.on_hold</Code>) and typed <Code>values</Code> (a lot code, a quantity with its
            unit, a ratio, a date). The client translates the code and formats the values for the user’s language. There is one
            translation store and one fallback: when the client has no text for a code, or the response leaves out a value the text
            needs, the user sees the server’s English <Code>detail</Code> and the code is listed on Translation status.
          </p>
          <p>
            <strong className="font-semibold">On the .NET side.</strong> In ASP.NET Core the code and its values travel as extension
            members of the problem response (<Code>ProblemDetails.Extensions</Code>) and can be added in one place with{' '}
            <Code>CustomizeProblemDetails</Code> instead of in every controller. Validation messages and model-binding messages
            (“the value is not valid”) are two separate sets and are localized separately. The request culture is read from the
            query string, then a cookie, then <Code>Accept-Language</Code>, in that order by default. The stand-in imitates these;
            no .NET code was written for this sample, so the real milestone starts by reading how your API builds its error
            responses today.
          </p>
          <p>
            <strong className="font-semibold">An API with no codes yet.</strong> ASP.NET Core’s default validation answer is a title
            and an <Code>errors</Code> dictionary keyed by property name, with no code. The form handles that shape as well: the
            server’s own words are shown, marked as English, on the fields the dictionary names. That is the fallback, not the
            goal, because those words cannot be translated on the client.
          </p>
          <p>
            Every call also sends <Code>Accept-Language</Code>, and the stand-in reads it into a request culture: an exact match
            first, then the parent, so <Code>es-MX</Code> falls back to <Code>es</Code>. Nothing uses it yet. It is there for the
            text only a server can produce: emails, exports and reports.
          </p>
          <p>Dependencies to raise before work starts, because each one sits outside the React code:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Validation and model-binding messages produced by the API, which are two separate sets in ASP.NET Core.</li>
            <li>Business-rule errors returned as finished English sentences instead of codes.</li>
            <li>Rules the API enforces that the screen does not know about. Each needs a code, or its text cannot be translated.</li>
            <li>Status names and units stored as text in the database.</li>
            <li>Dates and numbers already formatted on the server, and a “today” worked out in UTC rather than in the plant’s time zone.</li>
            <li>Emails, exports and printed documents. Printed product labels are regulated text and are best left out of scope.</li>
            <li>
              Third-party grids and date pickers, which carry their own language packs. The browser’s own date input is one in
              effect: it follows the browser’s language, not the app’s. The date fields on Record output are three lists driven
              by the app’s language for that reason.
            </li>
          </ul>
        </div>
      </Section>

      <Section id="devops" title="In Azure DevOps">
        <div className="space-y-3 rounded-lg border border-line bg-white p-4">
          <p>
            <Code>azure-pipelines.yml</Code> in this repository lists what a pipeline would run, in order: install,{' '}
            <Code>pnpm i18n:check</Code>, lint, type check, the unit and screen tests, the build, the browser tests, and the strict
            check on a release branch only.
          </p>
          <p>
            In Azure Repos a pull request does not start a YAML pipeline by itself. The pipeline is attached to the target branch
            as a build validation policy, and from then on a pull request cannot complete while a key is missing from English, a
            placeholder has changed or a test fails.
          </p>
          <p>
            <strong className="font-semibold">Not yet run there.</strong> That file was written for this handoff and has not been
            run in Azure DevOps. The commands in it are the ones run locally before every commit of this sample. In your project
            the same steps would go into the pipeline you already have, not into a new one.
          </p>
        </div>
      </Section>

      <Section id="staging" title="Checking it in staging">
        <p className="mb-3 text-muted">
          One pass per language: English, Spanish, Brazilian Portuguese. The Start page’s eight steps are the short version.
        </p>
        <Steps>
          <li>Switch the language in the header and reload. The choice holds and the page’s <Code>lang</Code> attribute matches it.</li>
          <li>
            On Production orders, read one date and one quantity. The month is a word, the separators are the language’s, the unit
            is the plant’s.
          </li>
          <li>
            On Record output, type a number that language’s way: 1.250,5 in Portuguese, 1,250.5 in English and Spanish. The line
            under the field repeats it to the last decimal. Submit, and compare with the number in the request.
          </li>
          <li>Trigger one message from the backend and read it in the language. Here that is the “Lot on hold” shortcut above the form.</li>
          <li>
            Turn on “Mark fallbacks” and note anything underlined: text still waiting for a translation. Then switch to the
            pseudo-locale and note anything on a pilot screen that is neither accented nor data: text still hard-coded.
          </li>
          <li>
            Run <Code>pnpm i18n:check --strict</Code> on the commit that is on staging. It has to pass before the release.
          </li>
        </Steps>
        <p className="mt-3 text-muted">
          The browser tests do steps one to four by themselves, against any deployed copy:{' '}
          <Code wrap>BASE_URL=https://your-staging-host pnpm test:live</Code>. One check no script does: someone who speaks the
          language reads the three screens.
        </p>
      </Section>

      <Section id="libraries" title="The same steps in three libraries">
        <p className="mb-3 text-muted">
          The sample is built on react-i18next, the most downloaded of the three. Only the first column was built and run here.
          The other two are from each library’s documentation, read in November 2026. The steps on this page carry over to
          either. The two scripts do not: they read i18next’s file format, and with FormatJS or Lingui their job is done by the
          library’s own commands in the table.
        </p>
        <ScrollArea className="overflow-hidden rounded-lg border border-line bg-white" label="The steps in each library">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="th">Step</th>
                <th scope="col" className="th">react-i18next (built and run here)</th>
                <th scope="col" className="th">FormatJS (react-intl), from its docs</th>
                <th scope="col" className="th">Lingui, from its docs</th>
              </tr>
            </thead>
            <tbody>
              {LIBRARIES.map(({ step, cells }) => (
                <tr key={step} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="td text-left font-medium">{step}</th>
                  {cells.map((cell, index) => (
                    <td key={index} className="td" colSpan={cells.length === 1 ? 3 : undefined}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      </Section>

      <Section id="glossary" title="Glossary">
        <p className="mb-3 text-muted">
          The terms the sample’s Spanish and Portuguese are built on. Spanish is Latin American, Portuguese is Brazilian. A term
          followed by a violet asterisk <span aria-hidden="true" className="font-semibold text-tool">*</span> was not checked
          against a published source and is to confirm with your translators. None of it has been read by a native speaker.
        </p>
        <ScrollArea className="overflow-hidden rounded-lg border border-line bg-white" label="Terms in three languages">
          <table className="w-full min-w-[40rem] border-collapse" data-testid="glossary">
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
        </ScrollArea>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-muted">
          <li>
            Spanish keeps two dates apart: “fecha de caducidad” is the use-by date, a safety date, and “fecha de consumo
            preferente” is the best-before date, a quality date. The sample uses the second. Which one your screens mean is a
            question for whoever owns your labelling.
          </li>
          <li>
            Spain says APPCC, “retirada” and “seguridad alimentaria” where the Americas say HACCP, “retiro” and “inocuidad”.
          </li>
          <li>Brazil says “estoque” and “controle” where Portugal says “stock” and “controlo”.</li>
          <li>“Etiqueta” is a printed tag; “rótulo” is the regulated product label.</li>
          <li>
            Product, raw material, supplier and customer names are data. They stay as they were entered, in every language; one
            product in the sample was entered in Spanish to show it.
          </li>
        </ul>
      </Section>

      <Section id="tests" title="Tests">
        <ul className="list-disc space-y-2 rounded-lg border border-line bg-white py-4 pl-9 pr-4">
          <li>
            <Code>tests/unit/format.test.ts</Code> and <Code>parseNumber.test.ts</Code>: every helper and the number parser, with
            the exact expected text for each language, including the time zone label and the space that keeps a number with its
            unit.
          </li>
          <li>
            <Code>tests/unit/catalog.test.ts</Code>: the file checks. A key missing from English fails; a changed placeholder
            fails; a string not translated yet is reported and fails only with <Code>--strict</Code>; the real files pass.
          </li>
          <li>
            <Code>tests/unit/api.test.ts</Code>: the stand-in API’s problem details, its codes against the published list, the
            rules it enforces by itself, how it reads <Code>Accept-Language</Code>, and that at 7:30 PM in the plant its “today”
            is still the plant’s date.
          </li>
          <li>
            <Code>tests/component/screens.test.tsx</Code>: each pilot screen rendered in each language, with no raw key and no
            unfilled placeholder on it; the fallback marked where a translation is missing; the form repeating a typed number
            exactly; and what the form does with an answer that has no code, a missing value or the wrong shape.
          </li>
          <li>
            <Code>e2e/locale.spec.ts</Code>: in a browser, once per language: switch language, read a date and a number, submit the
            form with a number typed that language’s way, trigger the server-only rule and read the translated message.
          </li>
          <li>
            <Code>e2e/layout.spec.ts</Code> and <Code>e2e/a11y.spec.ts</Code>: under the pseudo-locale no page may scroll sideways
            at 1280 or 768 wide; in the real languages no table row may be taller than two lines at 1280 or 1024; every page passes
            an automated accessibility check; the page’s <Code>lang</Code> follows the selector.
          </li>
        </ul>
      </Section>
    </div>
  );
}
