# Multilingual pilot: a working sample

A small, made-up production and traceability app with reusable localization built in. It is the first milestone of a
"make our React app multilingual" project in miniature: one shared setup, three screens moved onto it in English,
Spanish and Brazilian Portuguese, and the checks and written handoff that keep it working when a team adds a language
or another screen.

Everything is fictional: the app (Tallyfield), the producer, the plant, and every product, lot, supplier and customer.

## What it proves

- **A language selector that does three things.** The choice is saved, sets the page's `lang` attribute and goes to
  the API as `Accept-Language` on every call.
- **A visible English fallback.** Five Portuguese strings are left untranslated on purpose. They show in English,
  marked `lang="en"`, with a dotted violet underline in review mode. The header shows how many there are in the
  current language, and the Translation status page lists them.
- **Formatting from one module.** Dates with the month as a word, numbers, quantities with units, percent, relative
  time and plural counts including zero, all from `src/i18n/format.ts`. Units belong to the plant, not the language.
- **Two kinds of date, kept apart.** A plain date such as a best-before date has no time zone and never shifts. A
  moment such as "recorded at" is shown in the plant's time zone and labelled with it. The plant's "today" comes from
  the API, worked out in the plant's zone: at 7:30 PM in Chicago it is still today there, although the UTC date has
  moved on.
- **A number input that reads what each locale writes.** `1.250,5` in Portuguese and `1,250.5` in English and US
  Spanish are the same number. The form repeats the number it read to the last decimal, sends a JSON number and an
  ISO date, and re-writes a typed number when the language is switched so its value does not change.
- **Date fields in the app's language.** Day, month and year as three lists in the order the language writes them,
  with the month as a word, instead of the browser's own date input, which follows the browser's language.
