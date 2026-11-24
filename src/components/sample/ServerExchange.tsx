// Shows what went over the wire next to what the user sees, and offers three shortcuts that
// trip a rule only the server can check. Sample tooling, English on purpose.

import { NO_CODE, type Exchange } from '../../lib/api';
import { Code, ToolTag } from './SampleChrome';

function Wire({ label, firstLine, headers, body }: { label: string; firstLine: string; headers: Record<string, string>; body: unknown }) {
  const text = [
    firstLine,
    ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`),
    '',
    body === null || body === undefined ? '' : JSON.stringify(body, null, 2),
  ]
    .join('\n')
    .trimEnd();
  return (
    <div>
      <h3 className="mb-1 text-sm text-muted">{label}</h3>
      <pre
        tabIndex={0}
        aria-label={label}
        className="scroll-x whitespace-pre-wrap break-words rounded-md border border-line bg-page p-3 font-mono text-[0.8125rem] leading-relaxed"
      >
        {text}
      </pre>
    </div>
  );
}

export type Scenario = 'on_hold' | 'over_planned' | 'no_translation';

const SHORTCUTS: Array<{ scenario: Scenario; label: string; order: string }> = [
  { scenario: 'on_hold', label: 'Lot on hold', order: 'PO-26-1185' },
  { scenario: 'over_planned', label: 'Over the planned quantity', order: 'PO-26-1184' },
  { scenario: 'no_translation', label: 'A code with no translation', order: 'PO-26-1187' },
];

/** One press fills the form with valid values for an order the server will refuse, and sends it. */
export function ServerRuleShortcuts({ onRun, disabled }: { onRun: (scenario: Scenario) => void; disabled: boolean }) {
  return (
    <div role="group" aria-labelledby="shortcuts-title" className="mb-5 rounded-lg border border-tool bg-tool-tint p-3" data-testid="server-rule-shortcuts">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ToolTag>sample shortcut</ToolTag>
        <p id="shortcuts-title" className="text-sm text-tool">
          Let the server say no: each button fills the form with valid values and sends it.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.scenario}
            type="button"
            disabled={disabled}
            data-testid={`try-${shortcut.scenario}`}
            onClick={() => onRun(shortcut.scenario)}
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-tool bg-white px-3 py-2 text-left text-sm font-medium text-tool hover:bg-tool-tint disabled:cursor-not-allowed disabled:border-line disabled:text-field"
          >
            <span>{shortcut.label}</span>
            <span className="font-mono text-xs font-normal">{shortcut.order}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export type WireResult = { kind: 'saved'; quantity: number } | { kind: 'problem'; code: string; translated: boolean };

function Explanation({ result }: { result: WireResult }) {
  if (result.kind === 'saved') {
    return (
      <>
        Saved. The request body holds <Code>{JSON.stringify(result.quantity)}</Code> as a JSON number, whatever separators were
        typed, and the message beside it repeats that number with every decimal. The stand-in API keeps nothing; a real one
        would store this record.
      </>
    );
  }
  if (result.code === NO_CODE) {
    return (
      <>
        This response has no <Code>code</Code>. That is what an ASP.NET Core API sends by default, before it adopts codes. There
        is nothing to translate, so the server’s own words are shown, marked as English, and any field named in{' '}
        <Code>errors</Code> is marked on the form.
      </>
    );
  }
  return result.translated ? (
    <>
      The client found <Code>{result.code}</Code> in its <Code>errors</Code> file and showed its own translation, with the values
      formatted for this language. The server’s English <Code>detail</Code> was not shown.
    </>
  ) : (
    <>
      The client cannot put <Code>{result.code}</Code> into words: it has no text for it, or the response left out a value the
      text needs. It showed the server’s English <Code>detail</Code> and added the code to the Translation status page.
    </>
  );
}

export function ServerExchange({ exchange, result }: { exchange: Exchange | null; result: WireResult | null }) {
  return (
    <aside aria-labelledby="exchange-title" className="rounded-lg border border-line border-t-4 border-t-tool bg-white" data-testid="server-exchange">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 id="exchange-title" className="text-base">
          What went over the wire
        </h2>
        <ToolTag>stand-in API</ToolTag>
      </div>
      <div className="space-y-4 p-4 text-sm">
        {exchange ? (
          <>
            <Wire
              label="Request"
              firstLine={`${exchange.request.method} ${exchange.request.path}`}
              headers={exchange.request.headers}
              body={exchange.request.body}
            />
            <Wire
              label="Response"
              firstLine={`HTTP ${exchange.response.status}`}
              headers={exchange.response.headers}
              body={exchange.response.body}
            />
            {result ? (
              <div className="rounded-md bg-tool-tint p-3 text-tool" data-testid="exchange-outcome">
                <Explanation result={result} />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p>
              Submit the form and the request and the raw response appear here, beside the message the user sees. The form
              sends a JSON number and an ISO date, never formatted text, and every call carries <Code>Accept-Language</Code>.
            </p>
            <p>
              The API is a stand-in for the .NET API: a few serverless functions that answer with problem details carrying a
              stable <Code>code</Code> and its <Code>values</Code>.
            </p>
            <div>
              <p className="font-medium">Three rules only the server can check, one per shortcut button above the form:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  <Code>PO-26-1185</Code>: its lot is on hold. The code has a translation in all three languages.
                </li>
                <li>
                  <Code>PO-26-1184</Code> with a quantity of 500 or more: over the planned quantity. The values in the message are
                  formatted for the language.
                </li>
                <li>
                  <Code>PO-26-1187</Code>: its line is in changeover. This client has no text for that code, so the server’s
                  English text is shown and the code is listed on Translation status.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
