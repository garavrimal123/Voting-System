import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { downloadCsv } from '../utils/downloadCsv';

export default function AdminDashboard() {
  const [tab, setTab] = useState('pending');
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  async function loadRegistrations(status, searchTerm = search) {
    const params = new URLSearchParams({ status });
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    const res = await api.get(`/admin/registrations?${params.toString()}`);
    setRegistrations(res.data);
  }

  // Single source of truth for when to (re)fetch: tab or search changing.
  // Debounced so typing doesn't fire a request per keystroke; tab switches
  // pay the same short delay, which is imperceptible but keeps this simple
  // and avoids two competing requests racing each other.
  useEffect(() => {
    const timer = setTimeout(() => { loadRegistrations(tab, search); }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadRegistrations(tab, search);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsv(`/admin/registrations/export?status=${tab}`, `voters-${tab}.csv`);
    } catch {
      setMessage('Export failed.');
    } finally {
      setExporting(false);
    }
  }
  useEffect(() => { api.get('/admin/stats').then((res) => setStats(res.data)); }, [registrations]);

  async function approve(id) {
    setMessage(null);
    try {
      const res = await api.post(`/admin/registrations/${id}/approve`);
      setMessage(`Approved. Voter ID: ${res.data.voterId}`);
      loadRegistrations(tab);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Approval failed.');
    }
  }

  async function reject(id) {
    const reason = window.prompt('Reason for rejecting this registration (sent to the applicant by email):');
    if (!reason || !reason.trim()) return;
    setMessage(null);
    try {
      await api.post(`/admin/registrations/${id}/reject`, { reason: reason.trim() });
      loadRegistrations(tab);
    } catch (err) {
      setMessage(err.response?.data?.message || 'Rejection failed.');
    }
  }

  return (
    <div>
      {stats && (
        <div className="stats-row">
          <div className="stat-card"><div className="stat-num">{stats.pending}</div><div className="stat-label">Pending</div></div>
          <div className="stat-card"><div className="stat-num">{stats.approved}</div><div className="stat-label">Approved Voters</div></div>
          <div className="stat-card"><div className="stat-num">{stats.rejected}</div><div className="stat-label">Rejected</div></div>
          <div className="stat-card"><div className="stat-num">{stats.elections}</div><div className="stat-label">Elections</div></div>
          <div className="stat-card"><div className="stat-num">{stats.openElections}</div><div className="stat-label">Open Now</div></div>
          <div className="stat-card"><div className="stat-num">{stats.pendingUpdates}</div><div className="stat-label">Update Requests</div></div>
        </div>
      )}

      <div className="card">
        <h2>Voter Registrations</h2>
        <div className="tabs">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button key={s} className={tab === s ? 'tab active' : 'tab'} onClick={() => setTab(s)}>{s}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap', margin: '0.75rem 0' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: '220px' }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, phone, email, application ID, voter ID…"
              style={{ flex: 1, padding: '0.55rem 0.7rem', border: '1.5px solid #ddd', borderRadius: '8px' }}
            />
            <button type="submit" className="btn-small">Search</button>
          </form>
          <button className="btn btn-small btn-secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? <span className="spinner" /> : 'Export CSV'}
          </button>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        <table className="table">
          <thead>
            <tr><th>App ID</th><th>Name</th><th>Phone</th><th>Location</th><th>Voter ID</th><th>Docs</th>
              {tab === 'pending' && <th>Actions</th>}
              {tab === 'rejected' && <th>Reason</th>}
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r._id}>
                <td>{r.applicationId}</td>
                <td>{r.fullName}</td>
                <td>{r.phone}</td>
                <td>{r.municipality}, Ward {r.ward}</td>
                <td>{r.voterId || '—'}</td>
                <td>
                  <a href={r.citizenshipDocUrl} target="_blank" rel="noreferrer">ID</a>{' / '}
                  <a href={r.photoUrl} target="_blank" rel="noreferrer">Photo</a>
                </td>
                {tab === 'pending' && (
                  <td>
                    <button className="btn btn-small" onClick={() => approve(r._id)}>Approve</button>
                    <button className="btn btn-small btn-danger" onClick={() => reject(r._id)}>Reject</button>
                  </td>
                )}
                {tab === 'rejected' && <td className="muted">{r.rejectionReason}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Elections</h2>
        <p className="muted">Create local or national elections, manage candidates, open/close voting, and publish results.</p>
        <Link to="/admin/elections" className="btn">Go to Election Manager</Link>
      </div>

      <div className="card">
        <h2>Voter Detail Update Requests</h2>
        <p className="muted">Review corrections voters have requested to their registered details.</p>
        <Link to="/admin/update-requests" className="btn">Review Update Requests</Link>
      </div>

      <div className="card">
        <h2>Audit Log</h2>
        <p className="muted">See every admin action taken in this system, for accountability.</p>
        <Link to="/admin/audit-log" className="btn">View Audit Log</Link>
      </div>
    </div>
  );
}
