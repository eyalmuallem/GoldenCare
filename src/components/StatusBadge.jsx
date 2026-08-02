export default function StatusBadge({ value, labels = {}, tone }) {
  const resolvedTone = tone || value || 'neutral';
  return <span className={`status-badge status-${resolvedTone}`}>{labels[value] || value}</span>;
}
