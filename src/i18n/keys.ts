// Message keys are typed from the English files, so a mistyped key fails the type check.

import type common from './locales/en/common.json';
import type errors from './locales/en/errors.json';
import type lot from './locales/en/lot.json';
import type orders from './locales/en/orders.json';
import type output from './locales/en/output.json';

interface SourceCatalogs {
  common: typeof common;
  orders: typeof orders;
  lot: typeof lot;
  output: typeof output;
  errors: typeof errors;
}

type PluralForm = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
type WithoutPluralForm<K extends string> = K extends `${infer Base}_${PluralForm}` ? Base : K;

export type MessageKey = {
  [N in keyof SourceCatalogs]: `${N}:${WithoutPluralForm<keyof SourceCatalogs[N] & string>}`;
}[keyof SourceCatalogs];

export type MessageValues = Record<string, string | number>;
