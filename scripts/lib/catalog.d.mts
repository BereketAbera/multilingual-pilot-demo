export type NamespaceCatalog = Record<string, string>;
export type LocaleCatalog = Record<string, NamespaceCatalog>;
export type Catalogs = Record<string, LocaleCatalog>;

export interface MissingItem {
  namespace: string;
  key: string;
  source: string;
  forms: string[];
}

export interface LocaleReport {
  locale: string;
  generated: boolean;
  total: number;
  translated: number;
  missing: MissingItem[];
  extra: Array<{ namespace: string; key: string }>;
  placeholderMismatches: Array<{ namespace: string; key: string; expected: string[]; found: string[] }>;
}

export interface BackendCodeReport {
  code: string;
  values: string[];
  texts: Record<string, boolean>;
}

export interface Report {
  sourceLocale: string;
  pseudoLocale: string;
  namespaces: string[];
  total: number;
  locales: LocaleReport[];
  unused: Array<{ namespace: string; key: string; source: string }>;
  unknownKeys: Array<{ key: string; file: string }>;
  backend: { codes: BackendCodeReport[]; withoutText: string[]; textsWithoutCode: string[] };
  pseudoInSync: boolean;
  errors: string[];
  softCount: number;
}

export interface ApiCode {
  code: string;
  values: Record<string, string>;
}

export const SOURCE_LOCALE: string;
export const PSEUDO_LOCALE: string;
export const BACKEND_NAMESPACE: string;
export const PLURAL_FORMS: string[];

export function loadCatalogs(localesDir: string): Catalogs;
export function placeholders(text: string): string[];
export function splitPlural(key: string): { base: string; form: string | null };
export function requiredPluralForms(locale: string): string[];
export function pseudoText(text: string): string;
export function buildPseudoCatalog(source: LocaleCatalog): LocaleCatalog;
export function scanKeyUsage(srcDir: string, namespaces: string[]): Map<string, string>;
export function buildReport(input: { catalogs: Catalogs; usedKeys: Map<string, string>; apiCodes: ApiCode[] }): Report;
export function exitCode(report: Report, options?: { strict?: boolean }): 0 | 1;
export function formatReport(report: Report, options?: { strict?: boolean }): string;
export function reportForProject(root: string): Report;
