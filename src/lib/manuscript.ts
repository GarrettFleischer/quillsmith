/** Strip a stored "Act 3:" / "Chapter 2" prefix so only a custom name remains. */
export function actName(storedTitle: string | null | undefined): string {
  return (storedTitle ?? "").replace(/^Act\s+\d+\s*[:.\-]?\s*/i, "").trim();
}

export function chapterName(storedTitle: string | null | undefined): string {
  return (storedTitle ?? "").replace(/^Chapter\s+\d+\s*[:.\-]?\s*/i, "").trim();
}

/** Positional label. Custom names travel with the row; the number is the index. */
export function actLabel(index: number, storedTitle?: string | null): string {
  const name = actName(storedTitle);
  return name ? `Act ${index + 1}: ${name}` : `Act ${index + 1}`;
}

export function chapterLabel(index: number, storedTitle?: string | null): string {
  const name = chapterName(storedTitle);
  return name ? `Chapter ${index + 1}: ${name}` : `Chapter ${index + 1}`;
}

export function findChapterPlace<
  TAct extends { id: string; title: string; chapters: TChapter[] },
  TChapter extends { id: string; title: string },
>(acts: TAct[], chapterId: string) {
  for (let actIndex = 0; actIndex < acts.length; actIndex++) {
    const act = acts[actIndex];
    const chapterIndex = act.chapters.findIndex((chapter) => chapter.id === chapterId);
    if (chapterIndex >= 0) {
      return { act, chapter: act.chapters[chapterIndex], actIndex, chapterIndex };
    }
  }
  return null;
}
