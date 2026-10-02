import api from '../api/axios';

// Admin CSV exports are behind JWT auth, so a plain <a href> won't carry the
// Authorization header — the browser would just hit a 401 page. Fetch it
// through axios (which does attach the token) as a blob, then trigger the
// save via a throwaway object URL.
export async function downloadCsv(url, filename) {
  const res = await api.get(url, { responseType: 'blob' });
  const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}
