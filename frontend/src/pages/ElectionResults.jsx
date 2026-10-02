import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

export default function ElectionResults() {
  const { electionId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/elections/${electionId}/results`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Results not available.'));
  }, [electionId]);

  if (error) return <div className="card"><div className="alert alert-error">{error}</div></div>;
  if (!data) return <div className="card">Loading…</div>;

  const totalVotes = data.results.reduce((sum, r) => sum + r.votes, 0);

  return (
    <div className="card">
      <h2>{data.election}</h2>
      <p className="muted">
        Published {new Date(data.publishedAt).toLocaleString()}
        {data.turnout && ` · Turnout: ${data.turnout.voted} / ${data.turnout.eligible} eligible voters` +
          (data.turnout.eligible > 0 ? ` (${Math.round((data.turnout.voted / data.turnout.eligible) * 100)}%)` : '')}
      </p>
      <div className="results-list">
        {data.results
          .sort((a, b) => b.votes - a.votes)
          .map((r) => (
            <div key={r.candidate._id} className="result-row">
              <div>
                <strong>{r.candidate.name}</strong>
                <div className="muted">{r.candidate.party}</div>
              </div>
              <div className="result-bar-wrap">
                <div className="result-bar" style={{ width: `${totalVotes ? (r.votes / totalVotes) * 100 : 0}%` }} />
              </div>
              <div>{r.votes} votes</div>
            </div>
          ))}
      </div>
    </div>
  );
}
