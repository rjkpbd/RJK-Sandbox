export function buildSystemPrompt(
  global: string | null | undefined,
  project: string | null | undefined,
  conversation: string | null | undefined,
  skillBodies?: string[],
  projectContext?: string | null
): string | undefined {
  const layers = [global, project, projectContext, conversation].filter(
    (p): p is string => typeof p === "string" && p.trim().length > 0
  );
  const skills = (skillBodies ?? []).filter((s) => s.trim().length > 0);
  const all = [...layers, ...skills];
  if (all.length === 0) return undefined;
  return all.join("\n\n---\n\n");
}
