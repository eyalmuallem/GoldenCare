import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';

export default function NotFoundPage() {
  return <div className="page"><EmptyState title="העמוד לא נמצא" description="הקישור שביקשת אינו קיים במערכת." action={<Link className="button button-primary" to="/">חזרה ללוח הבקרה</Link>} /></div>;
}
