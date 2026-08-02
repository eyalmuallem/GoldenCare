import { Mail, Phone, X } from 'lucide-react';
import { normalizePhone } from '../utils/format';

export default function ContactDrawer({ person, onClose }) {
  if (!person) return null;
  const phone = normalizePhone(person.parentPhone);
  return (
    <div className="drawer-backdrop" onMouseDown={onClose} role="presentation">
      <aside className="contact-drawer" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="eyebrow">פרטי קשר</span>
            <h2>{person.childName}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="סגירה">
            <X size={20} />
          </button>
        </header>
        <dl>
          <div>
            <dt>שם הורה</dt>
            <dd>{person.parentName || 'לא הוזן'}</dd>
          </div>
          <div>
            <dt>טלפון</dt>
            <dd>{person.parentPhone || 'לא הוזן'}</dd>
          </div>
          {person.parentEmail ? (
            <div>
              <dt>דוא״ל</dt>
              <dd>{person.parentEmail}</dd>
            </div>
          ) : null}
          {person.groupName ? (
            <div>
              <dt>קבוצה</dt>
              <dd>{person.groupName}</dd>
            </div>
          ) : null}
        </dl>
        <div className="drawer-actions">
          {phone ? (
            <a className="button button-primary" href={`tel:${phone}`}>
              <Phone size={18} /> חיוג להורה
            </a>
          ) : null}
          {person.parentEmail ? (
            <a className="button button-secondary" href={`mailto:${person.parentEmail}`}>
              <Mail size={18} /> שליחת מייל
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
