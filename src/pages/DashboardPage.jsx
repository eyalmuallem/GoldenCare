import { CalendarCheck2, CircleDollarSign, CreditCard, Users, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { useAuth } from '../contexts/AuthContext';
import { generateChargesForMonth, subscribeCharges, subscribeChildren, subscribeGroups } from '../services/dataService';
import { currentMonth, dayLabel, groupStatusByMonth, scheduleForDate, todayIso } from '../utils/date';
import { formatCurrency } from '../utils/format';

export default function DashboardPage() {
  const { profile, isAdmin, organization } = useAuth();
  const [groups, setGroups] = useState([]);
  const [children, setChildren] = useState([]);
  const [charges, setCharges] = useState([]);
  const month = currentMonth();
  const today = todayIso();

  useEffect(() => {
    if (!profile?.orgId) return undefined;
    return subscribeGroups(profile.orgId, profile, setGroups, console.error);
  }, [profile]);

  useEffect(() => {
    if (!profile?.orgId || !isAdmin) return undefined;
    return subscribeChildren(profile.orgId, setChildren, console.error);
  }, [profile, isAdmin]);

  useEffect(() => {
    if (!profile?.orgId || !isAdmin) return undefined;
    return subscribeCharges(profile.orgId, month, setCharges, console.error);
  }, [profile, isAdmin, month]);

  useEffect(() => {
    if (!profile?.orgId || !isAdmin) return undefined;
    generateChargesForMonth(profile.orgId, month, profile.uid).catch(console.error);
    return undefined;
  }, [profile, isAdmin, month]);

  const activeGroups = useMemo(
    () => groups.filter((group) => groupStatusByMonth(group, month) === 'active'),
    [groups, month]
  );
  const expected = charges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const received = charges.reduce((sum, item) => sum + Number(item.amountPaid || (item.status === 'paid' ? item.amount : 0)), 0);
  const unpaidCount = charges.filter((item) => item.status === 'unpaid' || item.status === 'partial').length;
  const todayGroups = groups.filter((group) => scheduleForDate(group, today) && groupStatusByMonth(group, month) === 'active');

  return (
    <div className="page">
      <PageHeader
        eyebrow={isAdmin ? 'מבט ניהולי' : 'סביבת המאמן'}
        title={`שלום, ${profile?.displayName || ''}`}
        description={isAdmin ? `תמונת מצב עדכנית של ${organization?.name || 'המועדון'}.` : 'הקבוצות והאימונים שלך להיום.'}
      />

      {isAdmin ? (
        <>
          <section className="stats-grid">
            <StatCard label="קבוצות פעילות" value={activeGroups.length} icon={UsersRound} />
            <StatCard label="מתאמנים פעילים" value={children.filter((child) => child.active !== false).length} icon={Users} />
            <StatCard label="צפי גבייה החודש" value={formatCurrency(expected)} icon={CircleDollarSign} />
            <StatCard label="נגבה החודש" value={formatCurrency(received)} helper={`${unpaidCount} חיובים דורשים טיפול`} icon={CreditCard} />
          </section>

          <section className="dashboard-grid">
            <article className="panel">
              <div className="panel-header">
                <div><span className="eyebrow">היום במועדון</span><h2>אימונים מתוכננים</h2></div>
                <Link className="text-link" to="/attendance">למסך הנוכחות</Link>
              </div>
              {todayGroups.length ? (
                <div className="compact-list">
                  {todayGroups.map((group) => {
                    const slot = scheduleForDate(group, today);
                    return (
                      <Link key={group.id} to={`/groups/${group.id}`} className="compact-row">
                        <div><strong>{group.name}</strong><small>{group.coachName || 'ללא מאמן משויך'}</small></div>
                        <span>{slot.startTime}–{slot.endTime}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : <EmptyState title="אין אימונים מתוכננים להיום" />}
            </article>

            <article className="panel">
              <div className="panel-header">
                <div><span className="eyebrow">גבייה חודשית</span><h2>מצב התשלומים</h2></div>
                <Link className="text-link" to="/payments">לכל התשלומים</Link>
              </div>
              {charges.length ? (
                <div className="progress-summary">
                  <div className="progress-ring" style={{ '--progress': expected ? Math.round((received / expected) * 100) : 0 }}>
                    <strong>{expected ? Math.round((received / expected) * 100) : 0}%</strong>
                    <small>נגבה</small>
                  </div>
                  <dl>
                    <div><dt>שולם</dt><dd>{formatCurrency(received)}</dd></div>
                    <div><dt>יתרה</dt><dd>{formatCurrency(Math.max(expected - received, 0))}</dd></div>
                    <div><dt>מספר חיובים</dt><dd>{charges.length}</dd></div>
                  </dl>
                </div>
              ) : (
                <EmptyState
                  title="אין חיובים לחודש זה"
                  description="החיובים נוצרים אוטומטית לפי הרישומים הפעילים."
                  action={<Link className="button button-primary" to="/payments">למסך התשלומים</Link>}
                />
              )}
            </article>
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="panel-header">
            <div><span className="eyebrow">{dayLabel(new Date(`${today}T12:00:00`).getDay())}</span><h2>האימונים שלי היום</h2></div>
            <Link className="button button-primary" to="/attendance"><CalendarCheck2 size={18} /> מעבר לנוכחות</Link>
          </div>
          {todayGroups.length ? (
            <div className="group-card-grid">
              {todayGroups.map((group) => {
                const slot = scheduleForDate(group, today);
                return (
                  <Link key={group.id} to={`/attendance?group=${group.id}&date=${today}`} className="group-card">
                    <span className="group-card-time">{slot.startTime}–{slot.endTime}</span>
                    <h3>{group.name}</h3>
                    <p>{group.activityType || 'פעילות ספורט'}</p>
                    <span className="text-link">פתיחת רשימת נוכחות</span>
                  </Link>
                );
              })}
            </div>
          ) : <EmptyState title="אין לך אימונים מתוכננים להיום" description="ניתן לבחור תאריך אחר במסך הנוכחות." />}
        </section>
      )}
    </div>
  );
}
