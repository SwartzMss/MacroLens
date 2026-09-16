import { publishedLearningPaths, learningStepHref } from './learningPaths';

export const learningArticleId = (conceptId: string) => `learn:${conceptId}`;

// One article can be read in several routes. Keep identity independent of URLs.
export const learningArticles = [...new Set(publishedLearningPaths.flatMap(path =>
  path.steps.flatMap(step => step.kind === 'concept' && step.conceptId ? [step.conceptId] : []),
))].map(conceptId => ({
  conceptId,
  pageId: learningArticleId(conceptId),
  paths: publishedLearningPaths.flatMap(path => path.steps
    .filter(step => step.kind === 'concept' && step.conceptId === conceptId)
    .map(step => learningStepHref(path.id, step.id).replace(/\/$/, ''))),
}));

export const isLearningArticleId = (value: unknown): value is string =>
  typeof value === 'string' && learningArticles.some(article => article.pageId === value);

export const learningArticleForPath = (path: string) =>
  learningArticles.find(article => article.paths.includes(path));
