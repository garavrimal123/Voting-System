import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: request OTP, 2: enter OTP + new password
  const [voterId, setVoterId] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await api.post('/voters/forgot-password', { voterId });
      setMessage({ ok: true, text: res.data.message });
      setStep(2);
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Something went wrong.' });
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await api.post('/voters/reset-password', { voterId, otp, newPassword });
      setMessage({ ok: true, text: res.data.message + ' Redirecting to login…' });
      setTimeout(() => { window.location.href = '/login'; }, 1800);
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'Reset failed.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card narrow fade-in-up">
      <h2>Forgot Password</h2>

      {step === 1 && (
        <>
          <p className="muted">Enter your Voter ID — we'll email a reset code to the address on file.</p>
          <form onSubmit={requestOtp} className="form-grid" autoComplete="off">
            <label>Voter ID
              <input value={voterId} onChange={(e) => setVoterId(e.target.value)}
                placeholder="NPV-2026-XXXXXX" required autoComplete="off" />
            </label>
            <button type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Send Reset Code'}
            </button>
          </form>
        </>
      )}

      {step === 2 && (
        <>
          <p className="muted">Enter the 6-digit code sent to your email, and choose a new password.</p>
          <form onSubmit={submitReset} className="form-grid" autoComplete="off">
            <label>Reset Code
              <input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} required autoComplete="off" />
            </label>
            <label>New Password
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required autoComplete="new-password" />
            </label>
            <p className="muted" style={{ margin: 0 }}>8+ characters, with upper, lower, a digit, and a symbol.</p>
            <button type="submit" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Reset Password'}
            </button>
          </form>
          <button className="btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setStep(1)}>
            ← Use a different Voter ID
          </button>
        </>
      )}

      {message && (
        <div className={`alert ${message.ok ? 'alert-success' : 'alert-error shake'}`}>{message.text}</div>
      )}

      <Link to="/login" className="muted" style={{ display: 'inline-block', marginTop: '1rem' }}>← Back to Login</Link>
    </div>
  );
}
