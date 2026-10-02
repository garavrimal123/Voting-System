import { useLocation, Navigate, Link } from 'react-router-dom';

export default function RegistrationSuccess() {
  const { state } = useLocation();

  if (!state) return <Navigate to="/register" replace />;

  const { fullName, voterRecordId, applicationId } = state;

  return (
    <div className="success-page fade-in-up">
      <div className="success-check">
        <svg viewBox="0 0 80 80" width="90" height="90">
          <circle cx="40" cy="40" r="38" fill="none" stroke="#1a7431" strokeWidth="4" className="success-circle" />
          <path d="M22 42 L35 55 L60 26" fill="none" stroke="#1a7431" strokeWidth="5"
            strokeLinecap="round" strokeLinejoin="round" className="success-tick" />
        </svg>
      </div>

      <h1>Registration Submitted!</h1>
      <p className="muted">
        Thank you, <strong>{fullName}</strong>. Your application has been received and is awaiting verification.
      </p>

      <div className="card application-id-card">
        <p className="muted" style={{ marginBottom: '0.3rem' }}>Your Application ID</p>
        <div className="application-id">{applicationId}</div>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Save this ID — use it to track your application status any time.
        </p>
      </div>

      <div className="success-actions">
        <a href={`/api/voters/${voterRecordId}/confirmation.pdf`} target="_blank" rel="noreferrer" className="btn">
          ⬇ Download Confirmation PDF
        </a>
        <Link to="/track" className="btn btn-secondary">Track Application Status</Link>
      </div>

      <Link to="/" className="muted" style={{ display: 'inline-block', marginTop: '1.5rem' }}>← Back to Home</Link>
    </div>
  );
}
