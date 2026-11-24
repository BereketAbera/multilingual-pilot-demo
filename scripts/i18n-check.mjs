#!/usr/bin/env node
// pnpm i18n:check            fails on errors, reports what will fall back
// pnpm i18n:check --strict   also fails when anything would fall back (run before a release)

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitCode, formatReport, reportForProject } from './lib/catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const report = reportForProject(root);

console.log(formatReport(report, { strict }));
process.exit(exitCode(report, { strict }));
