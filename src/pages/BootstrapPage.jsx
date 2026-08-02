import { Building2, UserRound } from 'lucide-react';
import { useState } from 'react';
import FormField from '../components/FormField';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function BootstrapPage() {
  const { user, bootstrapOrganization, logout } = useAuth();
  const { showToast } = useToast();
  const [organizationName, setOrganizationName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await bootstrapOrganization({ organizationName, displayName });
      showToast('המועדון הוקם בהצלחה.');
    } catch (error) {
      console.error(error);
      showToast(error.message || 'לא ניתן היה להקים את המועדון.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="setup-page">
      <section className="setup-card setup-card-wide">
        <div className="brand-mark">GC</div>
        <span className="eyebrow">הקמה ראשונית</span>
        <h1>הקמת המועדון הראשון</h1>
        <p>
          החשבון <strong>{user?.email}</strong> מחובר, אך עדיין אינו משויך למועדון. אם זה חשבון המנהל
          הראשון, מלא את הפרטים. אם זה חשבון של מאמן, יש לפנות למנהל כדי שיוסיף את ה־UID שלך.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <FormField label="שם המועדון" required>
            <div className="input-with-icon">
              <Building2 size={18} />
              <input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} required />
            </div>
          </FormField>
          <FormField label="שם המנהל" required>
            <div className="input-with-icon">
              <UserRound size={18} />
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
            </div>
          </FormField>
          <div className="form-actions full-width">
            <button className="button button-secondary" type="button" onClick={logout}>התנתקות</button>
            <button className="button button-primary" type="submit" disabled={submitting}>
              {submitting ? 'מקים מועדון...' : 'הקמת המועדון'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
