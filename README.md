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
  marked `lang="en"`, with a dotted violet underline in review mode. The Translation status page counts them.
- **Formatting from one module.** Dates with the month as a word, numbers, quantities with units, percent, relative
  time and plural counts including zero, all from `src/i18n/format.ts`. Units belong to the plant, not the language.
- **A number input that reads what each locale writes.** `1.250,5` in Portuguese and `1,250.5` in English and US
  Spanish are the same number; the form sends a JSON number and an ISO date.
- **Backend messages by code.** The API answers errors with problem details carrying a stable `code` and typed
  `values`. The client translates the code and formats the values. A code with no client text shows the server's
  English `detail` and is listed on the status page. The raw response is shown beside the rendered message.
- **A pseudo-locale** under a Developer divider, added by the same documented steps as a real language, and one
  screen (Receiving) left un-enabled so the difference is plain.
- **Two kinds of check.** A key missing from English or a changed placeholder fails the build. A string not
  translated yet is reported and falls back; `--strict` turns that report into a failure.
- **A handoff page** with the steps to run and test, add a language, enable another screen, a glossary, and a table
  mapping each step to react-i18next, FormatJS and Lingui.

## What is real and what is a stand-in

Real: the React setup, the translation files, the fallback, the formatting helpers, the parser, the checks and the tests.

Stand-in: the API. It is a few serverless functions in `api/` that answer the way an ASP.NET Core API would (JSON,
problem details, a request culture read from `Accept-Language`). It stores nothing. The Spanish and Portuguese text was
written for this sample from a glossary; terms that were not checked against a published source are tagged on the
Handoff page.

## Run it

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
  index.tsx          what screens import: t, Msg, the format helpers, parseNumber
  format.ts          dates, numbers, quantities, percent, relative time, plural form
  parseNumber.ts     locale-aware number input
  keys.ts            message keys typed from the English files
  locales/<lang>/    one JSON file per screen, plus common and errors
src/screens/pilot/   the three enabled screens
src/screens/not-enabled/Receiving.tsx   the "before" picture
src/screens/sample/  notes about the sample: start page, translation status, handoff
scripts/             the checks and the pseudo-locale generator, plain Node over the JSON files
contracts/           the list of codes the API can send
api/                 the stand-in API
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
pnpm i18n:pseudo            # regenerate the pseudo-locale after an English change
pnpm lint                   # includes the hard-coded text rule on enabled screens
pnpm typecheck              # a mistyped message key fails here
pnpm test                   # unit and component tests (Vitest)
pnpm test:e2e               # browser tests (Playwright) against a local build
pnpm test:live              # the same browser tests against the deployed site (BASE_URL to override)
pnpm build
```

- Unit: every format helper and the number parser with exact expected text per language; the file checks against
  small fixtures and against this project's own files; the stand-in API's problem details and culture handling.
- Component: each pilot screen rendered in each language and the pseudo-locale with no raw key or unfilled
  placeholder; the fallback marking; plurals including zero; the form end to end against the real API handler.
- Browser, once per language: switch language, read a date and a number, submit the form with a number typed that
  language's way, trigger the server-only rule and read the translated message. Under the pseudo-locale no page may
  scroll sideways at 1280 or 768 wide. Every page passes an automated accessibility check in every language, and the
  page's `lang` attribute follows the selector.

## Known limits

- The date fields are the browser's own date input, which follows the browser's language, not the app's. The line
  under each field repeats the date in the app's language. A date picker with its own locale pack is the usual fix.
- Translations are bundled with the app. Loading each language on demand is a small change in `src/i18n/resources.ts`
  and is not done here.
- Right-to-left languages are out of scope.

Sample by Bereket A. · fictional data
