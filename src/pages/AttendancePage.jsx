import {
  CalendarCheck2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Phone,
  Save,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ContactDrawer from '../components/ContactDrawer';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { ATTENDANCE_STATUSES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ensureSession,
  saveSessionAttendance,
  setSessionCancelled,
  subscribeGroups,
  subscribeSession,
} from '../services/dataService';
import { formatDate, isMonthInRange, scheduleForDate, todayIso } from '../utils/date';

const statusOptions = Object.entries(ATTENDANCE_STATUSES);

function shiftDate(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function groupsForDate(groups, date) {
  const month = date.slice(0, 7);
  return groups.filter((group) => (
    isMonthInRange(month, group.startMonth, group.endMonth)
    && group.status !== 'paused'
    && scheduleForDate(group, date)
  ));
}

function findScheduledDate(groups, fromDate, direction) {
  for (let distance = 1; distance <= 90; distance += 1) {
    const candidate = shiftDate(fromDate, distance * direction);
    if (groupsForDate(groups, candidate).length) return candidate;
  }
  return '';
}

export default function AttendancePage() {
  const { profile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(searchParams.get('date') || todayIso());
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get('group') || '');
  const [session, setSession] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contact, setContact] = useState(null);
  const autoOpenedRef = useRef('');

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeGroups(profile.orgId, profile, setGroups, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את הקבוצות.', 'error');
    });
  }, [profile, showToast]);

  const availableGroups = useMemo(() => groupsForDate(groups, date), [groups, date]);
  const selectedGroup = availableGroups.find((group) => group.id === selectedGroupId) || null;
  const records = useMemo(
    () => Object.values(attendance).sort((a, b) => a.childName.localeCompare(b.childName, 'he')),
    [attendance]
  );
  const previousTrainingDate = useMemo(() => findScheduledDate(groups, date, -1), [groups, date]);
  const nextTrainingDate = useMemo(() => findScheduledDate(groups, date, 1), [groups, date]);

  useEffect(() => {
    if (selectedGroupId && !availableGroups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId('');
      setSession(null);
      setAttendance({});
    }
  }, [availableGroups, selectedGroupId]);

  useEffect(() => {
    if (!profile?.orgId || !selectedGroupId || !date) {
      setSession(null);
      setAttendance({});
      return undefined;
    }
    setSearchParams({ group: selectedGroupId, date }, { replace: true });
    return subscribeSession(profile.orgId, selectedGroupId, date, (nextSession) => {
      setSession(nextSession);
      setAttendance(nextSession?.attendance || {});
    }, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את רשימת הנוכחות.', 'error');
    });
  }, [profile, selectedGroupId, date, setSearchParams, showToast]);

  async function openGroup(group, quiet = false) {
    autoOpenedRef.current = `${date}_${group.id}`;
    setSelectedGroupId(group.id);
    setSession(null);
    setAttendance({});
    setOpening(true);
    try {
      const created = await ensureSession(profile.orgId, group, date, profile.uid);
      setSession(created);
      setAttendance(created.attendance || {});
      if (!quiet) showToast('רשימת הנוכחות מוכנה לסימון.');
    } catch (error) {
      console.error(error);
      setSelectedGroupId('');
      setSession(null);
      setAttendance({});
      showToast('פתיחת רשימת הנוכחות נכשלה.', 'error');
    } finally {
      setOpening(false);
    }
  }

  useEffect(() => {
    const requestedGroupId = searchParams.get('group');
    if (!requestedGroupId || !profile?.orgId || !availableGroups.length) return;
    const group = availableGroups.find((item) => item.id === requestedGroupId);
    const key = `${date}_${requestedGroupId}`;
    if (group && autoOpenedRef.current !== key) {
      autoOpenedRef.current = key;
      openGroup(group, true);
    }
    // openGroup deliberately omitted: this effect is only for a link that supplied a group.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGroups, date, profile?.orgId, searchParams]);

  function changeDate(nextDate) {
    setDate(nextDate);
    setSelectedGroupId('');
    setSession(null);
    setAttendance({});
    setSearchParams({ date: nextDate }, { replace: true });
  }

  function updateRecord(childId, changes) {
    setAttendance((current) => ({
      ...current,
      [childId]: {
        ...current[childId],
        ...changes,
        updatedAt: new Date().toISOString(),
        updatedBy: profile.uid,
      },
    }));
  }

  function markAllPresent() {
    setAttendance((current) => Object.fromEntries(Object.entries(current).map(([id, record]) => [id, {
      ...record,
      status: 'present',
      updatedAt: new Date().toISOString(),
      updatedBy: profile.uid,
    }])));
  }

  async function save() {
    if (!session) return;
    setSaving(true);
    try {
      await saveSessionAttendance(profile.orgId, session, attendance, profile.uid);
      showToast('הנוכחות נשמרה.');
    } catch (error) {
      console.error(error);
      showToast('שמירת הנוכחות נכשלה.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCancelled() {
    if (!session) return;
    try {
      await setSessionCancelled(profile.orgId, session.id, !session.cancelled, profile.uid);
      showToast(session.cancelled ? 'האימון הוחזר לפעילות.' : 'האימון סומן כמבוטל.');
    } catch (error) {
      console.error(error);
      showToast('עדכון האימון נכשל.', 'error');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={isAdmin ? 'בקרה תפעולית' : 'סביבת המאמן'}
        title="מעקב נוכחות"
        description="בחר תאריך, לחץ על האימון הרצוי, סמן את החריגים ולבסוף שמור. כל המתאמנים מסומנים כנוכחים כברירת מחדל."
      />

      <section className="attendance-steps">
        <span><strong>1</strong> בוחרים תאריך</span>
        <span><strong>2</strong> פותחים אימון</span>
        <span><strong>3</strong> מסמנים נוכחות</span>
        <span><strong>4</strong> שומרים</span>
      </section>

      <section className="attendance-date-panel panel-inline">
        <label><span>תאריך אימון</span><input type="date" value={date} onChange={(event) => changeDate(event.target.value)} /></label>
        <div className="attendance-date-actions">
          <button className="button button-secondary" type="button" onClick={() => changeDate(previousTrainingDate)} disabled={!previousTrainingDate}><ChevronRight size={17} /> האימון הקודם</button>
          <button className="button button-secondary" type="button" onClick={() => changeDate(todayIso())}>היום</button>
          <button className="button button-secondary" type="button" onClick={() => changeDate(nextTrainingDate)} disabled={!nextTrainingDate}>האימון הבא <ChevronLeft size={17} /></button>
        </div>
        <div className="picker-summary"><CalendarCheck2 size={20} /><div><strong>{formatDate(date)}</strong><span>{availableGroups.length} אימונים מתוכננים</span></div></div>
      </section>

      {availableGroups.length ? (
        <section className="panel attendance-training-picker">
          <div className="panel-header">
            <div><span className="eyebrow">שלב 2</span><h2>בחר אימון</h2></div>
            <span className="record-count">{availableGroups.length} אימונים</span>
          </div>
          <div className="attendance-training-grid">
            {availableGroups.map((group) => {
              const groupSlot = scheduleForDate(group, date);
              const active = selectedGroupId === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  className={active ? 'attendance-training-card active' : 'attendance-training-card'}
                  onClick={() => openGroup(group)}
                  disabled={opening && !active}
                >
                  <span className="group-card-time">{groupSlot.startTime}–{groupSlot.endTime}</span>
                  <strong>{group.name}</strong>
                  <small>{group.coachName || 'ללא מאמן משויך'}</small>
                  <span className="text-link">{active && opening ? 'פותח רשימה...' : active ? 'האימון שנבחר' : 'פתיחת נוכחות'}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <EmptyState
          title="אין אימונים מתוכננים בתאריך זה"
          description="השתמש בכפתורי האימון הקודם או האימון הבא כדי לעבור ישירות ליום פעילות."
        />
      )}

      {selectedGroup && (opening || !session) ? (
        <section className="panel attendance-start">
          <div className="loader" />
          <h2>מכין את רשימת הנוכחות של {selectedGroup.name}</h2>
          <p>המערכת טוענת את המתאמנים הפעילים בקבוצה.</p>
        </section>
      ) : null}

      {session ? (
        <section className={`panel ${session.cancelled ? 'panel-cancelled' : ''}`}>
          <div className="panel-header attendance-header">
            <div><span className="eyebrow">{formatDate(date)} · {session.startTime}–{session.endTime}</span><h2>{session.groupName}</h2></div>
            <div className="button-group">
              <button className="button button-secondary" onClick={markAllPresent} disabled={session.cancelled}><CheckCheck size={18} /> סמן הכול כנוכח</button>
              <button className="button button-primary" onClick={save} disabled={saving || session.cancelled}><Save size={18} /> {saving ? 'שומר...' : 'שמירת נוכחות'}</button>
              {isAdmin ? <button className="button button-danger-outline" onClick={toggleCancelled}>{session.cancelled ? 'החזרת אימון' : 'ביטול אימון'}</button> : null}
            </div>
          </div>

          {session.cancelled ? <div className="cancelled-banner">האימון מסומן כמבוטל. נתוני הנוכחות נשמרו אך לא ניתן לערוך אותם עד להחזרת האימון.</div> : null}

          {records.length ? (
            <div className="attendance-list">
              {records.map((record) => (
                <article key={record.childId} className="attendance-row">
                  <div className="attendance-person">
                    <button className="table-name" onClick={() => setContact(record)}>{record.childName}</button>
                    <small>{record.parentName}</small>
                    <button className="icon-button" onClick={() => setContact(record)} aria-label="פרטי קשר"><Phone size={16} /></button>
                  </div>
                  <div className="attendance-statuses">
                    {statusOptions.map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={record.status === value ? `attendance-chip active attendance-${value}` : 'attendance-chip'}
                        onClick={() => updateRecord(record.childId, { status: value })}
                        disabled={session.cancelled}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="attendance-note"
                    value={record.note || ''}
                    onChange={(event) => updateRecord(record.childId, { note: event.target.value })}
                    placeholder="הערה קצרה"
                    disabled={session.cancelled}
                  />
                </article>
              ))}
            </div>
          ) : <EmptyState title="אין מתאמנים פעילים בקבוצה בחודש זה" />}

          <div className="attendance-summary">
            {statusOptions.map(([value]) => <span key={value}><StatusBadge value={value} labels={ATTENDANCE_STATUSES} /> <strong>{records.filter((record) => record.status === value).length}</strong></span>)}
          </div>
        </section>
      ) : null}

      <ContactDrawer person={contact} onClose={() => setContact(null)} />
    </div>
  );
}
