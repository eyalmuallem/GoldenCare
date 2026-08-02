import {
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Filter,
  Phone,
  ReceiptText,
  RotateCcw,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ContactDrawer from '../components/ContactDrawer';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import { CHARGE_STATUSES, ENROLLMENT_STATUSES, PAYMENT_METHODS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  generateChargesForMonth,
  getEnrollmentMonthlyPaymentDefault,
  resetChargeToMonthlyDefault,
  setCheckDeposited,
  subscribeCharges,
  subscribeEnrollments,
  subscribeGroups,
  updateCharge,
} from '../services/dataService';
import { currentMonth, getStatusForMonth, monthLabel } from '../utils/date';
import { formatCurrency } from '../utils/format';

function isManuallyOverridden(charge) {
  if (charge.manualOverride === true) return true;
  if (charge.manualOverride === false) return false;
  return Boolean(charge.updatedBy);
}

function PaymentEditForm({ charge, enrollment, onCancel, onSave, onReset }) {
  const [status, setStatus] = useState(charge.status || 'unpaid');
  const [amountPaid, setAmountPaid] = useState(
    charge.amountPaid || (charge.status === 'paid' ? charge.amount : 0)
  );
  const [note, setNote] = useState(charge.note || '');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const paymentMethodLabel = PAYMENT_METHODS.find((item) => item.value === charge.paymentMethod)?.label || charge.paymentMethod;
  const monthlyDefault = enrollment ? getEnrollmentMonthlyPaymentDefault(enrollment) : charge.monthlyPaymentDefault || 'unpaid';
  const manualOverride = isManuallyOverridden(charge);

  function changeStatus(nextStatus) {
    setStatus(nextStatus);
    if (nextStatus === 'paid') setAmountPaid(Number(charge.amount || 0));
    if (['unpaid', 'exempt', 'no_charge'].includes(nextStatus)) setAmountPaid(0);
  }

  async function submit(event) {
    event.preventDefault();
    if (status === 'partial' && Number(amountPaid) <= 0) return;
    setSaving(true);
    try {
      await onSave({
        status,
        amountPaid: status === 'paid' ? Number(charge.amount || 0) : Number(amountPaid || 0),
        note: note.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function resetToDefault() {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <FormField label="סטטוס תשלום" required>
        <select value={status} onChange={(event) => changeStatus(event.target.value)}>
          {Object.entries(CHARGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </FormField>
      <FormField label="סכום ששולם" required={status === 'partial'}>
        <input
          type="number"
          min="0"
          max={charge.amount}
          step="1"
          value={amountPaid}
          onChange={(event) => setAmountPaid(event.target.value)}
          disabled={status !== 'partial'}
        />
      </FormField>
      <FormField label="הערה" className="full-width">
        <textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="אסמכתא, סיבת עצירת תשלום, תאריך שיק או הערה אחרת" />
      </FormField>
      <div className="payment-preview full-width">
        <span>חודש</span><strong>{monthLabel(charge.month)}</strong>
        <span>חיוב חודשי</span><strong>{formatCurrency(charge.amount)}</strong>
        <span>אופן תשלום</span><strong>{paymentMethodLabel}</strong>
        <span>ברירת מחדל חודשית</span><strong>{monthlyDefault === 'paid' ? 'שולם' : 'לא שולם'}</strong>
      </div>
      <p className="form-note full-width">
        השינוי נשמר רק עבור {monthLabel(charge.month)}. חודשים אחרים ימשיכו לפי ברירת המחדל של הרישום.
      </p>
      <div className="form-actions form-actions-split full-width">
        {manualOverride && enrollment ? (
          <button className="button button-secondary" type="button" onClick={resetToDefault} disabled={saving || resetting}>
            <RotateCcw size={17} /> {resetting ? 'מאפס...' : 'חזרה לברירת המחדל'}
          </button>
        ) : <span />}
        <div className="button-group">
          <button className="button button-secondary" type="button" onClick={onCancel}>ביטול</button>
          <button className="button button-primary" type="submit" disabled={saving || resetting}>{saving ? 'שומר...' : 'שמירת תשלום'}</button>
        </div>
      </div>
    </form>
  );
}

export default function PaymentsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [charges, setCharges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [coachFilter, setCoachFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [contact, setContact] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [depositingChargeId, setDepositingChargeId] = useState('');

  useEffect(() => {
    if (!profile?.orgId || !month) return undefined;
    return subscribeCharges(profile.orgId, month, setCharges, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את חיובי החודש.', 'error');
    });
  }, [profile, month, showToast]);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeGroups(profile.orgId, profile, setGroups, console.error);
  }, [profile]);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeEnrollments(profile.orgId, setEnrollments, console.error);
  }, [profile]);

  useEffect(() => {
    if (!profile?.orgId || !month) return undefined;
    let active = true;
    setSyncing(true);
    generateChargesForMonth(profile.orgId, month, profile.uid)
      .catch((error) => {
        console.error(error);
        if (active) showToast('הסנכרון האוטומטי של החיובים נכשל.', 'error');
      })
      .finally(() => {
        if (active) setSyncing(false);
      });
    return () => { active = false; };
  }, [profile, month, showToast]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups]);
  const enrollmentMap = useMemo(() => new Map(enrollments.map((item) => [item.id, item])), [enrollments]);

  const groupOptions = useMemo(
    () => [...groups].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'he')),
    [groups]
  );

  const coachOptions = useMemo(() => {
    const map = new Map();
    for (const group of groups) {
      if (group.coachId) map.set(group.coachId, group.coachName || 'מאמן ללא שם');
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'he'));
  }, [groups]);

  const enrichedCharges = useMemo(() => charges.map((charge) => {
    const group = groupMap.get(charge.groupId);
    const enrollment = enrollmentMap.get(charge.enrollmentId);
    return {
      ...charge,
      enrollment,
      resolvedCoachId: group?.coachId || charge.coachId || enrollment?.coachId || '',
      resolvedCoachName: group?.coachName || charge.coachName || enrollment?.coachName || 'ללא מאמן',
      resolvedActivityStatus: enrollment
        ? getStatusForMonth(enrollment.statusHistory, month)
        : charge.activityStatus || 'active',
      resolvedMonthlyDefault: enrollment
        ? getEnrollmentMonthlyPaymentDefault(enrollment)
        : charge.monthlyPaymentDefault || 'unpaid',
      manualOverride: isManuallyOverridden(charge),
    };
  }), [charges, groupMap, enrollmentMap, month]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return enrichedCharges.filter((charge) => {
      const matchesStatus = statusFilter === 'all' || charge.status === statusFilter;
      const matchesActivity = activityFilter === 'all' || charge.resolvedActivityStatus === activityFilter;
      const matchesGroup = groupFilter === 'all' || charge.groupId === groupFilter;
      const matchesCoach = coachFilter === 'all' || charge.resolvedCoachId === coachFilter;
      const haystack = `${charge.childName} ${charge.parentName} ${charge.parentPhone} ${charge.groupName} ${charge.resolvedCoachName}`.toLowerCase();
      return matchesStatus && matchesActivity && matchesGroup && matchesCoach && (!term || haystack.includes(term));
    });
  }, [enrichedCharges, search, statusFilter, activityFilter, groupFilter, coachFilter]);

  const summary = useMemo(() => {
    const expected = enrichedCharges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const received = enrichedCharges.reduce((sum, item) => sum + Number(item.amountPaid || (item.status === 'paid' ? item.amount : 0)), 0);
    const unpaid = enrichedCharges.filter((item) => item.status === 'unpaid' || item.status === 'partial').length;
    const paid = enrichedCharges.filter((item) => item.status === 'paid').length;
    const checksPending = enrichedCharges.filter((item) => (
      item.paymentMethod === 'checks'
      && Number(item.amount || 0) > 0
      && item.status === 'paid'
      && item.checkDeposited !== true
    )).length;
    return { expected, received, unpaid, paid, checksPending };
  }, [enrichedCharges]);

  async function savePayment(values) {
    try {
      await updateCharge(profile.orgId, editing.id, {
        ...values,
        ...(editing.paymentMethod === 'checks' && values.status !== 'paid' ? { checkDeposited: false } : {}),
      }, profile.uid);
      showToast('התשלום עודכן לחודש הנבחר בלבד.');
      setEditing(null);
    } catch (error) {
      console.error(error);
      showToast('עדכון התשלום נכשל.', 'error');
      throw error;
    }
  }

  async function resetPayment() {
    try {
      await resetChargeToMonthlyDefault(profile.orgId, editing, editing.enrollment, profile.uid);
      showToast('החיוב חזר לברירת המחדל החודשית.');
      setEditing(null);
    } catch (error) {
      console.error(error);
      showToast('איפוס החיוב נכשל.', 'error');
      throw error;
    }
  }

  async function toggleCheckDeposit(charge) {
    setDepositingChargeId(charge.id);
    try {
      await setCheckDeposited(profile.orgId, charge, charge.checkDeposited !== true, profile.uid);
      showToast(charge.checkDeposited === true ? 'סימון הפקדת השיק בוטל.' : 'השיק סומן כהופקד.');
    } catch (error) {
      console.error(error);
      showToast('עדכון הפקדת השיק נכשל.', 'error');
    } finally {
      setDepositingChargeId('');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="בקרה חודשית"
        title="מעקב תשלומים"
        description={`כל המתאמנים והסטטוסים עבור ${monthLabel(month)} מוצגים ברשימה אחת. הוראות קבע ושיקים פעילים מסומנים אוטומטית כמשולמים.`}
      />

      <section className="month-control panel-inline">
        <label><span>חודש להצגה</span><input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        <p>{syncing ? 'מסנכרן כעת את הרישומים והחיובים...' : 'תיקון ידני נשמר רק בחודש שנבחר. בתשלום מסוג “שונות” כל חודש מתחיל כלא שולם.'}</p>
      </section>

      <section className="stats-grid payments-stats">
        <StatCard label="צפי חיוב" value={formatCurrency(summary.expected)} icon={CircleDollarSign} />
        <StatCard label="סכום ששולם" value={formatCurrency(summary.received)} icon={CreditCard} />
        <StatCard label="חיובים ששולמו" value={summary.paid} icon={ReceiptText} />
        <StatCard label="דורשים טיפול" value={summary.unpaid} icon={TriangleAlert} />
        <StatCard label="שיקים שטרם הופקדו" value={summary.checksPending} icon={CheckCircle2} />
      </section>

      <section className="toolbar toolbar-wrap payments-toolbar">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש מתאמן, הורה, טלפון, קבוצה או מאמן" /></div>
        <label className="filter-select"><Filter size={17} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">כל סטטוסי התשלום</option>{Object.entries(CHARGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="filter-select"><select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value)}><option value="all">כל מצבי הפעילות</option>{Object.entries(ENROLLMENT_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="filter-select"><select value={coachFilter} onChange={(event) => setCoachFilter(event.target.value)}><option value="all">כל המאמנים</option>{coachOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="filter-select"><select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">כל הקבוצות</option>{groupOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      </section>

      <section className="panel">
        <div className="panel-header"><div><span className="eyebrow">{monthLabel(month)}</span><h2>רשימת תשלומים מלאה</h2></div><span className="record-count">{visible.length} מתוך {enrichedCharges.length} רשומות</span></div>
        {visible.length ? (
          <div className="table-wrap">
            <table className="payments-table">
              <thead><tr><th>מתאמן</th><th>קבוצה</th><th>מאמן</th><th>מצב פעילות</th><th>חיוב</th><th>שולם</th><th>סטטוס תשלום</th><th>אופן תשלום</th><th>שיק הופקד</th><th>פעולות</th></tr></thead>
              <tbody>
                {visible.map((charge) => (
                  <tr key={charge.id} className={charge.resolvedActivityStatus === 'ended' ? 'row-muted' : ''}>
                    <td><button className="table-name" onClick={() => setContact(charge)}>{charge.childName}</button><small className="table-subtext">{charge.parentName}</small></td>
                    <td>{charge.groupName}</td>
                    <td>{charge.resolvedCoachName}</td>
                    <td><StatusBadge value={charge.resolvedActivityStatus} labels={ENROLLMENT_STATUSES} /></td>
                    <td>{formatCurrency(charge.amount)}</td>
                    <td>{formatCurrency(charge.amountPaid || (charge.status === 'paid' ? charge.amount : 0))}</td>
                    <td>
                      <StatusBadge value={charge.status} labels={CHARGE_STATUSES} />
                      <small className="table-subtext">{charge.manualOverride ? 'עודכן ידנית לחודש זה' : charge.resolvedMonthlyDefault === 'paid' ? 'ברירת מחדל אוטומטית' : 'בקרה חודשית ידנית'}</small>
                    </td>
                    <td>{PAYMENT_METHODS.find((item) => item.value === charge.paymentMethod)?.label || charge.paymentMethod}{charge.paymentMethodNote ? <small className="table-subtext">{charge.paymentMethodNote}</small> : null}</td>
                    <td>
                      {charge.paymentMethod === 'checks' && Number(charge.amount || 0) > 0 ? (
                        <label className="deposit-checkbox" title="סימון תפעולי נפרד מסטטוס התשלום">
                          <input
                            type="checkbox"
                            checked={charge.checkDeposited === true}
                            onChange={() => toggleCheckDeposit(charge)}
                            disabled={depositingChargeId === charge.id}
                          />
                          <span>{charge.checkDeposited === true ? 'הופקד' : 'טרם הופקד'}</span>
                        </label>
                      ) : <span className="muted">—</span>}
                    </td>
                    <td><div className="table-actions"><button className="icon-button" onClick={() => setContact(charge)} aria-label="פרטי קשר"><Phone size={17} /></button><button className="text-button" onClick={() => setEditing(charge)}>עדכון תשלום</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={enrichedCharges.length ? 'אין תוצאות למסננים שנבחרו' : syncing ? 'מסנכרן את רשימת התשלומים' : 'אין רישומים לחודש זה'}
            description={enrichedCharges.length ? 'שנה את החיפוש או את המסננים.' : 'לא נמצאו מתאמנים הרשומים לפעילות בחודש שנבחר.'}
          />
        )}
      </section>

      {editing ? (
        <Modal title={`עדכון תשלום — ${editing.childName}`} onClose={() => setEditing(null)}>
          <PaymentEditForm charge={editing} enrollment={editing.enrollment} onCancel={() => setEditing(null)} onSave={savePayment} onReset={resetPayment} />
        </Modal>
      ) : null}
      <ContactDrawer person={contact} onClose={() => setContact(null)} />
    </div>
  );
}
