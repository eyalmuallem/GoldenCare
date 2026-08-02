import { Copy, Plus, ShieldCheck, Trash2, UserCheck, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { ROLES } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { removeStaffMember, saveStaffProfile, setStaffActive, subscribeStaff } from '../services/dataService';

const emptyForm = { uid: '', displayName: '', email: '', role: 'coach' };

function StaffForm({ initialValue, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...emptyForm, ...initialValue }));
  const [saving, setSaving] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <FormField label="Firebase UID" hint="מעתיקים מתוך Authentication > Users" required className="full-width">
        <input value={form.uid} onChange={(event) => update('uid', event.target.value)} required readOnly={Boolean(initialValue)} />
      </FormField>
      <FormField label="שם להצגה" required>
        <input value={form.displayName} onChange={(event) => update('displayName', event.target.value)} required />
      </FormField>
      <FormField label="כתובת מייל" required>
        <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
      </FormField>
      <FormField label="תפקיד" required>
        <select value={form.role} onChange={(event) => update('role', event.target.value)}>
          <option value="coach">מאמן</option>
          <option value="admin">מנהל</option>
        </select>
      </FormField>
      <div className="form-actions full-width">
        <button className="button button-secondary" type="button" onClick={onCancel}>ביטול</button>
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'שומר...' : 'שמירת משתמש'}</button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [staff, setStaff] = useState([]);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeStaff(profile.orgId, setStaff, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את המשתמשים.', 'error');
    });
  }, [profile, showToast]);

  async function save(values) {
    try {
      await saveStaffProfile(profile.orgId, values);
      showToast(editing ? 'המשתמש עודכן.' : 'המשתמש שויך למועדון.');
      setEditing(null);
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('שמירת המשתמש נכשלה. ודא שה־UID נכון.', 'error');
      throw error;
    }
  }

  async function toggleActive(member) {
    if (member.uid === profile.uid) {
      showToast('לא ניתן להשבית את המשתמש המחובר.', 'error');
      return;
    }
    try {
      await setStaffActive(profile.orgId, member.uid, member.active === false);
      showToast(member.active === false ? 'המשתמש הופעל.' : 'המשתמש הושבת.');
    } catch (error) {
      console.error(error);
      showToast('עדכון המשתמש נכשל.', 'error');
    }
  }


  async function deleteMember(member) {
    if (member.uid === profile.uid) {
      showToast('לא ניתן למחוק את המשתמש המחובר.', 'error');
      return;
    }
    const confirmed = window.confirm(
      `להסיר את ${member.displayName} מהמועדון?\n\nהגישה שלו למערכת תושבת והוא יוסר מרשימת המאמנים. אם תרצה למחוק גם את חשבון ההתחברות עצמו, יש למחוק אותו ידנית ב־Firebase Authentication.`
    );
    if (!confirmed) return;
    try {
      await removeStaffMember(profile.orgId, member, profile.uid);
      showToast('המשתמש הוסר מהמועדון והגישה שלו הושבתה.');
    } catch (error) {
      console.error(error);
      if (error.code === 'coach-has-groups') {
        const names = (error.groupNames || []).join(', ');
        showToast(`לא ניתן למחוק מאמן שמשויך לקבוצות${names ? `: ${names}` : ''}. יש לשייך להן מאמן אחר תחילה.`, 'error');
        return;
      }
      showToast('מחיקת המשתמש נכשלה.', 'error');
    }
  }

  async function copyUid(uid) {
    await navigator.clipboard.writeText(uid);
    showToast('ה־UID הועתק.');
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="אבטחה והרשאות"
        title="משתמשי המערכת"
        description="מנהלים רואים את כלל הנתונים. מאמנים רואים קבוצות ונוכחות בלבד."
        actions={<button className="button button-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={18} /> שיוך משתמש</button>}
      />

      <section className="info-panel">
        <ShieldCheck size={23} />
        <div>
          <h3>איך מוסיפים מאמן?</h3>
          <p>ראשית יוצרים עבורו משתמש ב־Firebase Console תחת Authentication › Users › Add user. לאחר מכן מעתיקים את ה־UID ומבצעים כאן “שיוך משתמש”.</p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header"><div><span className="eyebrow">צוות המועדון</span><h2>משתמשים והרשאות</h2></div><span className="record-count">{staff.length} משתמשים</span></div>
        {staff.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>שם</th><th>מייל</th><th>תפקיד</th><th>סטטוס</th><th>UID</th><th>פעולות</th></tr></thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.uid} className={member.active === false ? 'row-muted' : ''}>
                    <td><strong>{member.displayName}</strong>{member.uid === profile.uid ? <small className="table-subtext">המשתמש הנוכחי</small> : null}</td>
                    <td>{member.email}</td>
                    <td><StatusBadge value={member.role} labels={ROLES} tone={member.role === 'admin' ? 'admin' : 'coach'} /></td>
                    <td>{member.active === false ? 'מושבת' : 'פעיל'}</td>
                    <td><button className="uid-button" onClick={() => copyUid(member.uid)} title={member.uid}>{member.uid.slice(0, 10)}… <Copy size={14} /></button></td>
                    <td><div className="table-actions"><button className="text-button" onClick={() => { setEditing(member); setModalOpen(true); }}>עריכה</button><button className="icon-button" onClick={() => toggleActive(member)} aria-label={member.active === false ? 'הפעלה' : 'השבתה'}>{member.active === false ? <UserCheck size={17} /> : <UserX size={17} />}</button><button className="icon-button icon-button-danger" onClick={() => deleteMember(member)} aria-label="הסרה מהמועדון" title="הסרה מהמועדון"><Trash2 size={17} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="אין משתמשים נוספים" description="הוסף מאמנים או מנהלים לאחר יצירת החשבון שלהם ב־Firebase Authentication." />}
      </section>

      {modalOpen ? <Modal title={editing ? 'עריכת משתמש' : 'שיוך משתמש למועדון'} onClose={() => { setModalOpen(false); setEditing(null); }}><StaffForm initialValue={editing} onCancel={() => { setModalOpen(false); setEditing(null); }} onSave={save} /></Modal> : null}
    </div>
  );
}
