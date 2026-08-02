export default function FormField({ label, hint, required, children, className = '' }) {
  return (
    <label className={`form-field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <b aria-hidden="true">*</b> : null}
      </span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
