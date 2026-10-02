import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

export default function Home() {
  const { t } = useLanguage();

  return (
    <div>
      <section className="hero">
        <div className="hero-badge">
          <svg viewBox="0 0 100 100" width="70" height="70">
            <circle cx="50" cy="50" r="48" fill="#0f2740" />
            <rect x="30" y="40" width="40" height="30" rx="3" fill="#dc143c" />
            <rect x="35" y="30" width="30" height="12" rx="2" fill="#fff" />
            <rect x="46" y="20" width="8" height="24" fill="#fff" />
          </svg>
        </div>
        <h1>{t('home_title')}</h1>
        <p className="hero-sub">{t('home_subtitle')}</p>
        <div className="hero-actions">
          <Link to="/register" className="btn">{t('home_register_cta')}</Link>
          <Link to="/login" className="btn btn-secondary">{t('home_login_cta')}</Link>
        </div>
      </section>

      <section className="stats-row">
        <div className="stat-card">
          <div className="stat-num">7</div>
          <div className="stat-label">{t('stat_provinces')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">77</div>
          <div className="stat-label">{t('stat_districts')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">753</div>
          <div className="stat-label">{t('stat_local_levels')}</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">18+</div>
          <div className="stat-label">{t('stat_voting_age')}</div>
        </div>
      </section>

      <section className="card">
        <h2>{t('how_it_works')}</h2>
        <div className="steps-grid">
          <div className="step">
            <div className="step-num">1</div>
            <h3>{t('step1_title')}</h3>
            <p className="muted">{t('step1_desc')}</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <h3>{t('step2_title')}</h3>
            <p className="muted">{t('step2_desc')}</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <h3>{t('step3_title')}</h3>
            <p className="muted">{t('step3_desc')}</p>
          </div>
          <div className="step">
            <div className="step-num">4</div>
            <h3>{t('step4_title')}</h3>
            <p className="muted">{t('step4_desc')}</p>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>{t('positions_title')}</h2>
        <table className="table">
          <thead>
            <tr><th>Position</th><th>Level</th><th>Term</th></tr>
          </thead>
          <tbody>
            <tr><td>{t('position_mayor')}</td><td>{t('position_level_municipality')}</td><td>{t('position_term')}</td></tr>
            <tr><td>{t('position_deputy_mayor')}</td><td>{t('position_level_municipality')}</td><td>{t('position_term')}</td></tr>
            <tr><td>{t('position_ward_chair')}</td><td>{t('position_level_ward')}</td><td>{t('position_term')}</td></tr>
            <tr><td>{t('position_ward_member')}</td><td>{t('position_level_ward')}</td><td>{t('position_term')}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>{t('about_title')}</h2>
        <p>{t('about_body')}</p>
        <div className="province-grid">
          {['Koshi', 'Madhesh', 'Bagmati', 'Gandaki', 'Lumbini', 'Karnali', 'Sudurpaschim'].map((p, i) => (
            <div key={p} className="province-chip" style={{ animationDelay: `${i * 0.06}s` }}>{p}</div>
          ))}
        </div>
      </section>

      <section className="card privacy-note">
        <h2>{t('privacy_title')}</h2>
        <ul>
          <li>{t('privacy_1')}</li>
          <li>{t('privacy_2')}</li>
          <li>{t('privacy_3')}</li>
        </ul>
      </section>
    </div>
  );
}
