// Makes the translation report available to the app as "virtual:i18n-report".
// It is built by the same code the command line check runs, so the Translation
// status page and "pnpm i18n:check" can never disagree.

import type { Plugin } from 'vite';
import { formatReport, reportForProject } from '../scripts/lib/catalog.mjs';

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
      return [
        `export const report = ${JSON.stringify(report)};`,
        `export const output = ${JSON.stringify(formatReport(report))};`,
        `export const strictOutput = ${JSON.stringify(formatReport(report, { strict: true }))};`,
      ].join('\n');
    },
  };
}
