import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(sessionStorage.getItem('sessionExpiredMessage'));
  const { login } = useAuth();

  useEffect(() => {
    sessionStorage.removeItem('sessionExpiredMessage');
  }, []);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => { setUsername(''); setPassword(''); }, 50);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.post('/admin/login', { username, password });
      login(res.data.token, 'admin');
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    }
  }

  return (
    <div className="card narrow fade-in-up">
      <h2>Admin Login</h2>
      <form onSubmit={handleSubmit} className="form-grid" autoComplete="off">
        <input type="text" style={{ display: 'none' }} autoComplete="username" />
        <label>Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" name="admin-user-field" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" name="admin-pass-field" />
        </label>
        <button type="submit">Log In</button>
      </form>
      {error && <div className="alert alert-error shake">{error}</div>}
    </div>
  );
}
