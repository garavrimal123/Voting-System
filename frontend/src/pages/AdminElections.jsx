import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { PROVINCES, PROVINCE_DISTRICTS, DISTRICT_MUNICIPALITIES, MUNICIPALITY_WARDS } from '../data/nepalLocations';

const LOCAL_LEVELS = [
  { value: 'mayor', label: 'Mayor' },
  { value: 'deputy_mayor', label: 'Deputy Mayor' },
  { value: 'ward_chairperson', label: 'Ward Chairperson' },
  { value: 'ward_member', label: 'Ward Member' },
];
const NATIONAL_LEVELS = [
  { value: 'prime_minister', label: 'Prime Minister' },
  { value: 'president', label: 'President' },
];

const initialForm = {
  title: '', scope: 'local', level: 'mayor',
  province: '', district: '', municipality: '', ward: '',
};

export default function AdminElections() {
  const [elections, setElections] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [creating, setCreating] = useState(false);

  function loadElections() {
    api.get('/admin/elections').then((res) => setElections(res.data));
  }
  useEffect(loadElections, []);

  function update(e) {
    const { name, value } = e.target;
    if (name === 'scope') {
      // Switch the level to a sensible default for the new scope.
      setForm({ ...form, scope: value, level: value === 'national' ? 'prime_minister' : 'mayor' });
    } else if (name === 'province') {
      setForm({ ...form, province: value, district: '', municipality: '', ward: '' });
    } else if (name === 'district') {
      setForm({ ...form, district: value, municipality: '', ward: '' });
    } else if (name === 'municipality') {
      setForm({ ...form, municipality: value, ward: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setMessage(null);
    setCreating(true);
    try {
      const payload = { title: form.title, scope: form.scope, level: form.level };
      if (form.scope === 'local') {
        payload.province = form.province;
        payload.district = form.district;
        payload.municipality = form.municipality;
        if (form.level === 'ward_chairperson' || form.level === 'ward_member') payload.ward = form.ward;
      }
      await api.post('/admin/elections', payload);
      setForm(initialForm);
      setMessage({ ok: true, text: 'Election created — configure candidates from its manage page.' });
      loadElections();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not create election.' });
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this draft election and all its candidates? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/elections/${id}`);
      loadElections();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not delete election.' });
    }
  }

  const isLocal = form.scope === 'local';
  const needsWard = isLocal && (form.level === 'ward_chairperson' || form.level === 'ward_member');
  const wardCount = MUNICIPALITY_WARDS[form.district]?.[form.municipality];

  return (
    <div>
      <div className="card fade-in-up">
        <h2>Create Election</h2>
        <form onSubmit={handleCreate} className="form-grid" autoComplete="off">
          <label>Title
            <input name="title" value={form.title} onChange={update} required
              placeholder={isLocal ? 'e.g. Mayor - Biratnagar Metropolitan City' : 'e.g. Prime Minister of Nepal 2026'} />
          </label>
          <label>Election Scope
            <select name="scope" value={form.scope} onChange={update}>
              <option value="local">Local — one municipality/ward</option>
              <option value="national">National — all of Nepal at once</option>
            </select>
          </label>
          <label>Contest Level
            <select name="level" value={form.level} onChange={update}>
              {(isLocal ? LOCAL_LEVELS : NATIONAL_LEVELS).map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </label>

          {isLocal && (
            <>
              <label>Province
                <select name="province" value={form.province} onChange={update} required>
                  <option value="" disabled>Select province</option>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label>District
                <select name="district" value={form.district} onChange={update} required disabled={!form.province}>
                  <option value="" disabled>{form.province ? 'Select district' : 'Select province first'}</option>
                  {(PROVINCE_DISTRICTS[form.province] || []).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label>
              <label>Municipality
                {DISTRICT_MUNICIPALITIES[form.district] ? (
                  <select name="municipality" value={form.municipality} onChange={update} required disabled={!form.district}>
                    <option value="" disabled>Select municipality</option>
                    {DISTRICT_MUNICIPALITIES[form.district].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input name="municipality" value={form.municipality} onChange={update} required
                    disabled={!form.district}
                    placeholder={form.district ? 'Type municipality name' : 'Select district first'} />
                )}
              </label>
              {needsWard && (
                <label>Ward Number
                  {wardCount ? (
                    <select name="ward" value={form.ward} onChange={update} required disabled={!form.municipality}>
                      <option value="" disabled>Select ward</option>
                      {Array.from({ length: wardCount }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  ) : (
                    <input type="number" name="ward" value={form.ward} onChange={update} required min="1"
                      disabled={!form.municipality}
                      placeholder={form.municipality ? '' : 'Select municipality first'} />
                  )}
                </label>
              )}
            </>
          )}
          {!isLocal && (
            <p className="muted">This election will be open to every approved voter nationwide, regardless of location.</p>
          )}

          <button type="submit" disabled={creating}>{creating ? <span className="spinner" /> : 'Create Election'}</button>
        </form>
        {message && <div className={`alert ${message.ok ? 'alert-success' : 'alert-error shake'}`}>{message.text}</div>}
      </div>

      <div className="card">
        <h2>All Elections</h2>
        <table className="table">
          <thead><tr><th>Title</th><th>Scope</th><th>Location</th><th>Status</th><th>Results</th><th></th></tr></thead>
          <tbody>
            {elections.map((e) => (
              <tr key={e._id}>
                <td>{e.title}</td>
                <td><span className={`badge ${e.scope === 'national' ? 'badge-gold' : 'badge-gray'}`}>{e.scope}</span></td>
                <td>{e.scope === 'national' ? 'Nationwide' : `${e.municipality}${e.ward ? `, Ward ${e.ward}` : ''}`}</td>
                <td><span className={`badge badge-${e.status === 'open' ? 'green' : e.status === 'closed' ? 'red' : 'gray'}`}>{e.status}</span></td>
                <td>{e.resultsPublished ? 'Published' : 'Hidden'}</td>
                <td>
                  <Link to={`/admin/elections/${e._id}`} className="btn btn-small">Manage</Link>
                  {e.status === 'draft' && (
                    <button className="btn btn-small btn-danger" onClick={() => handleDelete(e._id)}>Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
