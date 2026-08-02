import { KeyRound, Mail } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import FormField from '../components/FormField';

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (error) {
      console.error(error);
      showToast('ההתחברות נכשלה. בדוק את כתובת המייל והסיסמה.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      showToast('יש להזין כתובת מייל לפני שחזור סיסמה.', 'error');
      return;
    }
    try {
      await resetPassword(email);
      showToast('נשלח מייל לאיפוס הסיסמה.');
    } catch (error) {
      console.error(error);
      showToast('לא ניתן לשלוח כעת מייל לאיפוס סיסמה.', 'error');
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-copy">
          <div className="brand-mark brand-large">GC</div>
          <span className="eyebrow">ניהול מועדון במקום אחד</span>
          <h1>GoldenCare</h1>
          <p>קבוצות, מתאמנים, נוכחות, חיובים ומעקב גבייה במערכת ארגונית אחת.</p>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={handleSubmit}>
          <div>
            <span className="eyebrow">כניסה מאובטחת</span>
            <h2>ברוך הבא</h2>
            <p>התחבר באמצעות החשבון שנוצר עבורך ב־Firebase.</p>
          </div>

          <FormField label="כתובת מייל" required>
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </FormField>

          <FormField label="סיסמה" required>
            <div className="input-with-icon">
              <KeyRound size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </FormField>

          <button className="button button-primary button-block" type="submit" disabled={submitting}>
            {submitting ? 'מתחבר...' : 'כניסה למערכת'}
          </button>
          <button className="link-button" type="button" onClick={handleReset}>
            שכחתי סיסמה
          </button>
        </form>
      </section>
    </main>
  );
}
