import { useEffect, useState } from 'react';
import { adToBs } from '@sbmdkl/nepali-date-converter';

const AD_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BS_MONTHS = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];

function formatBS(now) {
  try {
    const iso = now.toISOString().split('T')[0];
    const bs = adToBs(iso); // returns { year, month, day } style or 'YYYY-MM-DD' depending on version
    if (typeof bs === 'string') {
      const [y, m, d] = bs.split('-').map(Number);
      return `${d} ${BS_MONTHS[m - 1] || m} ${y} BS`;
    }
    if (bs && bs.year) {
      return `${bs.day} ${BS_MONTHS[bs.month - 1] || bs.month} ${bs.year} BS`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function NepaliFlagClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const adDate = `${now.getDate()} ${AD_MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const bsDate = formatBS(now);

  return (
    <div className="flag-clock">
      <svg viewBox="0 0 60 70" width="30" height="35" className="waving-flag">
        <g>
          <path d="M2 2 L45 20 L2 34 Z" fill="#dc143c" stroke="#003893" strokeWidth="2" strokeLinejoin="round" />
          <path d="M2 34 L38 50 L2 66 Z" fill="#dc143c" stroke="#003893" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="18" cy="16" r="3" fill="#003893" />
          <path d="M22 44 l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0 z" fill="#003893" />
          <line x1="0" y1="0" x2="0" y2="68" stroke="#003893" strokeWidth="3" />
        </g>
      </svg>
      <div className="flag-clock-text">
        <div className="ad-line">{adDate} · {time}</div>
        {bsDate && <div className="bs-line">{bsDate}</div>}
      </div>
    </div>
  );
}
