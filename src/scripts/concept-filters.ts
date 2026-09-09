const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
const count = document.querySelector<HTMLElement>('[data-filter-count]');
const categoryCount = document.querySelector<HTMLElement>('[data-filter-category-count]');
const empty = document.querySelector<HTMLElement>('[data-filter-empty]');

function selected(name: string) {
  return form?.elements.namedItem(name) as HTMLSelectElement | null;
}

function apply() {
  const category = selected('category')?.value ?? 'all';
  const topic = selected('topic')?.value ?? 'all';
  const level = selected('level')?.value ?? 'all';
  let visible = 0;

  for (const card of cards) {
    const matches = (category === 'all' || card.dataset.category === category)
      && (topic === 'all' || card.dataset.topics?.split(' ').includes(topic))
      && (level === 'all' || card.dataset.level === level);
    card.hidden = !matches;
    if (matches) visible += 1;
  }
  let visibleCategories = 0;
  for (const section of sections) {
    const matches = section.querySelectorAll('[data-concept-card]:not([hidden])').length;
    section.hidden = matches === 0;
    if (matches) visibleCategories += 1;
    const sectionCount = section.querySelector<HTMLElement>('[data-category-count]');
    if (sectionCount) sectionCount.textContent = `${matches} 个概念`;
  }
  if (count) count.textContent = `${visible} 个概念`;
  if (categoryCount) categoryCount.textContent = `${visibleCategories} 个领域`;
  if (empty) empty.hidden = visible !== 0;
}

form?.addEventListener('change', apply);
document.querySelector<HTMLButtonElement>('[data-filter-reset]')?.addEventListener('click', () => {
  form?.reset();
  apply();
  selected('category')?.focus();
});
apply();
