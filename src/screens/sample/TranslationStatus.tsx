import { Check, CircleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { check, fallbackSummary, report, strictCheck } from 'virtual:i18n-report';
import { Code, SampleNote } from '../../components/sample/SampleChrome';
import { ScrollArea } from '../../components/ui';
import { LOCALES } from '../../i18n';
import { readUnknownCodes } from '../../lib/unknownCodes';
import { usePageTitle } from '../../lib/usePageTitle';

const SCREENS: Record<string, string> = {
  common: 'Header, menu and shared words',
  orders: 'Production orders',
  lot: 'Lot traceability',
  output: 'Record output',
  errors: 'Messages from the API',
};

function label(code: string): string {
  return LOCALES.find((locale) => locale.code === code)?.label ?? code;
}

/** One run of the command: what it printed, and its last line pulled out so pass or fail is read at a glance. */
function Run({ command, run }: { command: string; run: typeof check }) {
  const passed = run.exitCode === 0;
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white" data-testid={passed ? 'run-passed' : 'run-failed'}>
      <p className="border-b border-line px-3 py-2 font-mono text-sm">{command}</p>
      <p className={`flex items-start gap-2 border-b px-3 py-2 font-medium ${passed ? 'border-ok bg-ok-tint text-ok' : 'border-bad bg-bad-tint text-bad'}`}>
        {passed ? <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />}
        <span>
          {passed ? 'Passed, exit code 0. ' : 'Failed, exit code 1. '}
          <span className="font-normal">{run.verdict.replace(/^(PASSED|FAILED)[^:]*:\s*/, '')}</span>
        </span>
      </p>
      <pre tabIndex={0} aria-label={`Output of ${command}`} className="scroll-x whitespace-pre-wrap break-words p-3 font-mono text-[0.8125rem] leading-relaxed">
        {run.text}
      </pre>
    </div>
  );
}

function Pass({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ok" />
      ) : (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-bad" />
      )}
      <span>
        <span className="sr-only">{ok ? 'Passed: ' : 'Failed: '}</span>
        {children}
      </span>
    </li>
  );
}

