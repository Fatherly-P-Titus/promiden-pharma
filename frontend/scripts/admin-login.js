/* Admin sign-in UI. Authentication must be implemented and enforced by the Express server. */
(() => {
  'use strict';
  const API_BASE = (window.PROMIDEN_API_BASE || '').replace(/\/$/, '');
  const form = document.getElementById('admin-login-form');
  if (!form) return;
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const toggle = document.getElementById('password-toggle');
  const message = document.getElementById('login-message');
  const submit = document.getElementById('login-submit');
  const submitLabel = submit.querySelector('.submit-label');
  const year = document.getElementById('current-year');
  if (year) year.textContent = String(new Date().getFullYear());

  function showMessage(text, kind = 'error') {
    message.textContent = text;
    message.className = `login-message ${kind}`;
    message.hidden = false;
  }
  function clearMessage() {
    message.textContent = '';
    message.className = 'login-message';
    message.hidden = true;
  }
  function setFieldError(input, errorId, text) {
    const error = document.getElementById(errorId);
    error.textContent = text;
    input.setAttribute('aria-invalid', text ? 'true' : 'false');
    if (text) input.setAttribute('aria-describedby', errorId);
    else input.removeAttribute('aria-describedby');
  }
  function validate() {
    const user = username.value.trim();
    const pass = password.value;
    setFieldError(username, 'username-error', user.length < 3 ? 'Enter a username with at least 3 characters.' : '');
    setFieldError(password, 'password-error', pass.length === 0 ? 'Enter your password.' : '');
    return user.length >= 3 && pass.length > 0;
  }
  [username, password].forEach(input => input.addEventListener('input', () => {
    clearMessage();
    if (input === username && username.value.trim().length >= 3) setFieldError(username, 'username-error', '');
    if (input === password && password.value.length > 0) setFieldError(password, 'password-error', '');
  }));
  toggle.addEventListener('click', () => {
    const reveal = password.type === 'password';
    password.type = reveal ? 'text' : 'password';
    toggle.textContent = reveal ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(reveal));
    password.focus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    if (!validate()) {
      const invalid = form.querySelector('[aria-invalid="true"]');
      if (invalid) invalid.focus();
      return;
    }
    submit.disabled = true;
    submitLabel.textContent = 'Signing in…';
    try {
      const response = await fetch(API_BASE + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.value.trim(), password: password.value })
      });
      let result = {};
      try { result = await response.json(); } catch (_) { /* Non-JSON response handled below. */ }
      if (response.ok && result && result.success === true) {
        window.location.assign('admin-page.html');
        return;
      }
      if (response.status === 404 || response.status === 405) {
        showMessage('The authentication service is not available yet. Connect the Express login endpoint before using this page.');
      } else if (response.status === 401 || response.status === 403) {
        showMessage('The username or password is incorrect, or this account is not authorised.');
      } else {
        showMessage(typeof result.message === 'string' && result.message.length < 220 ? result.message : 'Sign-in could not be completed. Please try again later.');
      }
    } catch (_) {
      showMessage('Could not reach the authentication server. Check your connection and try again.');
    } finally {
      submit.disabled = false;
      submitLabel.textContent = 'Sign in securely';
    }
  });
})();
