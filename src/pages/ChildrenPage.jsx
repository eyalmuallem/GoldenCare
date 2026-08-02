import { Archive, Pencil, Phone, Plus, Search, Trash2, UserRoundCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import ContactDrawer from '../components/ContactDrawer';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createChild, deleteChildAndOperationalData, setChildActive, subscribeChildren, updateChild } from '../services/dataService';

const emptyChild = {
  childName: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
  notes: '',
  active: true,
};

function ChildForm({ child, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({ ...emptyChild, ...child }));
  const [saving, setSaving] = useState(false);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        childName: form.childName.trim(),
        parentName: form.parentName.trim(),
        parentPhone: form.parentPhone.trim(),
        parentEmail: form.parentEmail.trim(),
        notes: form.notes.trim(),
        active: form.active !== false,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <FormField label="שם המתאמן" required>
        <input value={form.childName} onChange={(event) => update('childName', event.target.value)} required />
      </FormField>
      <FormField label="שם ההורה" required>
        <input value={form.parentName} onChange={(event) => update('parentName', event.target.value)} required />
      </FormField>
      <FormField label="טלפון הורה" required>
        <input type="tel" value={form.parentPhone} onChange={(event) => update('parentPhone', event.target.value)} required />
      </FormField>
      <FormField label="מייל הורה">
        <input type="email" value={form.parentEmail} onChange={(event) => update('parentEmail', event.target.value)} />
      </FormField>
      <FormField label="הערות" className="full-width">
        <textarea rows="4" value={form.notes} onChange={(event) => update('notes', event.target.value)} />
      </FormField>
      <div className="form-actions full-width">
        <button type="button" className="button button-secondary" onClick={onCancel}>ביטול</button>
        <button type="submit" className="button button-primary" disabled={saving}>{saving ? 'שומר...' : 'שמירה'}</button>
      </div>
    </form>
  );
}

export default function ChildrenPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [children, setChildren] = useState([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contact, setContact] = useState(null);

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeChildren(profile.orgId, setChildren, (error) => {
      console.error(error);
      showToast('לא ניתן לטעון את רשימת המתאמנים.', 'error');
    });
  }, [profile, showToast]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return children.filter((child) => {
      const matchesArchive = showArchived || child.active !== false;
      const haystack = `${child.childName} ${child.parentName} ${child.parentPhone}`.toLowerCase();
      return matchesArchive && (!term || haystack.includes(term));
    });
  }, [children, search, showArchived]);

  async function save(values) {
    try {
      if (editing) await updateChild(profile.orgId, editing.id, values, profile.uid);
      else await createChild(profile.orgId, values, profile.uid);
      showToast(editing ? 'פרטי המתאמן עודכנו.' : 'המתאמן נוסף למאגר.');
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      console.error(error);
      showToast('שמירת פרטי המתאמן נכשלה.', 'error');
      throw error;
    }
  }


  async function deleteChild(child) {
    const confirmed = window.confirm(
      `למחוק לצמיתות את ${child.childName}?\n\nהפעולה תמחק את כרטיס המתאמן, כל הרישומים לקבוצות וכל החיובים שלו. היסטוריית נוכחות שכבר נשמרה תישאר לצורכי תיעוד.`
    );
    if (!confirmed) return;
    try {
      const result = await deleteChildAndOperationalData(profile.orgId, child.id);
      showToast(`המתאמן נמחק יחד עם ${result.enrollmentsDeleted} רישומים ו־${result.chargesDeleted} חיובים.`);
      if (contact?.id === child.id) setContact(null);
    } catch (error) {
      console.error(error);
      showToast('מחיקת המתאמן נכשלה.', 'error');
    }
  }

  async function toggleArchive(child) {
    try {
      await setChildActive(profile.orgId, child.id, child.active === false, profile.uid);
      showToast(child.active === false ? 'המתאמן הוחזר למאגר הפעיל.' : 'המתאמן הועבר לארכיון.');
    } catch (error) {
      console.error(error);
      showToast('הפעולה נכשלה.', 'error');
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="מאגר מרכזי"
        title="מתאמנים והורים"
        description="פרטי הקשר נשמרים בכרטיס המתאמן ויכולים לשמש ברישום למספר קבוצות."
        actions={<button className="button button-primary" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus size={18} /> מתאמן חדש</button>}
      />

      <section className="toolbar">
        <div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי מתאמן, הורה או טלפון" /></div>
        <label className="checkbox-label"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> הצג גם ארכיון</label>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div><span className="eyebrow">כרטיסי קשר</span><h2>רשימת מתאמנים</h2></div>
          <span className="record-count">{visible.length} רשומות</span>
        </div>
        {visible.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>מתאמן</th><th>הורה</th><th>טלפון</th><th>סטטוס</th><th>פעולות</th></tr></thead>
              <tbody>
                {visible.map((child) => (
                  <tr key={child.id} className={child.active === false ? 'row-muted' : ''}>
                    <td><button className="table-name" onClick={() => setContact(child)}>{child.childName}</button></td>
                    <td>{child.parentName}</td>
                    <td>{child.parentPhone}</td>
                    <td>{child.active === false ? 'בארכיון' : 'פעיל'}</td>
                    <td>
                      <div className="table-actions">
                        <button className="icon-button" onClick={() => setContact(child)} aria-label="פרטי קשר"><Phone size={17} /></button>
                        <button className="icon-button" onClick={() => { setEditing(child); setModalOpen(true); }} aria-label="עריכה"><Pencil size={17} /></button>
                        <button className="icon-button" onClick={() => toggleArchive(child)} aria-label={child.active === false ? 'החזרה לפעילות' : 'העברה לארכיון'}>
                          {child.active === false ? <UserRoundCheck size={17} /> : <Archive size={17} />}
                        </button>
                        <button className="icon-button icon-button-danger" onClick={() => deleteChild(child)} aria-label="מחיקה לצמיתות" title="מחיקה לצמיתות">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="לא נמצאו מתאמנים" description="אפשר לשנות את החיפוש או להוסיף מתאמן חדש." />}
      </section>

      {modalOpen ? (
        <Modal title={editing ? 'עריכת פרטי מתאמן' : 'מתאמן חדש'} onClose={() => { setModalOpen(false); setEditing(null); }}>
          <ChildForm child={editing} onCancel={() => { setModalOpen(false); setEditing(null); }} onSave={save} />
        </Modal>
      ) : null}
      <ContactDrawer person={contact} onClose={() => setContact(null)} />
    </div>
  );
}
