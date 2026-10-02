import { useEffect, useState } from 'react';

export default function Countdown({ startTime, endTime, status }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (status !== 'open') return <span className="badge badge-gray">Voting not open</span>;

  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();

  if (now < start) return <span className="badge badge-gray">Opens in {formatDiff(start - now)}</span>;
  if (now > end) return <span className="badge badge-red">Voting closed</span>;
  return <span className="badge badge-green">Closes in {formatDiff(end - now)}</span>;
}

function formatDiff(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m}m ${s}s`;
}
