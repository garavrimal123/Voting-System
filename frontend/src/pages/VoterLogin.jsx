import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function VoterLogin() {
  const [voterId, setVoterId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(sessionStorage.getItem('sessionExpiredMessage'));
  const { login } = useAuth();

  useEffect(() => {
    sessionStorage.removeItem('sessionExpiredMessage');
  }, []);
  const navigate = useNavigate();

  // Defeat browser autofill: some browsers ignore autoComplete="off" and
  // fill saved credentials in after mount anyway. Forcing a re-clear on
  // mount (after the browser's autofill pass) closes that gap.
  useEffect(() => {
    const t = setTimeout(() => { setVoterId(''); setPassword(''); }, 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post('/voters/login', { voterId, password });
      login(res.data.token, 'voter');
      if (res.data.mustChangePassword) navigate('/change-password');
      else navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    }
  }

  return (
    <div className="card narrow fade-in-up">
      <h2>Voter Login</h2>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <input type="text" name="fake-user" style={{ display: 'none' }} autoComplete="username" />
        <label>Voter ID
          <input value={voterId} onChange={(e) => setVoterId(e.target.value)}
            placeholder="NPV-2026-XXXXXX" required autoComplete="off" name="voter-id-field" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required autoComplete="new-password" name="voter-password-field" />
        </label>
        <button type="submit">Log In</button>
      </form>
      <Link to="/forgot-password" className="forgot-password-link">
        Forgot password?
      </Link>
      {error && <div className="alert alert-error shake">{error}</div>}
    </div>
  );
}
