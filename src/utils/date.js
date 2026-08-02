import { DAYS } from '../constants';

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function currentMonth() {
  return todayIso().slice(0, 7);
}

export function monthLabel(month) {
  if (!month) return '';
  const [year, value] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(
    new Date(year, value - 1, 1)
  );
}

export function formatDate(date) {
  if (!date) return '';
  return new Intl.DateTimeFormat('he-IL').format(new Date(`${date}T12:00:00`));
}

export function weekdayFromIso(date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return day === 0 ? 0 : day;
}

export function dayLabel(day) {
  return DAYS.find((item) => item.value === Number(day))?.label || '';
}

export function isMonthInRange(month, startMonth, endMonth) {
  if (!month || !startMonth) return false;
  return month >= startMonth && (!endMonth || month <= endMonth);
}

export function groupStatusByMonth(group, month = currentMonth()) {
  if (group.status === 'paused') return 'paused';
  if (month < group.startMonth) return 'future';
  if (group.endMonth && month > group.endMonth) return 'completed';
  return 'active';
}

export function getStatusForMonth(history = [], month) {
  const sorted = [...history].sort((a, b) => a.fromMonth.localeCompare(b.fromMonth));
  let status = 'active';
  for (const item of sorted) {
    if (item.fromMonth <= month) status = item.status;
  }
  return status;
}

export function scheduleForDate(group, date) {
  const day = weekdayFromIso(date);
  return (group.schedule || []).find((slot) => Number(slot.dayOfWeek) === day) || null;
}
