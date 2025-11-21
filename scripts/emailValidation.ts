/* Email Validation Module */

import { setAriaInvalid } from '../utils.js';

const isValidEmail = (value: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).toLowerCase());
};

export function initializeEmailValidation(): void {
  const form = document.getElementById('waitlist-form') as HTMLFormElement | null;
  const emailInput = document.getElementById('email') as HTMLInputElement | null;
  const joinBtn = document.getElementById('joinBtn') as HTMLButtonElement | null;
  const emailHelp = document.getElementById('emailHelp') as HTMLElement | null;
  const successState = document.getElementById('successState') as HTMLElement | null;

  if (!form || !emailInput || !joinBtn) return;

  // Check if previously joined
  try {
    const joined = JSON.parse(localStorage.getItem('waitlistJoined') || 'null');
    if (joined && joined.email && successState) {
      form.classList.add('hidden');
      successState.classList.remove('hidden');
    }
  } catch (_) { /* ignore */ }

  const setError = (text: string) => {
    if (emailHelp) {
      emailHelp.textContent = text;
      emailHelp.style.color = '#b42318';
    }
  };

  const clearMsg = () => {
    if (emailHelp) {
      emailHelp.textContent = 'No spam — just a friendly launch note.';
      emailHelp.style.color = '';
    }
  };

  // Real-time email validation with border colors and button state
  emailInput.addEventListener('input', () => {
    const value = emailInput.value.trim();
    if (value.length === 0) {
      emailInput.classList.remove('valid', 'invalid');
      joinBtn.disabled = true;
      setAriaInvalid(emailInput, false);
      clearMsg();
    } else if (isValidEmail(value)) {
      emailInput.classList.add('valid');
      emailInput.classList.remove('invalid');
      joinBtn.disabled = false;
      setAriaInvalid(emailInput, false);
      clearMsg();
    } else {
      emailInput.classList.add('invalid');
      emailInput.classList.remove('valid');
      joinBtn.disabled = true;
      setAriaInvalid(emailInput, true);
    }
  });

  // Clear message on focus
  emailInput.addEventListener('focus', () => {
    clearMsg();
  });

  // Form submission
  form.addEventListener('submit', async (e: Event) => {
    e.preventDefault();
    clearMsg();

    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      emailInput.classList.add('invalid');
      emailInput.classList.remove('valid');
      setError('Please enter a valid email address.');
      emailInput.focus();
      return;
    }

    emailInput.classList.remove('invalid', 'valid');
    emailInput.disabled = true;
    joinBtn.disabled = true;
    joinBtn.classList.add('submitting');
    joinBtn.textContent = 'Joining…';

    // Simulate async submit; replace with backend call
    await new Promise((r) => setTimeout(r, 900));

    try {
      localStorage.setItem('waitlistJoined', JSON.stringify({ email, at: Date.now() }));
    } catch (_) { /* ignore storage errors */ }

    form.classList.add('hidden');
    if (successState) {
      successState.classList.remove('hidden');
    }
  });

  // Initial state: button disabled until valid email
  joinBtn.disabled = true;
}
