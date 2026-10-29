/* Deployment setting: replace the empty string with the Render API base URL when frontend
   and backend are deployed separately, e.g. https://promiden-api.onrender.com. No secret keys here. */
window.PROMIDEN_API_BASE = window.PROMIDEN_API_BASE || '';
