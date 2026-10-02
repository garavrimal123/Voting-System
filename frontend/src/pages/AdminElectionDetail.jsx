import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { downloadCsv } from '../utils/downloadCsv';

export default function AdminElectionDetail() {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [tally, setTally] = useState([]);
  const [stats, setStats] = useState(null);
  const [message, setMessage] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [editingElection, setEditingElection] = useState(false);
  const [electionForm, setElectionForm] = useState(null);

  const [candidateForm, setCandidateForm] = useState({ name: '', party: '' });
  const [candidatePhoto, setCandidatePhoto] = useState(null);
  const [candidateSymbol, setCandidateSymbol] = useState(null);
  const [addFormKey, setAddFormKey] = useState(0); // bump to remount file inputs after a successful add
  const [addingCandidate, setAddingCandidate] = useState(false);

  const [editingCandidateId, setEditingCandidateId] = useState(null);
  const [editCandidate, setEditCandidate] = useState(null); // the current candidate being edited (for left column)
  const [editCandidateForm, setEditCandidateForm] = useState({ name: '', party: '' });
  const [editCandidatePhoto, setEditCandidatePhoto] = useState(null);
  const [editCandidateSymbol, setEditCandidateSymbol] = useState(null);
  const [savingCandidate, setSavingCandidate] = useState(false);

  const [times, setTimes] = useState({ startTime: '', endTime: '' });

  async function load() {
    const res = await api.get(`/admin/elections/${electionId}`);
    setElection(res.data.election);
    setCandidates(res.data.candidates);
    setStats(res.data.stats);
  }
  useEffect(() => { load(); }, [electionId]);

  function startEditElection() {
    setElectionForm({
      title: election.title,
      level: election.level,
      province: election.province || '',
      district: election.district || '',
      municipality: election.municipality || '',
      ward: election.ward || '',
    });
    setEditingElection(true);
  }

  async function saveElection(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.put(`/admin/elections/${electionId}`, { ...electionForm, scope: election.scope });
      setElection(res.data);
      setEditingElection(false);
      setMessage({ ok: true, text: 'Election updated.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not update election.' });
    }
  }

  async function deleteElection() {
    if (!window.confirm('Delete this election and all its candidates? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/elections/${electionId}`);
      navigate('/admin/elections');
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not delete election.' });
    }
  }

  async function addCandidate(e) {
    e.preventDefault();
    setMessage(null);
    if (!candidatePhoto || !candidateSymbol) {
      setMessage({ ok: false, text: 'Both a candidate photo and a party symbol are required.' });
      return;
    }
    setAddingCandidate(true);
    try {
      const data = new FormData();
      data.append('name', candidateForm.name);
      data.append('party', candidateForm.party);
      data.append('photo', candidatePhoto);
      data.append('symbol', candidateSymbol);
      await api.post(`/admin/elections/${electionId}/candidates`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setCandidateForm({ name: '', party: '' });
      setCandidatePhoto(null);
      setCandidateSymbol(null);
      setAddFormKey((k) => k + 1); // remounts the file inputs so "No file chosen" actually shows again
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not add candidate.' });
    } finally {
      setAddingCandidate(false);
    }
  }

  function startEditCandidate(c) {
    setEditingCandidateId(c._id);
    setEditCandidate(c);
    setEditCandidateForm({ name: '', party: '' }); // blank = keep current, matching the voter-update pattern
    setEditCandidatePhoto(null);
    setEditCandidateSymbol(null);
  }

  async function saveCandidate(id) {
    setMessage(null);
    setSavingCandidate(true);
    try {
      const data = new FormData();
      if (editCandidateForm.name) data.append('name', editCandidateForm.name);
      if (editCandidateForm.party) data.append('party', editCandidateForm.party);
      if (editCandidatePhoto) data.append('photo', editCandidatePhoto);
      if (editCandidateSymbol) data.append('symbol', editCandidateSymbol);
      await api.put(`/admin/candidates/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditingCandidateId(null);
      setEditCandidate(null);
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not update candidate.' });
    } finally {
      setSavingCandidate(false);
    }
  }

  async function deleteCandidate(id) {
    if (!window.confirm('Remove this candidate?')) return;
    try {
      await api.delete(`/admin/candidates/${id}`);
      load();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not remove candidate.' });
    }
  }

  async function openVoting(e) {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await api.post(`/admin/elections/${electionId}/open`, {
        startTime: new Date(times.startTime).toISOString(),
        endTime: new Date(times.endTime).toISOString(),
      });
      setElection(res.data);
      setMessage({ ok: true, text: 'Voting is now open.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not open voting.' });
    }
  }

  async function closeVoting() {
    setMessage(null);
    try {
      const res = await api.post(`/admin/elections/${electionId}/close`);
      setElection(res.data);
      setMessage({ ok: true, text: 'Voting closed.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not close voting.' });
    }
  }

  async function loadTally() {
    const res = await api.get(`/admin/elections/${electionId}/tally`);
    setTally(res.data);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadCsv(`/admin/elections/${electionId}/export`, 'election-results.csv');
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Export failed.' });
    } finally {
      setExporting(false);
    }
  }

  async function publish() {
    setMessage(null);
    try {
      const res = await api.post(`/admin/elections/${electionId}/publish`);
      setElection(res.data);
      setMessage({ ok: true, text: 'Results published — voters can now view them.' });
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Could not publish results.' });
    }
  }

  if (!election) return <div className="card">Loading…</div>;

  return (
    <div>
      <div className="card">
        {!editingElection ? (
          <>
            <h2>{election.title}</h2>
            <p className="muted">
              <span className={`badge ${election.scope === 'national' ? 'badge-gold' : 'badge-gray'}`}>{election.scope}</span>
              {' '}{election.scope === 'local' && `${election.municipality}${election.ward ? `, Ward ${election.ward}` : ''} — `}
              status: <strong>{election.status}</strong>
              {election.resultsPublished && ' — results published'}
            </p>
            {stats && (
              <p className="muted">
                Turnout: {stats.voted} / {stats.eligible} eligible voters
                {stats.eligible > 0 && ` (${Math.round((stats.voted / stats.eligible) * 100)}%)`}
              </p>
            )}
            {election.status === 'draft' && (
              <div className="election-actions">
                <button className="btn btn-small" onClick={startEditElection}>Edit Election</button>
                <button className="btn btn-small btn-danger" onClick={deleteElection}>Delete Election</button>
              </div>
            )}
          </>
        ) : (
          <form onSubmit={saveElection} className="form-grid">
            <label>Title
              <input value={electionForm.title} onChange={(e) => setElectionForm({ ...electionForm, title: e.target.value })} required />
            </label>
            {election.scope === 'local' && (
              <>
                <label>Municipality
                  <input value={electionForm.municipality} onChange={(e) => setElectionForm({ ...electionForm, municipality: e.target.value })} required />
                </label>
                <label>Ward (leave blank if not ward-level)
                  <input type="number" value={electionForm.ward} onChange={(e) => setElectionForm({ ...electionForm, ward: e.target.value })} />
                </label>
              </>
            )}
            <div className="election-actions">
              <button type="submit">Save</button>
              <button type="button" className="btn-secondary" onClick={() => setEditingElection(false)}>Cancel</button>
            </div>
          </form>
        )}
        {message && <div className={`alert ${message.ok ? 'alert-success' : 'alert-error shake'}`}>{message.text}</div>}
      </div>

      <div className="card">
        <h3>Candidates</h3>
        {candidates.length === 0 && <p className="muted">No candidates added yet.</p>}
        <ul className="candidate-admin-list">
          {candidates.filter((c) => c._id !== editingCandidateId).map((c) => (
            <li key={c._id} className="candidate-admin-row">
              {c.symbolUrl && <img src={c.symbolUrl} alt={`${c.party} symbol`} className="symbol-thumb" />}
              <span style={{ flex: 1 }}>{c.name} — {c.party}</span>
              {election.status === 'draft' && (
                <div className="election-actions">
                  <button className="btn btn-small" onClick={() => startEditCandidate(c)}>Edit</button>
                  <button className="btn btn-small btn-danger" onClick={() => deleteCandidate(c._id)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* Editing a candidate replaces the list with a two-column view:
            current info + images on the left, optional overrides on the right. */}
        {editingCandidateId && editCandidate && (
          <div className="two-col-layout" style={{ marginTop: '1rem' }}>
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Current Candidate Info</h4>
              <div className="current-info-grid">
                <div><span className="muted">Name</span><div>{editCandidate.name}</div></div>
                <div><span className="muted">Party</span><div>{editCandidate.party}</div></div>
              </div>
              <div className="preview-row" style={{ marginTop: '1rem' }}>
                {editCandidate.photoUrl && (
                  <div>
                    <a href={editCandidate.photoUrl} target="_blank" rel="noreferrer"><img src={editCandidate.photoUrl} alt="Current candidate photo" className="preview-thumb" /></a>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>Current photo</div>
                  </div>
                )}
                {editCandidate.symbolUrl && (
                  <div>
                    <a href={editCandidate.symbolUrl} target="_blank" rel="noreferrer"><img src={editCandidate.symbolUrl} alt="Current party symbol" className="preview-thumb" /></a>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>Current symbol</div>
                  </div>
                )}
              </div>
            </div>
            <div className="card">
              <h4 style={{ marginTop: 0 }}>Change Candidate Details</h4>
              <p className="muted">Leave anything you don't want to change blank.</p>
              <form onSubmit={(e) => { e.preventDefault(); saveCandidate(editingCandidateId); }} className="form-grid">
                <label>Name
                  <input value={editCandidateForm.name} onChange={(e) => setEditCandidateForm({ ...editCandidateForm, name: e.target.value })}
                    placeholder="Leave blank to keep current" />
                </label>
                <label>Party
                  <input value={editCandidateForm.party} onChange={(e) => setEditCandidateForm({ ...editCandidateForm, party: e.target.value })}
                    placeholder="Leave blank to keep current" />
                </label>
                <label>Replace Photo (optional)
                  <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setEditCandidatePhoto(e.target.files[0])} />
                </label>
                <label>Replace Symbol (optional)
                  <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setEditCandidateSymbol(e.target.files[0])} />
                </label>
                <div className="election-actions">
                  <button type="submit" disabled={savingCandidate}>{savingCandidate ? <span className="spinner" /> : 'Save'}</button>
                  <button type="button" className="btn-secondary" onClick={() => { setEditingCandidateId(null); setEditCandidate(null); }}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {election.status === 'draft' && !editingCandidateId && (
          <>
            <h3 style={{ marginTop: '1.5rem' }}>Add New Candidate</h3>
            <form key={addFormKey} onSubmit={addCandidate} className="form-grid">
              <label>Name
                <input value={candidateForm.name} onChange={(e) => setCandidateForm({ ...candidateForm, name: e.target.value })} required />
              </label>
              <label>Party
                <input value={candidateForm.party} onChange={(e) => setCandidateForm({ ...candidateForm, party: e.target.value })} required />
              </label>
              <label>Candidate Photo
                <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setCandidatePhoto(e.target.files[0])} required />
              </label>
              <label>Party Symbol
                <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setCandidateSymbol(e.target.files[0])} required />
              </label>
              <button type="submit" disabled={addingCandidate}>{addingCandidate ? <span className="spinner" /> : 'Add Candidate'}</button>
            </form>
          </>
        )}
      </div>

      {election.status === 'draft' && (
        <div className="card">
          <h3>Open Voting</h3>
          <form onSubmit={openVoting} className="form-grid">
            <label>Start Time
              <input type="datetime-local" value={times.startTime}
                onChange={(e) => setTimes({ ...times, startTime: e.target.value })} required />
            </label>
            <label>End Time
              <input type="datetime-local" value={times.endTime}
                onChange={(e) => setTimes({ ...times, endTime: e.target.value })} required />
            </label>
            <button type="submit">Open Voting</button>
          </form>
        </div>
      )}

      {election.status === 'open' && (
        <div className="card">
          <button className="btn btn-danger" onClick={closeVoting}>Close Voting Now</button>
        </div>
      )}

      {election.status === 'closed' && (
        <div className="card">
          <h3>Results (admin view — not tied to any voter)</h3>
          <div className="election-actions">
            <button className="btn" onClick={loadTally}>Load Tally</button>
            <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
              {exporting ? <span className="spinner" /> : 'Export Results CSV'}
            </button>
          </div>
          <ul>
            {tally.map((t) => (
              <li key={t.candidate._id}>{t.candidate.name} ({t.candidate.party}): {t.votes} votes</li>
            ))}
          </ul>
          {!election.resultsPublished && (
            <button className="btn btn-secondary" onClick={publish}>Publish Results to Voters</button>
          )}
        </div>
      )}
    </div>
  );
}
