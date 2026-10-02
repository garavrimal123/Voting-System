import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';

// Deliberately a plain axios call, not the shared `api` instance — this page
// has no login, so it must never send whatever stale token happens to sit
// in sessionStorage from a different role.
const baseURL = import.meta.env.VITE_API_URL || '/api';
const publicApi = axios.create({ baseURL });

export default function PublicResults() {
  const { electionId } = useParams();
  const [elections, setElections] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (electionId) {
      setDetail(null);
      setError(null);
      publicApi.get(`/public/elections/${electionId}/results`)
        .then((res) => setDetail(res.data))
        .catch((err) => setError(err.response?.data?.message || 'Results not available.'));
    } else {
      publicApi.get('/public/elections').then((res) => setElections(res.data));
    }
  }, [electionId]);

  if (electionId) {
    if (error) return <div className="card"><div className="alert alert-error">{error}</div></div>;
    if (!detail) return <div className="card">Loading…</div>;

    return (
      <div className="card fade-in-up">
        <Link to="/public-results" className="muted">← All Published Results</Link>
        <h2 style={{ marginTop: '0.5rem' }}>{detail.election.title}</h2>
        <p className="muted">
          Published {new Date(detail.publishedAt).toLocaleString()} ·{' '}
          Turnout: {detail.turnout.voted} / {detail.turnout.eligible} eligible voters
          {detail.turnout.eligible > 0 && ` (${Math.round((detail.turnout.voted / detail.turnout.eligible) * 100)}%)`}
        </p>
        <div className="results-list">
          {detail.results.map((r) => (
            <div key={r.candidate._id} className="result-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {r.candidate.symbolUrl && <img src={r.candidate.symbolUrl} alt="" className="symbol-thumb" />}
                <div>
                  <strong>{r.candidate.name}</strong>
                  <div className="muted">{r.candidate.party}</div>
                </div>
              </div>
              <div className="result-bar-wrap">
                <div className="result-bar" style={{ width: `${r.percent}%` }} />
              </div>
              <div>{r.votes} votes ({r.percent}%)</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card fade-in-up">
      <h2>Published Election Results</h2>
      <p className="muted">No login required — results are only listed here once an administrator publishes them.</p>
      {elections.length === 0 && <p className="muted">No results have been published yet.</p>}
      <div className="election-list">
        {elections.map((e) => (
          <div key={e._id} className="election-item">
            <div>
              <strong>{e.title}</strong>
              <div className="muted">
                <span className={`badge ${e.scope === 'national' ? 'badge-gold' : 'badge-gray'}`}>{e.scope}</span>
                {' '}{e.scope === 'local' && `${e.municipality}${e.ward ? `, Ward ${e.ward}` : ''}`}
              </div>
            </div>
            <Link to={`/public-results/${e._id}`} className="btn btn-small">View Results</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
