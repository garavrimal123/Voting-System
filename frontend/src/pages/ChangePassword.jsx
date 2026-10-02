import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await api.post('/voters/change-password', { newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not change password.');
    }
  }

  return (
    <div className="card narrow fade-in-up">
      <h2>Set a New Password</h2>
      <p className="muted">Must be 8+ characters with upper, lower, a digit, and a symbol.</p>
      <form onSubmit={handleSubmit} className="form-grid">
        <label>New Password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <label>Confirm Password
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </label>
        <button type="submit">Update Password</button>
      </form>
      {error && <div className="alert alert-error">{error}</div>}
      {done && <div className="alert alert-success">Password updated. Redirecting to login…</div>}
    </div>
  );
}
