export function compileTemplate(
  template: string,
  bag: Record<string, string | undefined | null>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => bag[key] ?? "");
}
