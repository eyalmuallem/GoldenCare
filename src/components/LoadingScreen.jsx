export default function LoadingScreen({ message = 'טוען את המערכת...' }) {
  return (
    <div className="screen-center">
      <div className="loader" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
