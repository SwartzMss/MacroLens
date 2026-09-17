import { publishedLessonIds } from './courseOutline';
export const courseStorageKey = 'macrolens.course.v1';
export type CourseProgress = { version: 1; completed: string[]; lastVisited: string | null };
export function courseResumeTarget(progress: CourseProgress): { id: string; label: string } {
  const current = progress.lastVisited;
  if (current && publishedLessonIds.includes(current) && !progress.completed.includes(current)) {
    return { id: current, label: '继续阅读 →' };
  }
  const unread = publishedLessonIds.find(id => !progress.completed.includes(id));
  if (unread) return { id: unread, label: progress.completed.length ? '继续学习 →' : '开始第一章 →' };
  return { id: current && publishedLessonIds.includes(current) ? current : publishedLessonIds[0], label: '回顾已学内容 →' };
}
export function toggleCourseCompletion(progress: CourseProgress, lessonId: string): CourseProgress {
  if (!publishedLessonIds.includes(lessonId)) return progress;
  return { ...progress, completed: progress.completed.includes(lessonId)
    ? progress.completed.filter(id => id !== lessonId) : [...progress.completed, lessonId] };
}
export function saveCourseProgress(storage: Pick<Storage, 'setItem'>, progress: CourseProgress): boolean {
  try { storage.setItem(courseStorageKey, JSON.stringify(progress)); return true; } catch { return false; }
}
export function parseCourseProgress(raw: string | null): CourseProgress {
  const empty: CourseProgress = { version: 1, completed: [], lastVisited: null };
  try {
    const value = JSON.parse(raw ?? 'null');
    if (value?.version !== 1 || !Array.isArray(value.completed)) return empty;
    return { version: 1, completed: [...new Set<string>(value.completed.filter((id: unknown) => typeof id === 'string' && publishedLessonIds.includes(id)))], lastVisited: publishedLessonIds.includes(value.lastVisited) ? value.lastVisited : null };
  } catch { return empty; }
}
