import { useEffect, useState } from 'react';
import api from '../api/axios';

const ACTION_LABELS = {
  admin_login: 'Admin logged in',
  approve_registration: 'Approved registration',
  reject_registration: 'Rejected registration',
  export_voters: 'Exported voter list',
  create_election: 'Created election',
  update_election: 'Updated election',
  delete_election: 'Deleted election',
  add_candidate: 'Added candidate',
  update_candidate: 'Updated candidate',
  delete_candidate: 'Removed candidate',
  open_election: 'Opened voting',
  close_election: 'Closed voting',
  publish_results: 'Published results',
  export_results: 'Exported results',
  approve_update_request: 'Approved detail-update request',
  reject_update_request: 'Rejected detail-update request',
  auto_close_election: 'Auto-closed election (scheduled job)',
  send_reminders: 'Sent voting reminders (scheduled job)',
};

export default function AdminAuditLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/admin/audit-logs').then((res) => setLogs(res.data));
  }, []);

  return (
    <div className="card">
      <h2>Audit Log</h2>
      <p className="muted">
        A record of every admin action taken in this system — never includes how anyone voted,
        only actions on registrations, elections, and candidates.
      </p>
      <table className="table">
        <thead><tr><th>When</th><th>By</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l._id}>
              <td>{new Date(l.createdAt).toLocaleString()}</td>
              <td>{l.adminUsername === 'system' ? <span className="badge badge-gray">system</span> : l.adminUsername}</td>
              <td>{ACTION_LABELS[l.action] || l.action}</td>
              <td className="muted">{l.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="muted">No actions recorded yet.</p>}
    </div>
  );
}
