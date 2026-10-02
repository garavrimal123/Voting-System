import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { PROVINCES, PROVINCE_DISTRICTS, DISTRICT_MUNICIPALITIES, MUNICIPALITY_WARDS } from '../data/nepalLocations';

const CITIZENSHIP_PATTERN = /^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,6}$/;

export default function TrackApplication() {
  const navigate = useNavigate();
  const [applicationId, setApplicationId] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [editForm, setEditForm] = useState(null);
  const [existingDocs, setExistingDocs] = useState(null); // { citizenshipDocUrl, photoUrl } — what's on file now
  const [citizenshipDoc, setCitizenshipDoc] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [resubmitStatus, setResubmitStatus] = useState(null);
  const [resubmitting, setResubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setEditForm(null);
    setExistingDocs(null);
    setLoading(true);
    try {
      const res = await api.get(`/voters/track/${applicationId.trim()}`);
      setResult(res.data);
      if (res.data.status === 'rejected') {
        setEditForm({
          fullName: res.data.fullName,
          dateOfBirth: res.data.dateOfBirth?.split('T')[0] || '',
          gender: res.data.gender,
          phone: res.data.phone,
          email: res.data.email,
          province: res.data.province,
          district: res.data.district,
          municipality: res.data.municipality,
          ward: res.data.ward,
          citizenshipNumber: res.data.citizenshipNumber,
        });
        setExistingDocs({ citizenshipDocUrl: res.data.citizenshipDocUrl, photoUrl: res.data.photoUrl });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not check status.');
    } finally {
      setLoading(false);
    }
  }

  function updateEdit(e) {
    const { name, value } = e.target;
    if (name === 'province') setEditForm({ ...editForm, province: value, district: '', municipality: '', ward: '' });
    else if (name === 'district') setEditForm({ ...editForm, district: value, municipality: '', ward: '' });
    else if (name === 'municipality') setEditForm({ ...editForm, municipality: value, ward: '' });
    else setEditForm({ ...editForm, [name]: value });
  }

  async function handleResubmit(e) {
    e.preventDefault();
    setResubmitStatus(null);

    if (!CITIZENSHIP_PATTERN.test(editForm.citizenshipNumber)) {
      setResubmitStatus({ ok: false, message: 'Citizenship number must be in the format XX-XX-XX-XXXXX.' });
      return;
    }

    const data = new FormData();
    Object.entries(editForm).forEach(([k, v]) => data.append(k, v));
    if (citizenshipDoc) data.append('citizenshipDoc', citizenshipDoc);
    if (photo) data.append('photo', photo);

    setResubmitting(true);
    try {
      const res = await api.put(`/voters/track/${result.applicationId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/registration-success', {
        state: {
          fullName: editForm.fullName,
          voterRecordId: res.data.voterRecordId,
          applicationId: res.data.applicationId,
        },
      });
      return;
    } catch (err) {
      setResubmitStatus({ ok: false, message: err.response?.data?.message || 'Resubmission failed.' });
    } finally {
      setResubmitting(false);
    }
  }

  const editWardCount = editForm ? MUNICIPALITY_WARDS[editForm.district]?.[editForm.municipality] : null;

  return (
    <div className={`card fade-in-up ${editForm ? '' : 'narrow'}`}>
      <h2>Track Your Application</h2>
      <p className="muted">Enter the Application ID you received at registration.</p>

      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <label>Application ID
          <input value={applicationId} onChange={(e) => setApplicationId(e.target.value)}
            placeholder="APP-2026-123456" required autoComplete="off" />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Check Status'}
        </button>
      </form>

      {error && <div className="alert alert-error shake">{error}</div>}

      {result && (
        <div className="track-result fade-in-up">
          <p><strong>{result.fullName}</strong></p>
          <span className={
            'badge ' +
            (result.status === 'approved' ? 'badge-green' :
             result.status === 'rejected' ? 'badge-red' : 'badge-gray')
          }>
            {result.status.toUpperCase()}
          </span>

          {result.status === 'pending' && (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Your application is still being reviewed. Check back later.
            </p>
          )}
          {result.status === 'approved' && (
            <p className="muted" style={{ marginTop: '0.75rem' }}>
              Approved! Your Voter ID (<strong>{result.voterId}</strong>) and password were sent to your email.
            </p>
          )}
          {result.status === 'rejected' && (
            <p className="alert alert-error" style={{ marginTop: '0.75rem' }}>
              <strong>Reason:</strong> {result.rejectionReason}
            </p>
          )}
        </div>
      )}

      {editForm && (
        <div className="card fade-in-up" style={{ marginTop: '1.5rem' }}>
          <h3>Correct & Resubmit</h3>
          <p className="muted">Update whatever caused the rejection, then resubmit — no need to start over.</p>
          <form onSubmit={handleResubmit} className="form-grid" autoComplete="off">
            <label>Full Name
              <input name="fullName" value={editForm.fullName} onChange={updateEdit} required />
            </label>
            <label>Date of Birth
              <input type="date" name="dateOfBirth" value={editForm.dateOfBirth} onChange={updateEdit} required />
            </label>
            <label>Gender
              <select name="gender" value={editForm.gender} onChange={updateEdit}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>Phone
              <input name="phone" value={editForm.phone} onChange={updateEdit} required />
            </label>
            <label>Email
              <input type="email" name="email" value={editForm.email} onChange={updateEdit} required />
            </label>
            <label>Citizenship Number
              <input name="citizenshipNumber" value={editForm.citizenshipNumber} onChange={updateEdit}
                placeholder="27-01-70-01234" required />
            </label>
            <label>Province
              <select name="province" value={editForm.province} onChange={updateEdit} required>
                <option value="" disabled>Select province</option>
                {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>District
              <select name="district" value={editForm.district} onChange={updateEdit} required disabled={!editForm.province}>
                <option value="" disabled>Select district</option>
                {(PROVINCE_DISTRICTS[editForm.province] || []).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label>Municipality
              {DISTRICT_MUNICIPALITIES[editForm.district] ? (
                <select name="municipality" value={editForm.municipality} onChange={updateEdit} required>
                  <option value="" disabled>Select municipality</option>
                  {DISTRICT_MUNICIPALITIES[editForm.district].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              ) : (
                <input name="municipality" value={editForm.municipality} onChange={updateEdit} required />
              )}
            </label>
            <label>Ward Number
              {editWardCount ? (
                <select name="ward" value={editForm.ward} onChange={updateEdit} required disabled={!editForm.municipality}>
                  <option value="" disabled>Select ward</option>
                  {Array.from({ length: editWardCount }, (_, i) => i + 1).map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              ) : (
                <input type="number" name="ward" value={editForm.ward} onChange={updateEdit} required min="1"
                  disabled={!editForm.municipality} />
              )}
            </label>

            <div className="existing-doc-preview">
              <p className="muted" style={{ marginBottom: '0.4rem' }}>
                Currently on file — browsers can't pre-fill a file picker, so these previews show what's
                already submitted. Only choose a new file below if you want to replace one.
              </p>
              <div className="preview-row">
                {existingDocs?.photoUrl && (
                  <div>
                    <a href={existingDocs.photoUrl} target="_blank" rel="noreferrer"><img src={existingDocs.photoUrl} alt="Current photo on file" className="preview-thumb" /></a>
                    <div className="muted" style={{ fontSize: '0.75rem' }}>Current photo (click to enlarge)</div>
                  </div>
                )}
                {existingDocs?.citizenshipDocUrl && (
                  <div>
                    {/\.pdf(\?|$)/i.test(existingDocs.citizenshipDocUrl) ? (
                      <a href={existingDocs.citizenshipDocUrl} target="_blank" rel="noreferrer" className="btn btn-small">View current PDF</a>
                    ) : (
                      <a href={existingDocs.citizenshipDocUrl} target="_blank" rel="noreferrer"><img src={existingDocs.citizenshipDocUrl} alt="Current citizenship document on file" className="preview-thumb wide" /></a>
                    )}
                    <div className="muted" style={{ fontSize: '0.75rem' }}>Current citizenship document (click to enlarge)</div>
                  </div>
                )}
              </div>
            </div>

            <label>Re-upload Citizenship Document (optional — keeps the one above if skipped)
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setCitizenshipDoc(e.target.files[0])} />
            </label>
            <label>Re-upload Photo (optional — keeps the one above if skipped)
              <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setPhoto(e.target.files[0])} />
            </label>
            <button type="submit" disabled={resubmitting}>
              {resubmitting ? <span className="spinner" /> : 'Resubmit for Review'}
            </button>
          </form>
          {resubmitStatus && (
            <div className={`alert ${resubmitStatus.ok ? 'alert-success' : 'alert-error shake'}`}>{resubmitStatus.message}</div>
          )}
        </div>
      )}
    </div>
  );
}
