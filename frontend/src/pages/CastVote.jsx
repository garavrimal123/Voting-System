import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function CastVote() {
  const { electionId } = useParams();
  const [candidates, setCandidates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/elections/${electionId}/candidates`)
      .then((res) => setCandidates(res.data))
      .catch(() => setError('Could not load candidates.'));
  }, [electionId]);

  async function submitVote() {
    if (!selected) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/elections/${electionId}/vote`, { candidateId: selected });
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Vote failed.');
      setConfirming(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return <div className="card"><div className="alert alert-success">Vote cast successfully. Thank you for voting.</div></div>;
  }

  const selectedCandidate = candidates.find((c) => c._id === selected);

  if (confirming && selectedCandidate) {
    return (
      <div className="card fade-in-up">
        <h2>Confirm Your Vote</h2>
        <p className="muted">This is final. Once submitted, it cannot be changed, and your choice cannot be traced back to you.</p>
        <div className="candidate-card selected" style={{ cursor: 'default', marginTop: '1rem' }}>
          {selectedCandidate.photoUrl && <img src={selectedCandidate.photoUrl} alt={selectedCandidate.name} className="candidate-photo" />}
          <div style={{ flex: 1 }}>
            <strong>{selectedCandidate.name}</strong>
            <div className="muted">{selectedCandidate.party}</div>
          </div>
          {selectedCandidate.symbolUrl && <img src={selectedCandidate.symbolUrl} alt={`${selectedCandidate.party} symbol`} className="candidate-symbol" />}
        </div>
        {error && <div className="alert alert-error shake">{error}</div>}
        <div className="election-actions" style={{ marginTop: '1rem' }}>
          <button onClick={submitVote} disabled={submitting}>
            {submitting ? <span className="spinner" /> : 'Yes, Cast My Vote'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={submitting}>
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Cast Your Vote</h2>
      <p className="muted">Select one candidate. This cannot be changed once submitted, and your choice cannot be traced back to you.</p>

      <div className="candidate-list">
        {candidates.map((c) => (
          <label key={c._id} className={`candidate-card ${selected === c._id ? 'selected' : ''}`}>
            <input
              type="radio"
              name="candidate"
              value={c._id}
              checked={selected === c._id}
              onChange={() => setSelected(c._id)}
            />
            {c.photoUrl && <img src={c.photoUrl} alt={c.name} className="candidate-photo" />}
            <div style={{ flex: 1 }}>
              <strong>{c.name}</strong>
              <div className="muted">{c.party}</div>
            </div>
            {c.symbolUrl && <img src={c.symbolUrl} alt={`${c.party} symbol`} className="candidate-symbol" />}
          </label>
        ))}
      </div>

      {error && <div className="alert alert-error shake">{error}</div>}
      <button className="btn" disabled={!selected} onClick={() => setConfirming(true)}>Review & Submit Vote</button>
    </div>
  );
}
