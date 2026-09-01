const form = document.querySelector<HTMLFormElement>('[data-concept-filters]');
const cards = [...document.querySelectorAll<HTMLElement>('[data-concept-card]')];
const sections = [...document.querySelectorAll<HTMLElement>('[data-category-section]')];
const count = document.querySelector<HTMLElement>('[data-filter-count]');

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
  for (const section of sections) {
    section.hidden = !section.querySelector('[data-concept-card]:not([hidden])');
  }
  if (count) count.textContent = `${visible} 个概念`;
}

form?.addEventListener('change', apply);
apply();
