// Canned responses so the app works end to end without an API key (demo mode).

export const mockAsk = (q: string) => `**Demo mode.** Add an \`ANTHROPIC_API_KEY\` to \`.env\` for real answers.

A real answer to “${q.slice(0, 100)}” would draw on the cards in your current trail and cite them, for example (How Card Payments Work, p. 3).`;

export const mockExplain = (passage: string, depth: string) =>
  `**Demo mode** (${depth}). With an API key, Claude would explain “${passage.slice(0, 80)}${passage.length > 80 ? "…" : ""}” here, grounded in the card you are reading.`;

export const mockSummary = () =>
  `**Demo mode.** With an API key, Claude would draft your understanding note from the cards and notes in this tree. You can then edit it freely.`;
