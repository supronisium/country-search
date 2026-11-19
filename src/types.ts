export interface CountryCard {
  name: string;
  flag: string;
  capital: string;
  region: string;
  population: number;
  description: string;
  area: number | null;
  borders: string[];
  languages: string[];
  currency: string[];
}

export interface CountryApiResponse {
  name?: string | { common?: string; official?: string };
  flags?: { svg?: string; png?: string; alt?: string };
  flag?: string;
  capital?: string | string[];
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  borders?: string[];
  languages?: Record<string, string> | Array<string | { name?: string; [key: string]: unknown }>;
  currencies?: Record<string, { name?: string; symbol?: string }> |
    Array<string | { name?: string; code?: string; symbol?: string }>;
  [key: string]: unknown;
}
