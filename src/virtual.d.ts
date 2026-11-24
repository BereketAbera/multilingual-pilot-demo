declare module 'virtual:i18n-report' {
  export const report: import('../scripts/lib/catalog.mjs').Report;
  /** What "pnpm i18n:check" prints. */
  export const output: string;
  /** What "pnpm i18n:check --strict" prints. */
  export const strictOutput: string;
}
