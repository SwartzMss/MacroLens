import { getLearningContext, learningStepHref, publishedLearningPaths, type LearningPath } from './learningPaths';

export const learningStorageKey = 'macrolens.learning.v1';
export type PathProgress = { revision: number; lastVisitedStepId: string; completedStepIds: string[]; visitedAt: number };
export type LearningProgress = { version: 1; paths: Record<string, PathProgress> };
export function emptyProgress(): LearningProgress { return { version: 1, paths: {} }; }

export function saveLearningProgress(storage: { setItem(key: string, value: string): void }, progress: LearningProgress): boolean {
  try { storage.setItem(learningStorageKey, JSON.stringify(progress)); return true; } catch { return false; }
}

export function parseLearningProgress(raw: string | null): LearningProgress {
  const result = emptyProgress();
  if (!raw) return result;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.paths || typeof value.paths !== 'object') return result;
    for (const path of publishedLearningPaths) {
      if (!Object.hasOwn(value.paths, path.id)) continue;
      const saved = value.paths[path.id];
      if (!saved || !Array.isArray(saved.completedStepIds)) continue;
      const ids = new Set(path.steps.map(step => step.id));
      const completedStepIds = [...new Set<string>(saved.completedStepIds.filter((id: unknown) => typeof id === 'string' && ids.has(id)))];
      const lastVisitedStepId = ids.has(saved.lastVisitedStepId) ? saved.lastVisitedStepId :
        path.steps.find(step => !completedStepIds.includes(step.id))?.id ?? path.steps.at(-1)!.id;
      result.paths[path.id] = { revision: path.revision, lastVisitedStepId, completedStepIds, visitedAt: typeof saved.visitedAt === 'number' && Number.isFinite(saved.visitedAt) ? saved.visitedAt : 0 };
    }
  } catch { /* A damaged or unavailable record must never block reading. */ }
  return result;
}
export function recordVisit(progress: LearningProgress, path: LearningPath, stepId: string, now: number): LearningProgress {
  if (!path.steps.some(step => step.id === stepId)) return progress;
  return { ...progress, paths: { ...progress.paths, [path.id]: { revision: path.revision, lastVisitedStepId: stepId, completedStepIds: progress.paths[path.id]?.completedStepIds ?? [], visitedAt: now } } };
}
export function setStepRead(progress: LearningProgress, path: LearningPath, stepId: string, read: boolean): LearningProgress {
  if (!path.steps.some(step => step.id === stepId)) return progress;
  const current = progress.paths[path.id] ?? { revision: path.revision, lastVisitedStepId: stepId, completedStepIds: [], visitedAt: 0 };
  const ids = new Set(current.completedStepIds);
  if (read) ids.add(stepId); else ids.delete(stepId);
  return { ...progress, paths: { ...progress.paths, [path.id]: { ...current, completedStepIds: [...ids] } } };
}
export function resumeStep(path: LearningPath, progress?: PathProgress) {
  if (progress?.completedStepIds.length === path.steps.length) return path.steps.at(-1)!;
  return path.steps.find(step => step.id === progress?.lastVisitedStepId) ?? path.steps[0];
}

// Only registered local routes can become a return destination.
export function learningContextFromSearch(search: string) {
  const params = new URLSearchParams(search);
  return getLearningContext(params.get('learnPath'), params.get('learnStep'));
}
export function contextualConceptHref(href: string, origin: string, pathId: string, stepId: string, inLearningPage: boolean): string | null {
  const context = getLearningContext(pathId, stepId);
  if (!context) return null;
  const url = new URL(href, origin);
  const match = url.pathname.match(/^\/concepts\/([a-z0-9-]+)\/?$/);
  if (url.origin !== origin || !match) return null;
  const target = context.path.steps.find(step => step.conceptId === match[1]);
  if (inLearningPage && target) return learningStepHref(pathId, target.id) + url.hash;
  url.searchParams.set('learnPath', pathId);
  url.searchParams.set('learnStep', stepId);
  return url.pathname + url.search + url.hash;
}
