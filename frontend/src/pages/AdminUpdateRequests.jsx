import { useEffect, useState } from 'react';
import api from '../api/axios';

const TABS = ['pending', 'approved', 'rejected'];

export default function AdminUpdateRequests() {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState(null);

  function load(status) {
    api.get(`/admin/update-requests?status=${status}`).then((res) => setRequests(res.data));
  }
  useEffect(() => load(tab), [tab]);

  async function approve(id) {
    setMessage(null);
    try {
      await api.post(`/admin/update-requests/${id}/approve`);
      load(tab);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Approval failed.');
    }
  }

  async function reject(id) {
    const reason = window.prompt('Reason for rejecting this update request (sent to the voter by email):');
    if (!reason || !reason.trim()) return;
    setMessage(null);
    try {
      await api.post(`/admin/update-requests/${id}/reject`, { reason: reason.trim() });
      load(tab);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Rejection failed.');
    }
  }

  return (
    <div className="card">
      <h2>Voter Detail Update Requests</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {message && <div className="alert alert-error shake">{message}</div>}

      <table className="table">
        <thead>
          <tr><th>Tracking ID</th><th>Voter</th><th>Requested Changes</th>{tab === 'pending' && <th>Actions</th>}{tab === 'rejected' && <th>Reason</th>}</tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r._id}>
              <td>{r.trackingId}</td>
              <td>{r.voter?.fullName} ({r.voter?.voterId})</td>
              <td>
                {Object.entries(r.changes || {}).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="muted">{k}: {String(v)}</div>
                ))}
                {r.newPhotoUrl && <div><a href={r.newPhotoUrl} target="_blank" rel="noreferrer">New photo</a></div>}
                {r.newCitizenshipDocUrl && <div><a href={r.newCitizenshipDocUrl} target="_blank" rel="noreferrer">New citizenship document</a></div>}
                {r.proofDocUrl && <div><a href={r.proofDocUrl} target="_blank" rel="noreferrer">Proof document</a></div>}
              </td>
              {tab === 'pending' && (
                <td>
                  <button className="btn btn-small" onClick={() => approve(r._id)}>Approve</button>
                  <button className="btn btn-small btn-danger" onClick={() => reject(r._id)}>Reject</button>
                </td>
              )}
              {tab === 'rejected' && <td className="muted">{r.reviewReason}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
