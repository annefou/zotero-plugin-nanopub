import { config } from "../../package.json";

// English-only locale strings
const localeStrings: { [key: string]: string } = {
  "nanopub.menu.create": "Create Nanopublication on Nanodash",
  "nanopub.menu.tools": "Nanopublication Manager",
  "nanopub.prompt.title": "Nanopublication URL",
  "nanopub.prompt.text": "Please paste the URL of the nanopublication:",
  "nanopub.error.title": "Error",
  "nanopub.error.noItem": "No item selected. Please select an item first.",
  "nanopub.error.invalidUrl": "Invalid URL provided. Please provide a valid HTTP/HTTPS URL.",
  "nanopub.error.general": "An error occurred",
  "nanopub.success": "Nanopublication linked successfully!",
  "nanopub.success.title": "Success",
};

export async function initLocale() {
  // Simple initialization for English-only
  // Can be extended later if translations are needed
}

export function getString(key: string): string {
  return localeStrings[key] || key;
}

export function formatString(key: string, ...args: any[]): string {
  let str = getString(key);
  
  // Simple format replacement: {0}, {1}, etc.
  for (let i = 0; i < args.length; i++) {
    str = str.replace(new RegExp(`\\{${i}\\}`, "g"), args[i]);
  }
  
  return str;
}
