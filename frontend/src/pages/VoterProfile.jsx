import { useEffect, useState } from 'react';
import api from '../api/axios';
import { PROVINCES, PROVINCE_DISTRICTS, DISTRICT_MUNICIPALITIES } from '../data/nepalLocations';

const CITIZENSHIP_PATTERN = /^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,6}$/;
const FIELDS_REQUIRING_PROOF = ['fullName', 'province', 'district', 'municipality', 'ward', 'citizenshipNumber'];

const initial = {
  fullName: '', phone: '', email: '', province: '', district: '', municipality: '', ward: '', citizenshipNumber: '',
};

export default function VoterProfile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(initial);
  const [citizenshipDoc, setCitizenshipDoc] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [proofDocument, setProofDocument] = useState(null);
  const [fileResetKey, setFileResetKey] = useState(0);

  const [otpStep, setOtpStep] = useState('none'); // none | sent | verified
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/voters/me').then((res) => setMe(res.data));
  }, []);

  const emailOrPhoneChanged = !!(form.email || form.phone);
  const otherFieldsChanged = Object.entries(form).some(([k, v]) => v && k !== 'email' && k !== 'phone');
  const needsProof = FIELDS_REQUIRING_PROOF.some((f) => form[f]);
  const canSubmit = (!emailOrPhoneChanged || otpStep === 'verified') && (!needsProof || !!proofDocument);

  function update(e) {
    const { name, value } = e.target;
    if (name === 'province') setForm({ ...form, province: value, district: '', municipality: '', ward: '' });
    else if (name === 'district') setForm({ ...form, district: value, municipality: '', ward: '' });
    else if (name === 'municipality') setForm({ ...form, municipality: value, ward: '' });
    else setForm({ ...form, [name]: value });

    // Changing email/phone after an OTP was already sent/verified invalidates it.
    if ((name === 'email' || name === 'phone') && otpStep !== 'none') {
      setOtpStep('none');
      setOtp('');
    }
  }

  async function sendOtp() {
    setOtpMessage(null);
    setSendingOtp(true);
    try {
      const res = await api.post('/voters/update-request/send-otp', {
        newEmail: form.email || undefined,
        newPhone: form.phone || undefined,
      });
      setOtpStep('sent');
      setOtpMessage({ ok: true, text: res.data.message });
    } catch (err) {
      setOtpMessage({ ok: false, text: err.response?.data?.message || 'Could not send code.' });
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    setOtpMessage(null);
    setVerifyingOtp(true);
    try {
      await api.post('/voters/update-request/verify-otp', { otp });
      setOtpStep('verified');
      setOtpMessage({ ok: true, text: 'Verified.' });
    } catch (err) {
      setOtpMessage({ ok: false, text: err.response?.data?.message || 'Verification failed.' });
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    if (form.citizenshipNumber && !CITIZENSHIP_PATTERN.test(form.citizenshipNumber)) {
      setStatus({ ok: false, message: 'Citizenship number must be in the format XX-XX-XX-XXXXX.' });
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) data.append(k, v); });
    if (citizenshipDoc) data.append('citizenshipDoc', citizenshipDoc);
    if (photo) data.append('photo', photo);
    if (proofDocument) data.append('proofDocument', proofDocument);

    setLoading(true);
    try {
      const res = await api.post('/voters/update-request', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setStatus({ ok: true, message: res.data.message, trackingId: res.data.trackingId });
      setForm(initial);
      setCitizenshipDoc(null);
      setPhoto(null);
      setProofDocument(null);
      setFileResetKey((k) => k + 1); // remounts file inputs so "No file chosen" shows again
      setOtpStep('none');
      setOtp('');
    } catch (err) {
      setStatus({ ok: false, message: err.response?.data?.message || 'Request failed.' });
    } finally {
      setLoading(false);
    }
  }

  if (!me) return <div className="card">Loading…</div>;

  const municipalityOptions = DISTRICT_MUNICIPALITIES[form.district];

  return (
    <div className="two-col-layout">
      <div className="card">
        <h2>Your Current Details</h2>
        <p className="muted">This is what's on record. Only fill in the fields on the right that you want to change.</p>
        <div className="current-info-grid">
          <div><span className="muted">Full Name</span><div>{me.fullName}</div></div>
          <div><span className="muted">Phone</span><div>{me.phone}</div></div>
          <div><span className="muted">Email</span><div>{me.email}</div></div>
          <div><span className="muted">Citizenship No.</span><div>{me.citizenshipNumber}</div></div>
          <div><span className="muted">Province</span><div>{me.province}</div></div>
          <div><span className="muted">District</span><div>{me.district}</div></div>
          <div><span className="muted">Municipality</span><div>{me.municipality}</div></div>
          <div><span className="muted">Ward</span><div>{me.ward}</div></div>
        </div>
        <div className="preview-row" style={{ marginTop: '1rem' }}>
          <div>
            <a href={me.photoUrl} target="_blank" rel="noreferrer"><img src={me.photoUrl} alt="Current photo" className="preview-thumb" /></a>
            <div className="muted" style={{ fontSize: '0.75rem' }}>Current photo (click to enlarge)</div>
          </div>
          <div>
            {/\.pdf(\?|$)/i.test(me.citizenshipDocUrl) ? (
              <a href={me.citizenshipDocUrl} target="_blank" rel="noreferrer" className="btn btn-small">View PDF</a>
            ) : (
              <a href={me.citizenshipDocUrl} target="_blank" rel="noreferrer"><img src={me.citizenshipDocUrl} alt="Current citizenship document" className="preview-thumb wide" /></a>
            )}
            <div className="muted" style={{ fontSize: '0.75rem' }}>Current citizenship document (click to enlarge)</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>What Would You Like to Change?</h2>
        <p className="muted">Leave anything you don't want to change blank.</p>

        <form onSubmit={handleSubmit} className="form-grid" autoComplete="off" key={fileResetKey}>
          <label>Full Name
            <input name="fullName" value={form.fullName} onChange={update} placeholder="Leave blank to keep current" />
          </label>
          <label>Phone
            <input name="phone" value={form.phone} onChange={update} placeholder="Leave blank to keep current" />
          </label>
          <label>Email
            <input type="email" name="email" value={form.email} onChange={update} placeholder="Leave blank to keep current" />
          </label>

          {emailOrPhoneChanged && (
            <div className="otp-box">
              <p className="muted" style={{ marginBottom: '0.5rem' }}>
                {form.email
                  ? 'A verification code will be sent to your NEW email.'
                  : 'A verification code will be sent to your CURRENT email on file, to confirm this phone change.'}
              </p>
              {otpStep === 'none' && (
                <button type="button" className="btn btn-small" onClick={sendOtp} disabled={sendingOtp}>
                  {sendingOtp ? <span className="spinner" /> : 'Send Code'}
                </button>
              )}
              {otpStep === 'sent' && (
                <div className="form-grid">
                  <label>Enter Code
                    <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
                  </label>
                  <button type="button" className="btn btn-small" onClick={verifyOtp} disabled={verifyingOtp}>
                    {verifyingOtp ? <span className="spinner" /> : 'Verify Code'}
                  </button>
                </div>
              )}
              {otpStep === 'verified' && <span className="badge badge-green">Verified</span>}
              {otpMessage && (
                <div className={`alert ${otpMessage.ok ? 'alert-success' : 'alert-error shake'}`} style={{ marginTop: '0.5rem' }}>
                  {otpMessage.text}
                </div>
              )}
            </div>
          )}

          <label>Citizenship Number
            <input name="citizenshipNumber" value={form.citizenshipNumber} onChange={update}
              placeholder="Leave blank, or 27-01-70-01234" />
          </label>
          <label>Province
            <select name="province" value={form.province} onChange={update}>
              <option value="">Leave blank to keep current</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label>District
            <select name="district" value={form.district} onChange={update} disabled={!form.province}>
              <option value="">{form.province ? 'Select district' : 'Select a province first to change district'}</option>
              {(PROVINCE_DISTRICTS[form.province] || []).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>Municipality
            {municipalityOptions ? (
              <select name="municipality" value={form.municipality} onChange={update} disabled={!form.district}>
                <option value="">Leave blank to keep current</option>
                {municipalityOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input name="municipality" value={form.municipality} onChange={update} placeholder="Leave blank to keep current" />
            )}
          </label>
          <label>Ward Number
            <input type="number" name="ward" value={form.ward} onChange={update} min="1" placeholder="Leave blank to keep current" />
          </label>
          <label>Replace Citizenship Document (optional)
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setCitizenshipDoc(e.target.files[0])} />
          </label>
          <label>Replace Photo (optional)
            <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setPhoto(e.target.files[0])} />
          </label>

          {needsProof && (
            <label>
              Proof of Correct Information (required for name, address, or ward changes — e.g. citizenship copy, marriage certificate, ward recommendation letter)
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setProofDocument(e.target.files[0])} required />
            </label>
          )}

          <button type="submit" disabled={loading || !canSubmit}>
            {loading ? <span className="spinner" /> : 'Submit Update Request'}
          </button>
          {!canSubmit && (
            <p className="muted" style={{ margin: 0 }}>
              {emailOrPhoneChanged && otpStep !== 'verified' && 'Verify your code above to enable submission. '}
              {needsProof && !proofDocument && 'Attach a proof document to enable submission.'}
            </p>
          )}
        </form>

        {status && (
          <div className={`alert ${status.ok ? 'alert-success' : 'alert-error shake'}`}>
            {status.message}
            {status.trackingId && (
              <div style={{ marginTop: '0.5rem' }}>
                Tracking ID: <strong>{status.trackingId}</strong> — also sent to your email.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
