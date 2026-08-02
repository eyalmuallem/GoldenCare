export const DAYS = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
];

export const PAYMENT_METHODS = [
  { value: 'direct_debit', label: 'הוראת קבע' },
  { value: 'checks', label: 'שיקים' },
  { value: 'other', label: 'שונות' },
];

export const ENROLLMENT_STATUSES = {
  active: 'פעיל ומשלם',
  paused: 'בהקפאה',
  no_charge: 'פעיל ללא חיוב',
  ended: 'סיים פעילות',
};

export const CHARGE_STATUSES = {
  unpaid: 'לא שולם',
  paid: 'שולם',
  partial: 'שולם חלקית',
  exempt: 'פטור',
  no_charge: 'לא מחויב',
};

export const ATTENDANCE_STATUSES = {
  present: 'נוכח',
  absent: 'נעדר',
  late: 'איחר',
  excused: 'היעדרות מאושרת',
  expected_absence: 'לא צפוי להגיע',
};

export const GROUP_STATUSES = {
  active: 'פעילה',
  future: 'עתידית',
  paused: 'מוקפאת',
  completed: 'הסתיימה',
};

export const ROLES = {
  admin: 'מנהל',
  coach: 'מאמן',
};