- **Backend messages by code.** The API answers errors with problem details carrying a stable `code` and typed
  `values`. The client translates the code and formats the values. A code with no client text, or one that arrives
  without a value its text needs, shows the server's English `detail` and is listed on the status page. An answer
  with no code at all (ASP.NET Core's default validation response) still lands on the right fields in the server's
  own words. The raw response is shown beside the rendered message.
- **A pseudo-locale** under a Developer divider, wired in by the same documented steps as a real language, and one
  screen (Receiving) left un-enabled so the difference is plain.
- **Two kinds of check.** A key missing from English or a changed placeholder fails the build. A string not
  translated yet is reported and falls back; `--strict` turns that report into a failure.
- **A handoff page** with the steps to run and test, add a language, enable another screen and check it in staging,
  a glossary, and a table mapping each step to react-i18next, FormatJS and Lingui.

Where a message from the backend goes, as one picture. The Handoff page has the same figure, with the .NET side
written out under it.

![Three paths from the API's answer to what the user sees. Path 1, the normal case: the API sends a code the client has text for, the client translates it and formats its values, and the user reads the message in their own language. Path 2: the client has no text for the code, or a value is missing, so the user sees the server's English detail and the code is listed on the Translation status page. Path 3: the API sends no code at all, so the server's own words are shown on the fields it names, and that is a dependency to raise before work starts.](docs/backend-messages.png)

## What is real and what is a stand-in

Real: the React setup, the translation files, the fallback, the formatting helpers, the parser, the checks and the tests.

Stand-in: the API. It is a few serverless functions in `api/` that answer the way an ASP.NET Core API would (JSON,
problem details, a request culture read from `Accept-Language`). No .NET code was written, and it stores nothing.

The Spanish and Portuguese text was written for this sample from a glossary and has not been reviewed by a native
speaker. Terms that were not checked against a published source are marked on the Handoff page. In a real project
the translations come from your own translators.

Of the three libraries in the Handoff's table, only react-i18next was built and run here. The FormatJS and Lingui
columns are from each library's documentation, read in November 2026.

## Run it

Node 22.12 or newer and pnpm.

```bash
pnpm install
pnpm dev          # the app and the stand-in API on http://localhost:3901
```

The same API handler (`api/_lib/router.ts`) is mounted by the Vite dev and preview servers and wrapped by the
functions in `api/` for Vercel, so local runs and the deployed site answer identically.

## How it is put together

```
src/i18n/            the only code that touches the i18n library (i18next)
  config.ts          languages: code, own name, formatting region, Accept-Language
  index.tsx          what screens import: useI18n() for t, the format helpers and parseNumber; Msg for visible text
  format.ts          dates, numbers, quantities, percent, relative time, plural form
  parseNumber.ts     locale-aware number input
  keys.ts            message keys typed from the English files
  locales/<lang>/    one JSON file per screen, plus common and errors
src/screens/pilot/   the three enabled screens
src/screens/not-enabled/Receiving.tsx   the "before" picture
src/screens/sample/  notes about the sample: start page, translation status, handoff
scripts/             the checks and the pseudo-locale script, plain Node over the JSON files
contracts/           the list of codes the API can send
design/              the script and the commands that draw the icon and the diagram (see DESIGN-NOTES.md)
api/                 the stand-in API
azure-pipelines.yml  the same checks as pipeline steps (not yet run in Azure DevOps)
```

## State

There is no database and no sign-in. The language choice and the review switch are saved in the browser's local
storage. Backend codes the client had no text for are kept in session storage so the status page can list them. The
API builds its data from the request time, so the sample always reads as "this week", and it keeps nothing that is
posted to it.

## Checks and tests

```bash
pnpm i18n:check             # translation file checks; part of pnpm build
pnpm i18n:check --strict    # also fails while anything would fall back
pnpm i18n:pseudo            # rewrite the pseudo-locale after an English change
pnpm lint                   # includes the hard-coded text rule on enabled screens
pnpm typecheck              # a mistyped message key fails here
pnpm test                   # unit and screen tests (Vitest)
pnpm exec playwright install chromium   # once, before the first browser run
pnpm test:e2e               # browser tests (Playwright) against a local build
pnpm test:live              # the same browser tests against a deployed copy (BASE_URL to choose which)
pnpm build
```

- Unit: every format helper and the number parser with exact expected text per language; the file checks against
  small fixtures and against this project's own files; the stand-in API's problem details, the rules it enforces by
  itself, its culture handling, and its "today" in the evening at the plant.
- Screen: each pilot screen rendered in each language and the pseudo-locale with no raw key or unfilled
  placeholder; the fallback marking; plurals including zero; the form end to end against the real API handler,
  including that it repeats a typed number exactly, and only a number it would accept; and what the form does with
  an answer that has no code, a missing value or the wrong shape.
- Browser, once per language: switch language, read a date and a number, submit the form with a number typed that
  language's way, trigger the server-only rule and read the translated message. Under the pseudo-locale no page may
  scroll sideways at 1280 or 768 wide; in the real languages no table row may be taller than two lines at 1280 or
  1024; nothing scrolls sideways at 320. Every page passes an automated accessibility check in every language, and
  the page's `lang` attribute follows the selector.

`azure-pipelines.yml` lists the same commands as pipeline steps, with the strict check on release branches only. It
was written for the handoff and has not been run in Azure DevOps. In Azure Repos it is attached to the target branch
as a build validation policy, so a pull request cannot complete while a check fails.

`pnpm screens` takes the screenshots into `./screens`; set `SCREENS_DIR` to send them somewhere else and
`SCREENS_SCALE=2` for twice the pixels.

## Known limits

- The translations have not been read by a native speaker.
- Translations are bundled with the app. Loading each language on demand is a small change in `src/i18n/resources.ts`
  and is not done here.
- The time zone label comes from the browser's own data: Central time reads "CST" in English and Spanish and
  "GMT-6" in Portuguese.
- The check scripts read i18next's file format. With FormatJS or Lingui their job is done by the library's own
  commands, listed on the Handoff page.
- Right-to-left languages are out of scope.

Sample by Bereket A. · fictional data
