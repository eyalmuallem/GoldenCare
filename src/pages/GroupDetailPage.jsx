import { ArrowRight, CalendarDays, CreditCard, Pencil, Phone, Plus, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ContactDrawer from '../components/ContactDrawer';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { CHARGE_STATUSES, ENROLLMENT_STATUSES, PAYMENT_METHODS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  changeEnrollmentStatus,
  createChild,
  createEnrollment,
  getEnrollmentMonthlyPaymentDefault,
  subscribeChildren,
  subscribeEnrollments,
  subscribeGroup,
  updateEnrollment,
} from '../services/dataService';
import { currentMonth, dayLabel } from '../utils/date';
import { calculatePrice, formatCurrency } from '../utils/format';

const isRecurringMethod = (method) => method === 'direct_debit' || method === 'checks';

function RegistrationForm({ group, children, enrollment, onCancel, onSave }) {
  const editing = Boolean(enrollment);
  const initialPaymentMethod = enrollment?.paymentMethod || 'direct_debit';
  const inferredMonthlyDefault = enrollment
    ? getEnrollmentMonthlyPaymentDefault(enrollment)
    : 'paid';
  const [mode, setMode] = useState(editing ? 'existing' : 'new');
  const [form, setForm] = useState(() => ({
    childId: enrollment?.childId || '',
    childName: enrollment?.childName || '',
    parentName: enrollment?.parentName || '',
    parentPhone: enrollment?.parentPhone || '',
    parentEmail: enrollment?.parentEmail || '',
    childNotes: '',
    basePrice: enrollment?.basePrice ?? group.monthlyPrice ?? 0,
    discountPercent: enrollment?.discountPercent ?? 0,
    paymentMethod: initialPaymentMethod,
    paymentMethodNote: enrollment?.paymentMethodNote || '',
    monthlyPaymentDefault: inferredMonthlyDefault,
    startMonth: enrollment?.startMonth || (currentMonth() < group.startMonth ? group.startMonth : currentMonth()),
    endMonth: enrollment?.endMonth || group.endMonth,
    initialPaymentStatus: isRecurringMethod(initialPaymentMethod) ? 'paid' : 'unpaid',
    initialAmountPaid: 0,
  }));
  const [saving, setSaving] = useState(false);
  const finalPrice = calculatePrice(form.basePrice, form.discountPercent);
  const recurringMethod = isRecurringMethod(form.paymentMethod);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updatePaymentMethod(paymentMethod) {
    setForm((current) => {
      const recurring = isRecurringMethod(paymentMethod);
      return {
        ...current,
        paymentMethod,
        monthlyPaymentDefault: recurring ? (isRecurringMethod(current.paymentMethod) ? current.monthlyPaymentDefault : 'paid') : 'unpaid',
        ...(!editing ? { initialPaymentStatus: recurring ? 'paid' : 'unpaid', initialAmountPaid: 0 } : {}),
      };
    });
  }

  function updateInitialPaymentStatus(initialPaymentStatus) {
    setForm((current) => ({
      ...current,
      initialPaymentStatus,
      initialAmountPaid: initialPaymentStatus === 'partial' ? current.initialAmountPaid : 0,
      monthlyPaymentDefault: isRecurringMethod(current.paymentMethod)
        ? (initialPaymentStatus === 'paid' ? 'paid' : 'unpaid')
        : 'unpaid',
    }));
  }

  function selectChild(childId) {
    const child = children.find((item) => item.id === childId);
    setForm((current) => ({
      ...current,
      childId,
      childName: child?.childName || '',
      parentName: child?.parentName || '',
      parentPhone: child?.parentPhone || '',
      parentEmail: child?.parentEmail || '',
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (mode === 'existing' && !form.childId) return;
    if (form.paymentMethod === 'other' && !form.paymentMethodNote.trim()) return;
    if (!editing && form.initialPaymentStatus === 'partial' && Number(form.initialAmountPaid || 0) <= 0) return;
    setSaving(true);
    try {
      await onSave({ ...form, finalPrice, mode });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {!editing ? (
        <div className="full-width segmented-control">
          <button type="button" className={mode === 'new' ? 'active' : ''} onClick={() => setMode('new')}>מתאמן חדש</button>
          <button type="button" className={mode === 'existing' ? 'active' : ''} onClick={() => setMode('existing')}>מתאמן קיים</button>
        </div>
      ) : null}

      {mode === 'existing' && !editing ? (
        <FormField label="בחירת מתאמן" required className="full-width">
          <select value={form.childId} onChange={(event) => selectChild(event.target.value)} required>
            <option value="">בחר מתאמן</option>
            {children.filter((item) => item.active !== false).map((child) => (
              <option key={child.id} value={child.id}>{child.childName} — {child.parentName}</option>
            ))}
          </select>
        </FormField>
      ) : null}

      <FormField label="שם המתאמן" required>
        <input value={form.childName} onChange={(event) => update('childName', event.target.value)} required readOnly={mode === 'existing'} />
      </FormField>
      <FormField label="שם ההורה" required>
        <input value={form.parentName} onChange={(event) => update('parentName', event.target.value)} required readOnly={mode === 'existing'} />
      </FormField>
      <FormField label="טלפון הורה" required>
        <input type="tel" value={form.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} required readOnly={mode === 'existing'} />
      </FormField>
      <FormField label="מייל הורה">
        <input type="email" value={form.parentEmail} onChange={(event) => update('parentEmail', event.target.value)} readOnly={mode === 'existing'} />
      </FormField>

      <FormField label="מחיר בסיס חודשי" hint={`מחיר הקבוצה: ${formatCurrency(group.monthlyPrice)}`} required>
        <input type="number" min="0" step="1" value={form.basePrice} onChange={(event) => update('basePrice', event.target.value)} required />
      </FormField>
      <FormField label="הנחה באחוזים">
        <input type="number" min="0" max="100" step="1" value={form.discountPercent} onChange={(event) => update('discountPercent', event.target.value)} />
      </FormField>
      <div className="price-preview full-width">
        <span>מחיר סופי לחודש</span>
        <strong>{formatCurrency(finalPrice)}</strong>
      </div>

      <FormField label="אופן תשלום" required>
        <select value={form.paymentMethod} onChange={(event) => updatePaymentMethod(event.target.value)} required>
          {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
        </select>
      </FormField>
      <FormField label="פירוט אופן התשלום" required={form.paymentMethod === 'other'}>
        <input
          value={form.paymentMethodNote}
          onChange={(event) => update('paymentMethodNote', event.target.value)}
          placeholder={form.paymentMethod === 'other' ? 'למשל: העברה בנקאית או מזומן' : 'אופציונלי'}
          required={form.paymentMethod === 'other'}
        />
      </FormField>

      {recurringMethod ? (
        <div className="payment-behavior full-width">
          <label className="checkbox-label checkbox-label-strong">
            <input
              type="checkbox"
              checked={form.monthlyPaymentDefault === 'paid'}
              onChange={(event) => update('monthlyPaymentDefault', event.target.checked ? 'paid' : 'unpaid')}
            />
            הסדר התשלום פעיל וברירת המחדל בכל חודש היא “שולם”
          </label>
          <p>
            {form.paymentMethod === 'direct_debit'
              ? 'כל חודש חדש יסומן כמשולם. עצירת תשלום בחודש מסוים תיעשה ידנית במסך התשלומים ולא תשפיע על חודשים אחרים.'
              : 'כל חודש חדש יסומן כמשולם, ובמסך התשלומים תופיע בקרה נפרדת לסימון שהשיק אכן הופקד.'}
          </p>
        </div>
      ) : (
        <p className="form-note full-width">בתשלום מסוג “שונות” כל חודש חדש ייפתח כברירת מחדל כ״לא שולם״, עד לסימון ידני במסך התשלומים.</p>
      )}

      <FormField label="חודש תחילת חיוב" required>
        <input type="month" min={group.startMonth} max={group.endMonth} value={form.startMonth} onChange={(event) => update('startMonth', event.target.value)} required />
      </FormField>
      <FormField label="חודש סיום חיוב" required>
        <input type="month" min={form.startMonth} max={group.endMonth} value={form.endMonth} onChange={(event) => update('endMonth', event.target.value)} required />
      </FormField>

      {!editing ? (
        <>
          <FormField label="סטטוס תשלום לחודש הראשון" hint={`החיוב ייווצר מיד עבור ${form.startMonth || 'חודש ההתחלה'}`} required>
            <select value={form.initialPaymentStatus} onChange={(event) => updateInitialPaymentStatus(event.target.value)}>
              {Object.entries(CHARGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </FormField>
          <FormField label="סכום ששולם בפועל" required={form.initialPaymentStatus === 'partial'}>
            <input
              type="number"
              min="0"
              max={finalPrice}
              step="1"
              value={form.initialPaymentStatus === 'paid' ? finalPrice : form.initialAmountPaid}
              onChange={(event) => update('initialAmountPaid', event.target.value)}
              disabled={form.initialPaymentStatus !== 'partial'}
              required={form.initialPaymentStatus === 'partial'}
            />
          </FormField>
          <p className="form-note full-width">המתאמן יופיע מיד במסך התשלומים של חודש ההתחלה. בהוראת קבע או בשיקים, בחירה ב״שולם״ מפעילה גם את ברירת המחדל החודשית.</p>
        </>
      ) : (
        <p className="form-note full-width">השינוי בברירת המחדל יחול על חיובים חדשים ועל חיובים אוטומטיים שלא נערכו ידנית. תיקון ידני שביצעת בחודש מסוים יישמר.</p>
      )}

      <div className="form-actions full-width">
        <button className="button button-secondary" type="button" onClick={onCancel}>ביטול</button>
        <button className="button button-primary" type="submit" disabled={saving || (mode === 'existing' && !form.childId)}>
          {saving ? 'שומר...' : editing ? 'שמירת שינויים' : 'הוספה לקבוצה'}
        </button>
      </div>
    </form>
  );
}

function StatusForm({ enrollment, onCancel, onSave }) {
  const [status, setStatus] = useState(enrollment.currentStatus || 'active');
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({ status, fromMonth, reason });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <FormField label="סטטוס חדש" required>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          {Object.entries(ENROLLMENT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </FormField>
      <FormField label="החל מחודש" required>
        <input type="month" min={enrollment.startMonth} value={fromMonth} onChange={(event) => setFromMonth(event.target.value)} required />
      </FormField>
      <FormField label="סיבה או הערה" className="full-width">
        <textarea rows="3" value={reason} onChange={(event) => setReason(event.target.value)} />
      </FormField>
      <p className="form-note full-width">בעת פתיחת חודש במסך התשלומים, חיובים אוטומטיים שלא שונו ידנית יתעדכנו לפי סטטוס הפעילות החדש. עדכונים ידניים יישמרו.</p>
      <div className="form-actions full-width">
        <button className="button button-secondary" type="button" onClick={onCancel}>ביטול</button>
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'שומר...' : 'עדכון סטטוס'}</button>
      </div>
    </form>
  );
}

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const { profile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [group, setGroup] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [children, setChildren] = useState([]);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState(null);
  const [statusEnrollment, setStatusEnrollment] = useState(null);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeGroup(profile.orgId, groupId, setGroup, console.error);
  }, [profile, groupId]);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeEnrollments(profile.orgId, setEnrollments, console.error, groupId);
  }, [profile, groupId]);

  useEffect(() => {
    if (!profile?.orgId || !isAdmin) return undefined;
    return subscribeChildren(profile.orgId, setChildren, console.error);
  }, [profile, isAdmin]);

  const activeCount = useMemo(() => enrollments.filter((item) => item.currentStatus === 'active').length, [enrollments]);

  async function saveRegistration(values) {
    try {
      if (editingEnrollment) {
        await updateEnrollment(profile.orgId, editingEnrollment.id, {
          basePrice: Number(values.basePrice || 0),
          discountPercent: Number(values.discountPercent || 0),
          finalPrice: Number(values.finalPrice || 0),
          paymentMethod: values.paymentMethod,
          paymentMethodNote: values.paymentMethodNote.trim(),
          monthlyPaymentDefault: values.paymentMethod === 'other' ? 'unpaid' : values.monthlyPaymentDefault,
          startMonth: values.startMonth,
          endMonth: values.endMonth,
        }, profile.uid);
        showToast('תנאי הרישום וברירת המחדל החודשית עודכנו.');
      } else {
        let childId = values.childId;
        if (values.mode === 'new') {
          childId = await createChild(profile.orgId, {
            childName: values.childName.trim(),
            parentName: values.parentName.trim(),
            parentPhone: values.parentPhone.trim(),
            parentEmail: values.parentEmail.trim(),
            notes: values.childNotes?.trim() || '',
          }, profile.uid);
        }
        await createEnrollment(profile.orgId, {
          childId,
          childName: values.childName.trim(),
          parentName: values.parentName.trim(),
          parentPhone: values.parentPhone.trim(),
          parentEmail: values.parentEmail.trim(),
          groupId: group.id,
          groupName: group.name,
          coachId: group.coachId || '',
          coachName: group.coachName || '',
          basePrice: Number(values.basePrice || 0),
          discountPercent: Number(values.discountPercent || 0),
          finalPrice: Number(values.finalPrice || 0),
          paymentMethod: values.paymentMethod,
          paymentMethodNote: values.paymentMethodNote.trim(),
          monthlyPaymentDefault: values.paymentMethod === 'other' ? 'unpaid' : values.monthlyPaymentDefault,
          startMonth: values.startMonth,
          endMonth: values.endMonth,
          initialStatus: 'active',
          initialPaymentStatus: values.initialPaymentStatus || 'unpaid',
          initialAmountPaid: Number(values.initialAmountPaid || 0),
        }, profile.uid);
        showToast('המתאמן נוסף לקבוצה ולמערך התשלומים.');
      }
      setRegistrationOpen(false);
      setEditingEnrollment(null);
    } catch (error) {
      console.error(error);
      showToast('שמירת הרישום נכשלה.', 'error');
      throw error;
    }
  }

  async function saveStatus(values) {
    try {
      await changeEnrollmentStatus(profile.orgId, statusEnrollment, values, profile.uid);
      showToast('סטטוס הרישום עודכן.');
      setStatusEnrollment(null);
    } catch (error) {
      console.error(error);
      showToast('עדכון הסטטוס נכשל.', 'error');
      throw error;
    }
  }

  if (!group) {
    return <div className="page"><EmptyState title="הקבוצה אינה זמינה" description="ייתכן שהקבוצה נמחקה או שאינך מורשה לצפות בה." action={<Link className="button button-secondary" to="/groups">חזרה לקבוצות</Link>} /></div>;
  }

  return (
    <div className="page">
      <Link className="back-link" to="/groups"><ArrowRight size={17} /> חזרה לקבוצות</Link>
      <PageHeader
        eyebrow={group.activityType || 'קבוצה'}
        title={group.name}
        description={`${group.startMonth} עד ${group.endMonth}`}
        actions={isAdmin ? <button className="button button-primary" onClick={() => { setEditingEnrollment(null); setRegistrationOpen(true); }}><Plus size={18} /> הוספת מתאמן</button> : null}
      />

      <section className="stats-grid stats-grid-small">
        <article className="mini-stat"><UserRound size={19} /><div><span>מאמן</span><strong>{group.coachName || 'לא משויך'}</strong></div></article>
        <article className="mini-stat"><CalendarDays size={19} /><div><span>ימי פעילות</span><strong>{(group.schedule || []).map((slot) => dayLabel(slot.dayOfWeek)).join(', ')}</strong></div></article>
        <article className="mini-stat"><UserRound size={19} /><div><span>מתאמנים פעילים</span><strong>{activeCount}</strong></div></article>
        {isAdmin ? <article className="mini-stat"><CreditCard size={19} /><div><span>מחיר קבוצה</span><strong>{formatCurrency(group.monthlyPrice)}</strong></div></article> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><span className="eyebrow">רשימת הקבוצה</span><h2>מתאמנים רשומים</h2></div>
          <span className="record-count">{enrollments.length} רישומים</span>
        </div>
        {enrollments.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>מתאמן</th>
                  <th>הורה</th>
                  <th>סטטוס</th>
                  {isAdmin ? <th>מחיר חודשי</th> : null}
                  {isAdmin ? <th>תשלום</th> : null}
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const paymentMethodLabel = PAYMENT_METHODS.find((item) => item.value === enrollment.paymentMethod)?.label || enrollment.paymentMethod;
                  const defaultPaid = getEnrollmentMonthlyPaymentDefault(enrollment) === 'paid';
                  return (
                    <tr key={enrollment.id}>
                      <td><button className="table-name" onClick={() => setContact(enrollment)}>{enrollment.childName}</button></td>
                      <td>{enrollment.parentName}</td>
                      <td><StatusBadge value={enrollment.currentStatus} labels={ENROLLMENT_STATUSES} /></td>
                      {isAdmin ? <td>{formatCurrency(enrollment.finalPrice)}</td> : null}
                      {isAdmin ? (
                        <td>
                          {paymentMethodLabel}
                          <small className="table-subtext">
                            {enrollment.paymentMethod === 'other'
                              ? 'בקרה ידנית בכל חודש'
                              : defaultPaid
                                ? enrollment.paymentMethod === 'checks' ? 'משולם אוטומטית + בקרת הפקדה' : 'משולם אוטומטית בכל חודש'
                                : 'נדרש עדכון ידני בכל חודש'}
                          </small>
                        </td>
                      ) : null}
                      <td>
                        <div className="table-actions">
                          <button className="icon-button" onClick={() => setContact(enrollment)} aria-label="פרטי קשר"><Phone size={17} /></button>
                          {isAdmin ? <button className="icon-button" onClick={() => { setEditingEnrollment(enrollment); setRegistrationOpen(true); }} aria-label="עריכת תנאים"><Pencil size={17} /></button> : null}
                          {isAdmin ? <button className="text-button" onClick={() => setStatusEnrollment(enrollment)}>שינוי סטטוס</button> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="אין מתאמנים בקבוצה" description={isAdmin ? 'הוסף את המתאמן הראשון לקבוצה.' : 'מנהל המערכת עדיין לא הוסיף מתאמנים לקבוצה.'} />
        )}
      </section>

      {registrationOpen ? (
        <Modal title={editingEnrollment ? 'עריכת תנאי רישום' : 'הוספת מתאמן לקבוצה'} onClose={() => { setRegistrationOpen(false); setEditingEnrollment(null); }} wide>
          <RegistrationForm
            group={group}
            children={children}
            enrollment={editingEnrollment}
            onCancel={() => { setRegistrationOpen(false); setEditingEnrollment(null); }}
            onSave={saveRegistration}
          />
        </Modal>
      ) : null}

      {statusEnrollment ? (
        <Modal title={`שינוי סטטוס — ${statusEnrollment.childName}`} onClose={() => setStatusEnrollment(null)}>
          <StatusForm enrollment={statusEnrollment} onCancel={() => setStatusEnrollment(null)} onSave={saveStatus} />
        </Modal>
      ) : null}

      <ContactDrawer person={contact} onClose={() => setContact(null)} />
    </div>
  );
}
