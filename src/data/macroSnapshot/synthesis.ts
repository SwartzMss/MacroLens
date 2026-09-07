import type { MacroDomainState, MacroSynthesis } from './types';

const positiveStates = new Set(['strengthening', 'easing']);
const negativeStates = new Set(['weakening', 'tightening', 'elevated']);

export function deriveSynthesis(domains: MacroDomainState[]): MacroSynthesis {
  const supportingDomainIds = domains
    .filter(domain => positiveStates.has(domain.state))
    .map(domain => domain.id);
  const conflictingDomainIds = domains
    .filter(domain => negativeStates.has(domain.state))
    .map(domain => domain.id);
  const supportingLabels = domains
    .filter(domain => supportingDomainIds.includes(domain.id))
    .map(domain => domain.label)
    .join('、');
  const conflictingLabels = domains
    .filter(domain => conflictingDomainIds.includes(domain.id))
    .map(domain => domain.label)
    .join('、');

  if (supportingDomainIds.length > 0 && conflictingDomainIds.length > 0) {
    return {
      label: '混合与分化信号',
      explanation: `支持改善的领域包括 ${supportingLabels}；走弱或收紧的领域包括 ${conflictingLabels}，因此保留跨域冲突。`,
      supportingDomainIds,
      conflictingDomainIds,
    };
  }
  if (supportingDomainIds.length >= 2) {
    return {
      label: '多域改善信号',
      explanation: `${supportingLabels}呈现改善或政策条件缓和，但仍需结合其余领域的分化证据。`,
      supportingDomainIds,
      conflictingDomainIds,
    };
  }
  if (conflictingDomainIds.length >= 2) {
    return {
      label: '多域走弱压力',
      explanation: `${conflictingLabels}呈现走弱或政策条件收紧，其他领域若分化则不强行合并。`,
      supportingDomainIds,
      conflictingDomainIds,
    };
  }
  return {
    label: '多域混合信号',
    explanation: '领域状态以稳定、混合或分化为主，当前没有足够一致的方向形成单一总判断。',
    supportingDomainIds,
    conflictingDomainIds,
  };
}
