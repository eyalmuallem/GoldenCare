export default function StatCard({ label, value, helper, icon: Icon }) {
  return (
    <article className="stat-card">
      <div className="stat-icon">{Icon ? <Icon size={22} /> : null}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {helper ? <small>{helper}</small> : null}
      </div>
    </article>
  );
}
