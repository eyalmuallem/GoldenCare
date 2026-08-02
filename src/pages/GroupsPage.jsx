import { CalendarDays, Clock3, Pencil, Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { DAYS, GROUP_STATUSES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createGroup, subscribeGroups, subscribeStaff, updateGroup } from '../services/dataService';
import { dayLabel, groupStatusByMonth } from '../utils/date';
import { formatCurrency } from '../utils/format';

const emptyForm = {
  name: '',
  activityType: 'טניס',
  coachId: '',
  coachName: '',
  monthlyPrice: '',
  startMonth: '',
  endMonth: '',
  status: 'active',
  notes: '',
  schedule: [],
};

function GroupForm({ initialValue, coaches, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...emptyForm, ...initialValue, schedule: initialValue?.schedule || [] }));
  const [saving, setSaving] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleDay(day) {
    setForm((current) => {
      const exists = current.schedule.some((slot) => Number(slot.dayOfWeek) === day);
      const schedule = exists
        ? current.schedule.filter((slot) => Number(slot.dayOfWeek) !== day)
        : [...current.schedule, { dayOfWeek: day, startTime: '16:00', endTime: '17:00' }];
      return { ...current, schedule: schedule.sort((a, b) => a.dayOfWeek - b.dayOfWeek) };
    });
  }

  function updateSlot(day, field, value) {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((slot) =>
        Number(slot.dayOfWeek) === day ? { ...slot, [field]: value } : slot
      ),
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.schedule.length) return;
    if (form.schedule.some((slot) => slot.endTime <= slot.startTime)) return;
    setSaving(true);
    try {
      const coach = coaches.find((item) => item.uid === form.coachId);
      await onSave({
        ...form,
        coachName: coach?.displayName || '',
        monthlyPrice: Number(form.monthlyPrice || 0),
      });
    } finally {
      setSaving(false);
    }
  }

  const invalidTime = form.schedule.some((slot) => slot.endTime <= slot.startTime);

  return (
    <form className="form-grid" onSubmit={submit}>
      <FormField label="שם הקבוצה" required>
        <input value={form.name} onChange={(event) => update('name', event.target.value)} required />
      </FormField>
      <FormField label="סוג פעילות" required>
        <input value={form.activityType} onChange={(event) => update('activityType', event.target.value)} required />
      </FormField>
      <FormField label="מאמן">
        <select value={form.coachId} onChange={(event) => update('coachId', event.target.value)}>
          <option value="">ללא מאמן משויך</option>
          {coaches.map((coach) => <option key={coach.uid} value={coach.uid}>{coach.displayName}</option>)}
        </select>
      </FormField>
      <FormField label="מחיר חודשי למתאמן" required>
        <input type="number" min="0" step="1" value={form.monthlyPrice} onChange={(event) => update('monthlyPrice', event.target.value)} required />
      </FormField>
      <FormField label="חודש התחלה" required>
        <input type="month" value={form.startMonth} onChange={(event) => update('startMonth', event.target.value)} required />
      </FormField>
      <FormField label="חודש סיום" required>
        <input type="month" min={form.startMonth} value={form.endMonth} onChange={(event) => update('endMonth', event.target.value)} required />
      </FormField>
      <FormField label="סטטוס ניהולי">
        <select value={form.status} onChange={(event) => update('status', event.target.value)}>
          <option value="active">פעילה</option>
          <option value="paused">מוקפאת</option>
        </select>
      </FormField>
      <FormField label="הערות">
        <input value={form.notes} onChange={(event) => update('notes', event.target.value)} />
      </FormField>

      <div className="full-width schedule-builder">
        <div className="field-label">ימי ושעות פעילות *</div>
        <div className="day-picker">
          {DAYS.map((day) => {
            const selected = form.schedule.some((slot) => Number(slot.dayOfWeek) === day.value);
            return (
              <button key={day.value} type="button" className={selected ? 'day-chip selected' : 'day-chip'} onClick={() => toggleDay(day.value)}>
                {day.label}
              </button>
            );
          })}
        </div>
        <div className="schedule-slots">
          {form.schedule.map((slot) => (
            <div className="schedule-slot" key={slot.dayOfWeek}>
              <strong>{dayLabel(slot.dayOfWeek)}</strong>
              <label>מ־<input type="time" value={slot.startTime} onChange={(event) => updateSlot(slot.dayOfWeek, 'startTime', event.target.value)} /></label>
              <label>עד <input type="time" value={slot.endTime} onChange={(event) => updateSlot(slot.dayOfWeek, 'endTime', event.target.value)} /></label>
            </div>
          ))}
        </div>
        {!form.schedule.length ? <small className="error-text">יש לבחור לפחות יום פעילות אחד.</small> : null}
        {invalidTime ? <small className="error-text">שעת הסיום חייבת להיות מאוחרת משעת ההתחלה.</small> : null}
      </div>

      <div className="form-actions full-width">
        <button className="button button-secondary" type="button" onClick={onCancel}>ביטול</button>
        <button className="button button-primary" type="submit" disabled={saving || !form.schedule.length || invalidTime}>
          {saving ? 'שומר...' : 'שמירת קבוצה'}
        </button>
      </div>
    </form>
  );
}

