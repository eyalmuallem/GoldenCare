import { Database, FileCode2, ShieldCheck } from 'lucide-react';

export default function ConfigMissing() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand-mark">GC</div>
        <span className="eyebrow">נדרשת הגדרה חד־פעמית</span>
        <h1>חיבור GoldenCare ל־Firebase</h1>
        <p>
          המערכת תקינה, אך קובץ ההגדרות עדיין מכיל ערכי דוגמה. פתח את
          <code> public/firebase-config.js </code> והדבק בו את הגדרות אפליקציית ה־Web מ־Firebase.
        </p>
        <div className="setup-steps">
          <div><Database size={21} /><span>צור פרויקט ו־Cloud Firestore</span></div>
          <div><ShieldCheck size={21} /><span>הפעל התחברות Email/Password והדבק את כללי האבטחה</span></div>
          <div><FileCode2 size={21} /><span>החלף את הערכים בקובץ ההגדרות ורענן</span></div>
        </div>
        <p className="muted">כל ההוראות המלאות נמצאות בקובץ README-HE.md המצורף לפרויקט.</p>
      </section>
    </main>
  );
}
