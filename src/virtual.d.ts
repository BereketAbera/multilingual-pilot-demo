declare module 'virtual:i18n-report' {
  interface Run {
    /** Everything the command prints. */
    text: string;
    /** Its last line. */
    verdict: string;
    exitCode: 0 | 1;
  }
  export const report: import('../scripts/lib/catalog.mjs').Report;
  /** What falls back, in words: "5 strings and 1 backend code". */
  export const fallbackSummary: string;
  /** "pnpm i18n:check" */
  export const check: Run;
  /** "pnpm i18n:check --strict" */
  export const strictCheck: Run;
}
