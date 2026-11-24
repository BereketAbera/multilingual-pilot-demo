// Makes the translation report available to the app as "virtual:i18n-report".
// It is built by the same code the command line check runs, so the Translation
// status page and "pnpm i18n:check" can never disagree.

import type { Plugin } from 'vite';
import { exitCode, fallbackSummary, formatReport, reportForProject, verdict } from '../scripts/lib/catalog.mjs';

const ID = 'virtual:i18n-report';
const RESOLVED = `\0${ID}`;

export function i18nReport(): Plugin {
  let root = process.cwd();
  return {
    name: 'i18n-report',
    configResolved(config) {
      root = config.root;
    },
    resolveId(id) {
      return id === ID ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      const report = reportForProject(root);
      const run = (strict: boolean) => ({
        text: formatReport(report, { strict }),
        verdict: verdict(report, { strict }),
        exitCode: exitCode(report, { strict }),
      });
      return [
        `export const report = ${JSON.stringify(report)};`,
        `export const fallbackSummary = ${JSON.stringify(fallbackSummary(report))};`,
        `export const check = ${JSON.stringify(run(false))};`,
        `export const strictCheck = ${JSON.stringify(run(true))};`,
      ].join('\n');
    },
  };
}
