function periodRank(period) {
  const quarter = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarter) return Number(quarter[1]) * 4 + Number(quarter[2]);

  const combined = period.match(/^(\d{4})-(\d{2})–(\d{2})$/);
  if (combined) return Number(combined[1]) * 12 + Number(combined[3]);

  const month = period.match(/^(\d{4})-(\d{2})$/);
  if (month) return Number(month[1]) * 12 + Number(month[2]);

  return null;
}

export function parseCoverage(coverage) {
  return coverage.split(';').map((part) => {
    const annual = part.trim().match(/^(.+?)\s+to\s+(.+?)\s+\(annual\)$/);
    if (annual) return { start: annual[1], end: annual[2], annual: true };
    const range = part.trim().match(/^(.+?)\s+to\s+(.+)$/);
    return range
      ? { start: range[1], end: range[2], annual: false }
      : { start: part.trim(), end: part.trim(), annual: false };
  });
}

export function coversPeriod(coverage, period) {
  const targetRank = periodRank(period);
  if (targetRank === null) return false;

  return parseCoverage(coverage).some(({ start, end, annual }) => {
    const startRank = periodRank(start);
    const endRank = periodRank(end);
    if (startRank === null || endRank === null || startRank > endRank) return false;
    if (annual && period.slice(5) !== start.slice(5)) return false;
    return startRank <= targetRank && targetRank <= endRank;
  });
}

export function isDataSource(source) {
  return (source.role ?? 'data') === 'data';
}
