import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { PROVINCES, PROVINCE_DISTRICTS, DISTRICT_MUNICIPALITIES, MUNICIPALITY_WARDS } from '../data/nepalLocations';

const CITIZENSHIP_PATTERN = /^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,6}$/;

function maxDobFor18() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split('T')[0];
}
const MIN_DOB = '1900-01-01';
const MAX_DOB = maxDobFor18();

function calcAge(dobString) {
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

const initial = {
  fullName: '', dateOfBirth: '', gender: 'male', phone: '', email: '',
  province: '', district: '', municipality: '', ward: '', citizenshipNumber: '',
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [citizenshipDoc, setCitizenshipDoc] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [status, setStatus] = useState(null); // { ok, message, id }
  const [loading, setLoading] = useState(false);

  function update(e) {
    const { name, value } = e.target;
    if (name === 'province') {
      setForm({ ...form, province: value, district: '', municipality: '', ward: '' });
    } else if (name === 'district') {
      setForm({ ...form, district: value, municipality: '', ward: '' });
    } else if (name === 'municipality') {
      setForm({ ...form, municipality: value, ward: '' });
    } else {
      setForm({ ...form, [name]: value });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(null);

    const age = calcAge(form.dateOfBirth);
    if (age === null) {
      setStatus({ ok: false, message: 'Please provide a valid date of birth.' });
      return;
    }
    if (age < 18) {
      setStatus({ ok: false, message: 'You must be at least 18 years old to register as a voter.' });
      return;
    }

    if (!CITIZENSHIP_PATTERN.test(form.citizenshipNumber)) {
      setStatus({ ok: false, message: 'Citizenship number must be in the format XX-XX-XX-XXXXX (e.g. 27-01-70-01234).' });
      return;
    }

    if (!citizenshipDoc || !photo) {
      setStatus({ ok: false, message: 'Please attach both your citizenship document and a photo.' });
      return;
    }

    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    data.append('citizenshipDoc', citizenshipDoc);
    data.append('photo', photo);

    setLoading(true);
    try {
      const res = await api.post('/voters/register', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate('/registration-success', {
        state: {
          fullName: form.fullName,
          voterRecordId: res.data.voterRecordId,
          applicationId: res.data.applicationId,
        },
      });
      return;
    } catch (err) {
      setStatus({ ok: false, message: err.response?.data?.message || 'Registration failed.' });
    } finally {
      setLoading(false);
    }
  }

  const wardCount = MUNICIPALITY_WARDS[form.district]?.[form.municipality];

  return (
    <div className="card fade-in-up">
      <h2>Voter Registration</h2>
      <p className="muted">Documents must be JPG, PNG, or PDF, under 200KB each. You must be 18 or older.</p>

      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <label>Full Name
          <input name="fullName" value={form.fullName} onChange={update} required autoComplete="off" />
        </label>
        <label>Date of Birth
          <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={update}
            min={MIN_DOB} max={MAX_DOB} required />
        </label>
        <label>Gender
          <select name="gender" value={form.gender} onChange={update}>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>Phone
          <input name="phone" value={form.phone} onChange={update} required placeholder="98XXXXXXXX" autoComplete="off" />
        </label>
        <label>Email
          <input type="email" name="email" value={form.email} onChange={update} required autoComplete="off" />
        </label>
        <label>Citizenship Number
          <input name="citizenshipNumber" value={form.citizenshipNumber} onChange={update}
            placeholder="27-01-70-01234" pattern="^\d{1,3}-\d{1,3}-\d{1,3}-\d{1,6}$"
            title="Format: XX-XX-XX-XXXXX (e.g. 27-01-70-01234)" required autoComplete="off" />
        </label>
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
              autoComplete="off" disabled={!form.district}
              placeholder={form.district ? 'Type municipality name' : 'Select district first'} />
          )}
        </label>
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
        <label>Citizenship Document (JPG/PNG/PDF, max 200KB)
          <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setCitizenshipDoc(e.target.files[0])} required />
        </label>
        <label>Passport-size Photo (JPG/PNG, max 200KB)
          <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setPhoto(e.target.files[0])} required />
        </label>

        <button type="submit" disabled={loading} className={loading ? 'btn-loading' : ''}>
          {loading ? <span className="spinner" /> : 'Submit Registration'}
        </button>
      </form>

      {status && !status.ok && (
        <div className="alert alert-error shake">{status.message}</div>
      )}
    </div>
  );
}
