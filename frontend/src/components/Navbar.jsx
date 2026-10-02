import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import NepaliFlagClock from './NepaliFlagClock';

export default function Navbar() {
  const { role, logout } = useAuth();
  const { t, lang, toggleLang } = useLanguage();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <>
      <div className="topbar">
        <NepaliFlagClock />
        <button className="lang-toggle" onClick={toggleLang} title="Switch language / भाषा बदल्नुहोस्">
          {lang === 'en' ? 'नेपाली' : 'English'}
        </button>
      </div>
      <nav className="navbar">
        <Link to="/" className="brand">
          <svg viewBox="0 0 64 64" className="brand-icon" aria-hidden="true">
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#dc143c" />
                <stop offset="100%" stopColor="#003893" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="30" fill="url(#brandGrad)" />
            <path d="M18 33 L27 42 L46 21" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('brand')}
        </Link>
        <div className="nav-links">
          <Link to="/public-results">{t('nav_results')}</Link>
          {!role && <>
            <Link to="/register">{t('nav_register')}</Link>
            <Link to="/track">{t('nav_track')}</Link>
            <Link to="/login">{t('nav_voter_login')}</Link>
            <Link to="/admin/login">{t('nav_admin')}</Link>
          </>}
          {role === 'voter' && <>
            <Link to="/dashboard">{t('nav_dashboard')}</Link>
            <Link to="/profile">{t('nav_update_details')}</Link>
            <button onClick={handleLogout}>{t('nav_logout')}</button>
          </>}
          {role === 'admin' && <>
            <Link to="/admin/dashboard">{t('nav_registrations')}</Link>
            <Link to="/admin/elections">{t('nav_elections')}</Link>
            <Link to="/admin/update-requests">{t('nav_update_requests')}</Link>
            <Link to="/admin/audit-log">{t('nav_audit_log')}</Link>
            <button onClick={handleLogout}>{t('nav_logout')}</button>
          </>}
        </div>
      </nav>
    </>
  );
}
