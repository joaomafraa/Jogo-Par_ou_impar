import type { ParityChoice } from "./types";

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function formatParity(parity: ParityChoice) {
  return parity === "odd" ? "Impar" : "Par";
}
