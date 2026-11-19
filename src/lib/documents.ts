export const outlines = {
  FSD: ["Document control", "Introduction", "Business context", "Stakeholders and roles", "Functional overview", "Detailed functional requirements", "Business rules", "Data requirements", "UI behavior", "Reports and integrations", "Non-functional requirements", "Acceptance criteria", "Assumptions and constraints", "Open issues and risks"],
  TSD: ["Document control", "Introduction", "Architecture overview", "Technology stack", "Component design", "Data model", "API and integration design", "Security", "Infrastructure and deployment", "Performance and availability", "Error handling and monitoring", "Testing strategy", "Technical risks"],
  SPD: ["Executive summary", "Understanding of the requirement", "Proposed solution", "Solution architecture", "Scope", "Delivery approach", "Timeline and milestones", "Team and governance", "Assumptions", "Risks and mitigations", "Effort and commercials", "Benefits and success measures", "Next steps"],
} as const;
export type DocumentKind = keyof typeof outlines;

export function splitIntoChunks(text: string, size = 1200, overlap = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  const result: string[] = [];
  for (let start = 0; start < clean.length; start += size - overlap) {
    const end = Math.min(start + size, clean.length);
    result.push(clean.slice(start, end));
    if (end === clean.length) break;
  }
  return result;
}

export function rankChunks(query: string, candidates: { content: string; chunkIndex: number }[], limit = 6) {
  const terms = [...new Set(query.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [])];
  return candidates.map((chunk) => {
    const content = chunk.content.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (content.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0), 0);
    return { ...chunk, score };
  }).filter((chunk) => chunk.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function extractJson<T>(value: string): T {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  const candidate = fenced ?? (start >= 0 && end >= start ? value.slice(start, end + 1) : "");
  if (!candidate) throw new Error("The model did not return valid structured data.");
  return JSON.parse(candidate) as T;
}