export default function TranslationStatus() {
  usePageTitle('Translation status');
  const [seen] = useState(readUnknownCodes);
  const languages = report.locales.filter((entry) => !entry.pseudo);
  const pseudo = report.locales.find((entry) => entry.pseudo);
  const untranslated = languages.reduce((sum, entry) => sum + entry.missing.length, 0);
  const mismatches = report.locales.reduce((sum, entry) => sum + entry.placeholderMismatches.length, 0);
  const extra = report.locales.reduce((sum, entry) => sum + entry.extra.length, 0);

  return (
    <div className="max-w-5xl">
      <SampleNote title="Translation status">
        <p>
          Built from the translation files when the site is built, by the same code that runs as <Code>pnpm i18n:check</Code> in{' '}
          <Code>pnpm build</Code>. English is the source: {report.total} messages in {report.namespaces.length} files, one file per
          screen. A set of plural forms counts as one message. Right now {fallbackSummary || 'nothing'} would fall back.
        </p>
      </SampleNote>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="language-cards">
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-sm text-muted">Source</p>
          <p className="text-lg font-semibold">English</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{report.total}</p>
          <p className="text-sm text-muted">messages</p>
        </div>
        {languages.map((entry) => {
          const percent = Math.floor((entry.translated / entry.total) * 100);
          return (
            <div key={entry.locale} className="rounded-lg border border-line bg-white p-4" data-testid={`card-${entry.locale}`}>
              <p className="text-sm text-muted">Translation</p>
              <p className="text-lg font-semibold" lang={entry.locale}>{label(entry.locale)}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {entry.translated} <span className="text-base font-normal text-muted">of {entry.total}</span>
              </p>
              <div className="mt-2 h-2 rounded-full bg-page" role="img" aria-label={`${percent}% translated`}>
                <div className="h-2 rounded-full bg-tool" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">
                {entry.missing.length === 0
                  ? 'Nothing falls back.'
                  : `${entry.missing.length} ${entry.missing.length === 1 ? 'string falls' : 'strings fall'} back to English.`}
              </p>
            </div>
          );
        })}
        {pseudo ? (
          <div className="rounded-lg border border-tool bg-tool-tint p-4">
            <p className="text-sm text-tool">Built by script</p>
            <p className="text-lg font-semibold">Pseudo-locale</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {pseudo.translated} <span className="text-base font-normal text-muted">of {pseudo.total}</span>
            </p>
            <p className="mt-2 text-sm text-muted">{report.pseudoInSync ? 'In step with English.' : 'Out of date.'}</p>
          </div>
        ) : null}
      </div>

      <h2 className="mb-2 mt-8 text-lg">Not translated yet</h2>
      <p className="mb-3 max-w-3xl text-muted">
        These show in English, with a dotted violet underline in review mode. They are reported, not failed, because translations
        arrive after the code. The five Portuguese strings below were left out on purpose so the fallback has something to show.
      </p>
      <ScrollArea className="overflow-hidden rounded-lg border border-line bg-white" label="Not translated yet">
        <table className="w-full min-w-[44rem] border-collapse" data-testid="missing-table">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="th">Language</th>
              <th scope="col" className="th">Screen</th>
              <th scope="col" className="th">Key</th>
              <th scope="col" className="th">English shown instead</th>
            </tr>
          </thead>
          <tbody>
            {languages.flatMap((entry) =>
              entry.missing.map((item) => (
                <tr key={`${entry.locale}-${item.namespace}-${item.key}`} className="border-b border-line last:border-b-0">
                  <td className="td whitespace-nowrap" lang={entry.locale}>{label(entry.locale)}</td>
                  <td className="td">{SCREENS[item.namespace] ?? item.namespace}</td>
                  <td className="td font-mono text-sm">
                    {item.namespace}:{item.key}
                    {item.forms.length > 0 ? <span className="block text-muted">plural forms missing: {item.forms.join(', ')}</span> : null}
                  </td>
                  <td className="td">{item.source}</td>
                </tr>
              )),
            )}
            {untranslated === 0 ? (
              <tr>
                <td className="td text-muted" colSpan={4}>Every message is translated in every language.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </ScrollArea>

      <h2 className="mb-2 mt-8 text-lg">Messages from the API</h2>
      <p className="mb-3 max-w-3xl text-muted">
        The API publishes the codes it can send (<Code>contracts/api-error-codes.json</Code>). Each is matched against the client’s{' '}
        <Code>errors</Code> file. A code with no client text is not an error: the user sees the server’s own English text until the
        translation is added.
      </p>
      <ScrollArea className="overflow-hidden rounded-lg border border-line bg-white" label="Messages from the API">
        <table className="w-full min-w-[40rem] border-collapse" data-testid="codes-table">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="th">Code</th>
              <th scope="col" className="th">Values sent with it</th>
              {['en', ...languages.map((entry) => entry.locale)].map((code) => (
                <th key={code} scope="col" className="th" lang={code}>{label(code)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.backend.codes.map((entry) => (
              <tr key={entry.code} className="border-b border-line last:border-b-0">
                <th scope="row" className="td text-left font-mono text-sm font-medium">{entry.code}</th>
                <td className="td font-mono text-sm">{entry.values.length > 0 ? entry.values.join(', ') : <span className="font-sans text-muted">none</span>}</td>
                {['en', ...languages.map((language) => language.locale)].map((code) => (
                  <td key={code} className="td">
                    {entry.texts[code] ? (
                      <span className="inline-flex items-center gap-1 text-ok"><Check aria-hidden="true" className="size-4" /> text</span>
                    ) : (
                      <span className="text-tool">{report.backend.withoutText.includes(entry.code) ? 'server text' : 'English'}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="mt-3 rounded-lg border border-tool bg-tool-tint p-4" data-testid="seen-codes">
        <h3 className="text-base text-tool">Codes received in this browser session with no client text</h3>
        {seen.length === 0 ? (
          <p className="mt-1 text-muted">
            None yet. On Record output, press “A code with no translation” above the form; the code will be listed here.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {seen.map((entry) => (
              <li key={entry.code}>
                <span className="font-mono font-medium">{entry.code}</span>
                <span className="block text-muted">Shown to the user: “{entry.detail}”</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <h2 className="mb-2 mt-8 text-lg">Checks that fail the build</h2>
      <ul className="space-y-2 rounded-lg border border-line bg-white p-4" data-testid="hard-checks">
        <Pass ok={report.unknownKeys.length === 0}>
          Every key the code uses exists in English ({report.unknownKeys.length} missing).
        </Pass>
        <Pass ok={extra === 0}>No translation file has a key English does not have ({extra} found).</Pass>
        <Pass ok={mismatches === 0}>
          Every translation has the same placeholders as its English text ({mismatches} mismatches).
        </Pass>
        <Pass ok={report.backend.textsWithoutCode.length === 0}>
          Every API message text belongs to a code the API can send, and uses only values it sends.
        </Pass>
        <Pass ok={report.pseudoInSync}>
          The pseudo-locale matches what <Code>pnpm i18n:pseudo</Code> would write today.
        </Pass>
      </ul>

      <h2 className="mb-2 mt-8 text-lg">Unused keys</h2>
      <p className="mb-3 max-w-3xl text-muted">
        In English but not named anywhere in the code. Listed, never failed. One was left in on purpose.
      </p>
      <ul className="rounded-lg border border-line bg-white p-4" data-testid="unused-keys">
        {report.unused.length === 0 ? <li className="text-muted">None.</li> : null}
        {report.unused.map((item) => (
          <li key={`${item.namespace}:${item.key}`}>
            <span className="font-mono text-sm">{item.namespace}:{item.key}</span>
            <span className="text-muted"> · “{item.source}”</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-2 mt-8 text-lg">What the command prints</h2>
      <p className="mb-3 max-w-3xl text-muted">
        The two runs print the same report and end differently. The first runs on every build and passes while translations are
        still arriving. The second is the release check: it fails while anything would fall back, here {fallbackSummary || 'nothing'}.
        The backend code is counted apart from the strings because it is fixed in a different place, the <Code>errors</Code> file.
      </p>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2" data-testid="runs">
        <Run command="pnpm i18n:check" run={check} />
        <Run command="pnpm i18n:check --strict" run={strictCheck} />
      </div>
      <p className="mt-3 max-w-3xl text-muted">
        Both are steps in <Code>azure-pipelines.yml</Code>, the strict one only on a release branch. That file has not been run in
        Azure DevOps yet; the commands in it are the ones run here before every commit.
      </p>
    </div>
  );
}
