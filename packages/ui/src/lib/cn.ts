import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the custom scales from tokens/theme.css, so e.g.
// `text-code` counts as a font size and never drops a `text-fg` color.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["code", "prose"],
      radius: ["control", "card", "dialog"],
      shadow: ["1", "2"],
    },
  },
});

/** Joins class names and lets later Tailwind utilities override earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
