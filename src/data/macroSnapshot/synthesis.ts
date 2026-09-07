import type { MacroDomainState, MacroDomainId, MacroSynthesis } from './types';

type SynthesisRole = 'supporting' | 'conflicting' | 'contextual';

function synthesisRole(domain: MacroDomainState): SynthesisRole {
  if (domain.id === 'growth' || domain.id === 'labor') {
    if (domain.state === 'strengthening') return 'supporting';
    if (domain.state === 'weakening') return 'conflicting';
  }
  return 'contextual';
}

function labelsFor(domains: MacroDomainState[], ids: MacroDomainId[]): string {
  return domains
    .filter(domain => ids.includes(domain.id))
    .map(domain => domain.label)
    .join('、');
}

function result(
  label: string,
  explanation: string,
  supportingDomainIds: MacroDomainId[],
  conflictingDomainIds: MacroDomainId[],
  contextualDomainIds: MacroDomainId[],
): MacroSynthesis {
  return {
    label,
    explanation,
    supportingDomainIds,
    conflictingDomainIds,
    contextualDomainIds,
  };
}

export function deriveSynthesis(domains: MacroDomainState[]): MacroSynthesis {
  const supportingDomainIds = domains
    .filter(domain => synthesisRole(domain) === 'supporting')
    .map(domain => domain.id);
  const conflictingDomainIds = domains
    .filter(domain => synthesisRole(domain) === 'conflicting')
    .map(domain => domain.id);
  const contextualDomainIds = domains
    .filter(domain => synthesisRole(domain) === 'contextual')
    .map(domain => domain.id);
  const supportingLabels = labelsFor(domains, supportingDomainIds);
  const conflictingLabels = labelsFor(domains, conflictingDomainIds);
  const contextualLabels = labelsFor(domains, contextualDomainIds);
  const contextualNote = contextualLabels
    ? ` ${contextualLabels}保留为各自领域的背景证据，不纳入统一的改善/走弱判断。`
    : '';

  if (supportingDomainIds.length > 0 && conflictingDomainIds.length > 0) {
    return result(
      '增长与劳动信号分化',
      `${supportingLabels}显示活动或劳动方向改善；${conflictingLabels}显示活动或劳动方向走弱，保留跨域冲突。${contextualNote}`,
      supportingDomainIds,
      conflictingDomainIds,
      contextualDomainIds,
    );
  }
  if (supportingDomainIds.length >= 2) {
    return result(
      '活动与劳动方向改善',
      `${supportingLabels}显示活动或劳动方向改善，但其他领域仍需分别解读。${contextualNote}`,
      supportingDomainIds,
      conflictingDomainIds,
      contextualDomainIds,
    );
  }
  if (conflictingDomainIds.length >= 2) {
    return result(
      '活动与劳动方向走弱',
      `${conflictingLabels}显示活动或劳动方向走弱，但其他领域仍需分别解读。${contextualNote}`,
      supportingDomainIds,
      conflictingDomainIds,
      contextualDomainIds,
    );
  }
  if (supportingDomainIds.length === 1) {
    return result(
      '局部改善，领域分别解读',
      `${supportingLabels}显示局部活动或劳动方向改善，不能据此合并其他领域的价格、融资、政策或外部证据。${contextualNote}`,
      supportingDomainIds,
      conflictingDomainIds,
      contextualDomainIds,
    );
  }
  if (conflictingDomainIds.length === 1) {
    return result(
      '局部走弱，领域分别解读',
      `${conflictingLabels}显示局部活动或劳动方向走弱，不能据此合并其他领域的价格、融资、政策或外部证据。${contextualNote}`,
      supportingDomainIds,
      conflictingDomainIds,
      contextualDomainIds,
    );
  }
  return result(
    '多域分别解读',
    `当前没有足够一致的活动或劳动方向形成总判断。${contextualLabels ? `${contextualLabels}保留为各自领域的背景证据。` : ''}`,
    supportingDomainIds,
    conflictingDomainIds,
    contextualDomainIds,
  );
}