export default function GroupsPage() {
  const { profile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [staff, setStaff] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeGroups(profile.orgId, profile, setGroups, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את הקבוצות.', 'error');
    });
  }, [profile, showToast]);

  useEffect(() => {
    if (!profile?.orgId || !isAdmin) return undefined;
    return subscribeStaff(profile.orgId, setStaff, console.error);
  }, [profile, isAdmin]);

  const coaches = useMemo(() => staff.filter((item) => item.role === 'coach' && item.active !== false), [staff]);

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(group) {
    setEditing(group);
    setModalOpen(true);
  }

  async function save(values) {
    try {
      if (editing) await updateGroup(profile.orgId, editing.id, values, profile.uid);
      else await createGroup(profile.orgId, values, profile.uid);
      showToast(editing ? 'הקבוצה עודכנה.' : 'הקבוצה נוצרה.');
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('שמירת הקבוצה נכשלה.', 'error');
      throw error;
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={isAdmin ? 'ניהול פעילות' : 'הפעילות שלי'}
        title={isAdmin ? 'קבוצות' : 'הקבוצות שלי'}
        description={isAdmin ? 'הקמה, תמחור, שיבוץ מאמן וניהול תקופת הפעילות.' : 'הקבוצות שמשויכות לחשבון המאמן שלך.'}
        actions={isAdmin ? <button className="button button-primary" onClick={openNew}><Plus size={18} /> קבוצה חדשה</button> : null}
      />

      {groups.length ? (
        <section className="group-card-grid">
          {groups.map((group) => {
            const resolvedStatus = groupStatusByMonth(group);
            return (
              <article key={group.id} className="group-card group-card-static">
                <div className="card-topline">
                  <StatusBadge value={resolvedStatus} labels={GROUP_STATUSES} />
                  {isAdmin ? <button className="icon-button" onClick={() => openEdit(group)} aria-label="עריכת קבוצה"><Pencil size={17} /></button> : null}
                </div>
                <Link to={`/groups/${group.id}`} className="card-main-link">
                  <span className="eyebrow">{group.activityType}</span>
                  <h3>{group.name}</h3>
                  <div className="group-meta">
                    <span><UserRound size={16} /> {group.coachName || 'ללא מאמן'}</span>
                    <span><CalendarDays size={16} /> {(group.schedule || []).map((slot) => dayLabel(slot.dayOfWeek)).join(', ')}</span>
                    <span><Clock3 size={16} /> {(group.schedule || []).map((slot) => `${slot.startTime}–${slot.endTime}`).join(' | ')}</span>
                  </div>
                  {isAdmin ? <strong className="group-price">{formatCurrency(group.monthlyPrice)} לחודש</strong> : null}
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          title={isAdmin ? 'עדיין לא הוקמו קבוצות' : 'לא משויכות אליך קבוצות'}
          description={isAdmin ? 'צור את הקבוצה הראשונה והגדר ימים, שעות, מאמן ומחיר.' : 'מנהל המערכת צריך לשייך את המשתמש שלך לקבוצה.'}
          action={isAdmin ? <button className="button button-primary" onClick={openNew}><Plus size={18} /> קבוצה חדשה</button> : null}
        />
      )}

      {modalOpen ? (
        <Modal title={editing ? 'עריכת קבוצה' : 'קבוצה חדשה'} onClose={() => setModalOpen(false)} wide>
          <GroupForm initialValue={editing || emptyForm} coaches={coaches} onCancel={() => setModalOpen(false)} onSave={save} />
        </Modal>
      ) : null}
    </div>
  );
}
