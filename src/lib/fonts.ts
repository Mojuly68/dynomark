/**
 * Font stacks: SF Pro on Apple devices (system font, never bundled: Apple's licence doesn't allow it),
 * self-hosted Roboto everywhere else. `system-ui` is left out on purpose so Windows gets Roboto, not Segoe UI.
 * Keep in sync with the --font-* variables in index.css.
 */
export const FONT_SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Roboto Variable", Roboto, sans-serif';
export const FONT_DISPLAY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Roboto Variable", Roboto, sans-serif';
export const FONT_MONO = 'ui-monospace, "SF Mono", "Roboto Mono Variable", "Roboto Mono", monospace';
