import { getLearningContext, learningStepHref, publishedLearningPaths } from '../data/learningPaths';
import { contextualConceptHref, learningContextFromSearch, learningStorageKey, parseLearningProgress, recordVisit, resumeStep, saveLearningProgress, setStepRead } from '../data/learningProgress';

const root = document.querySelector<HTMLElement>('[data-learning-path]');
const path = publishedLearningPaths.find(path => path.id === root?.dataset.learningPath);
const currentStep = path?.steps.find(step => step.id === root?.dataset.learningStep);
let progress = parseLearningProgress(null);
try { progress = parseLearningProgress(localStorage.getItem(learningStorageKey)); } catch { /* Read without persistence. */ }

function save(reportFailure = false) {
  try {
    if (!saveLearningProgress(localStorage, progress)) throw new Error('Progress storage unavailable');
    return true;
  } catch {
    if (reportFailure) document.querySelectorAll<HTMLElement>('[data-save-status]').forEach(el => { el.textContent = '此浏览器无法保存进度，你仍可以继续阅读。'; });
    return false;
  }
}

function renderProgress() {
  if (path) {
    const saved = progress.paths[path.id];
    const completed = saved?.completedStepIds ?? [];
    document.querySelectorAll<HTMLElement>('[data-step-status]').forEach(el => {
      const id = el.dataset.stepStatus!;
      el.textContent = `${id === currentStep?.id ? '当前 · ' : ''}${completed.includes(id) ? '已读' : '未读'}`;
    });
    document.querySelectorAll<HTMLElement>('[data-route-progress]').forEach(el => {
      el.textContent = completed.length === path.steps.length ? '已读完这条路线' : `已读 ${completed.length} / ${path.steps.length} 步`;
    });
    document.querySelectorAll<HTMLButtonElement>('[data-toggle-read]').forEach(button => {
      const read = completed.includes(currentStep?.id ?? '');
      button.textContent = read ? '撤销本步已读' : '标为已读';
      button.setAttribute('aria-pressed', String(read));
    });
    document.querySelectorAll<HTMLAnchorElement>('[data-path-start]').forEach(link => {
      if (!saved) return;
      const step = resumeStep(path, saved);
      link.href = learningStepHref(path.id, step.id);
      link.textContent = completed.length === path.steps.length ? '查看路线回顾 →' : `继续：${step.title} →`;
    });
  }
  document.querySelectorAll<HTMLElement>('[data-learning-card]').forEach(card => {
    const route = publishedLearningPaths.find(item => item.id === card.dataset.learningCard);
    if (!route) return;
    const saved = progress.paths[route.id];
    const link = card.querySelector<HTMLAnchorElement>('[data-card-resume]')!;
    const label = card.querySelector<HTMLElement>('[data-card-progress]')!;
    label.hidden = !saved;
    if (!saved) {
      link.href = '/learn/' + route.id + '/';
      link.textContent = '查看路线与学习目标 →';
      label.textContent = '';
      return;
    }
    const step = resumeStep(route, saved);
    link.href = learningStepHref(route.id, step.id);
    link.textContent = saved.completedStepIds.length === route.steps.length ? '查看路线回顾 →' : `继续：${step.title} →`;
    label.textContent = `已读 ${saved.completedStepIds.length} / ${route.steps.length} 步`;
  });
}

if (path && currentStep) {
  progress = recordVisit(progress, path, currentStep.id, Date.now());
  save();
  document.querySelectorAll<HTMLElement>('[data-learning-controls], [data-read-next]').forEach(el => { el.hidden = false; });
  document.querySelectorAll<HTMLElement>('[data-next-link]').forEach(el => { el.classList.remove('learning-button'); el.textContent = '直接下一步 →'; });
  const mark = (read: boolean) => {
    const previous = progress;
    progress = setStepRead(progress, path, currentStep.id, read);
    if (!save(true)) { progress = previous; return false; }
    renderProgress();
    document.querySelectorAll<HTMLElement>('[data-save-status]').forEach(el => { el.textContent = read ? '已在本机保存本步已读。' : '已撤销本步已读。'; });
    return true;
  };
  document.querySelectorAll('[data-toggle-read]').forEach(button => button.addEventListener('click', () => mark(!progress.paths[path.id]?.completedStepIds.includes(currentStep.id))));
  document.querySelectorAll('[data-read-next]').forEach(link => link.addEventListener('click', event => {
    if (event instanceof MouseEvent && (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
    // On failure stay here so the message is visible; the normal next link remains available.
    if (!mark(true)) event.preventDefault();
  }));
}

const context = path && currentStep ? getLearningContext(path.id, currentStep.id) : learningContextFromSearch(location.search);
if (context) {
  if (!currentStep) {
    document.querySelectorAll<HTMLElement>('[data-learning-return]').forEach(panel => {
      panel.hidden = false;
      const link = panel.querySelector<HTMLAnchorElement>('[data-learning-return-link]')!;
      link.href = learningStepHref(context.path.id, context.step.id);
      link.textContent = `返回 ${context.path.title} · 第 ${context.path.steps.indexOf(context.step) + 1} 步 →`;
    });
  }
  document.querySelectorAll<HTMLAnchorElement>('.detail-article a[href], [data-learning-supplement] a[href]').forEach(link => {
    if (link.closest('[data-no-learning-context]')) return;
    const href = contextualConceptHref(link.href, location.origin, context.path.id, context.step.id, Boolean(currentStep));
    if (href) link.setAttribute('href', href);
  });
}
document.querySelectorAll<HTMLDetailsElement>('.learning-mobile-menu').forEach(menu => {
  menu.addEventListener('keydown', event => { if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary')?.focus(); } });
});
// Reload from storage on back/forward cache restoration and across tabs.
function refresh() {
  try { progress = parseLearningProgress(localStorage.getItem(learningStorageKey)); } catch { return; }
  renderProgress();
}
window.addEventListener('pageshow', refresh);
window.addEventListener('storage', event => { if (event.key === learningStorageKey || event.key === null) refresh(); });
renderProgress();
