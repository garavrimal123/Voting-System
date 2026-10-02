import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import Countdown from '../components/Countdown';

export default function VoterDashboard() {
  const [elections, setElections] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    try {
      const res = await api.get('/elections');
      setElections(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load elections.');
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // refresh status periodically
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card">
      <h2>Elections in Your Area</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {elections.length === 0 && !error && <p className="muted">No elections have been set up for your area yet.</p>}

      <div className="election-list">
        {elections.map((e) => (
          <div key={e._id} className="election-item">
            <div>
              <strong>{e.title}</strong>
              <div className="muted">{e.level.replace('_', ' ')}</div>
            </div>
            <Countdown startTime={e.startTime} endTime={e.endTime} status={e.status} />
            <div className="election-actions">
              {e.votingOpenNow && !e.hasVoted && (
                <Link to={`/vote/${e._id}`} className="btn">Cast Vote</Link>
              )}
              {e.hasVoted && <span className="badge badge-gray">Already voted</span>}
              {e.resultsPublished && (
                <Link to={`/results/${e._id}`} className="btn btn-secondary">View Results</Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
