
import { get, set, update, useStored, now, audit } from './store.js';
import { apiRequest } from './api.js';

export const ROLES = {
  user: 'End User',
  head: 'Society Head',
  admin: 'System Administrator',
};

export const HOME = {
  user: '/dashboard',
  head: '/society',
  admin: '/admin',
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function passwordProblem(pw) {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Use letters and at least one number.';
  }
  return '';
}


// ---------------------------------------------------------
// SESSION
// ---------------------------------------------------------

export const getSession = () => get('session', null);

export function useSession() {
  return useStored('session', null);
}

export function logout() {
  const session = getSession();

  if (session) {
    audit(session.name, 'Logged out', ROLES[session.role]);
  }

  localStorage.removeItem('teralyt_access_token');
  set('session', null);
}


// ---------------------------------------------------------
// LOGIN
// ---------------------------------------------------------

export async function login(email, password, role) {
  email = String(email || '').trim().toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return { ok: false, msg: 'Enter a valid email address.' };
  }

  if (!password) {
    return { ok: false, msg: 'Enter your password.' };
  }

  try {
    const result = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const user = result.user;

    if (role && user.role !== role) {
      return {
        ok: false,
        msg: `This account is registered as ${ROLES[user.role]}, not ${ROLES[role]}.`,
      };
    }

    if (!user.email_verified) {
      return {
        ok: false,
        msg: 'Please verify your email before logging in.',
      };
    }

    if (
      user.role === 'head' &&
      user.head_approval_status !== 'approved'
    ) {
      return {
        ok: false,
        msg: 'Your Society Head account is waiting for administrator approval.',
      };
    }

    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      head_approval_status: user.head_approval_status,
      since: now(),
    };

    localStorage.setItem(
      'teralyt_access_token',
      result.access_token
    );

    set('session', session);

    audit(user.name, 'Logged in', ROLES[user.role]);

    return {
      ok: true,
      session,
    };
  } catch (error) {
    return {
      ok: false,
      msg: error.message || 'Unable to log in. Please try again.',
    };
  }
}


// ---------------------------------------------------------
// SIGNUP
// ---------------------------------------------------------

export async function signup({
  name,
  email,
  password,
  role,
}) {
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();

  if (name.length < 2) {
    return {
      ok: false,
      field: 'name',
      msg: 'Enter your full name.',
    };
  }

  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      field: 'email',
      msg: 'Enter a valid email address.',
    };
  }

  const passwordError = passwordProblem(password || '');

  if (passwordError) {
    return {
      ok: false,
      field: 'password',
      msg: passwordError,
    };
  }

  if (!['user', 'head'].includes(role)) {
    return {
      ok: false,
      field: 'role',
      msg: 'Choose End User or Society Head.',
    };
  }

  try {
    const result = await apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        name,
        email,
        password,
        role,
      }),
    });

    return {
      ok: true,
      verificationRequired: true,
      email: result.email || email,
      role,
      msg: result.message || 'Verification code sent to your email.',
    };
  } catch (error) {
    return {
      ok: false,
      field: 'form',
      msg: error.message || 'Unable to create account.',
    };
  }
}


// ---------------------------------------------------------
// EMAIL OTP VERIFICATION
// ---------------------------------------------------------

export async function verifyEmail(email, otp) {
  email = String(email || '').trim().toLowerCase();
  otp = String(otp || '').trim();

  if (!EMAIL_RE.test(email)) {
    return {
      ok: false,
      msg: 'Enter a valid email address.',
    };
  }

  if (!/^\d{6}$/.test(otp)) {
    return {
      ok: false,
      msg: 'Enter the 6-digit verification code.',
    };
  }

  try {
    const result = await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({
        email,
        otp,
      }),
    });

    return {
      ok: true,
      email,
      role: result.role,
      head_approval_status: result.head_approval_status,
      msg: result.message || 'Email verified successfully.',
    };
  } catch (error) {
    return {
      ok: false,
      msg: error.message || 'Email verification failed.',
    };
  }
}


// ---------------------------------------------------------
// ACCOUNT MANAGEMENT
// These functions are kept for existing page imports.
// Account management must use protected backend admin
// endpoints before it is considered production-ready.
// ---------------------------------------------------------

export async function ensureAccounts() {
  // Do not create browser-only demo accounts.
  return get('users', []);
}

export async function addUser(
  by,
  { name, email, role, password }
) {
  name = String(name || '').trim();
  email = String(email || '').trim().toLowerCase();

  if (name.length < 2) {
    return { ok: false, msg: 'Enter the full name.' };
  }

  if (!EMAIL_RE.test(email)) {
    return { ok: false, msg: 'Enter a valid email address.' };
  }

  if (!ROLES[role]) {
    return { ok: false, msg: 'Choose a role.' };
  }

  const passwordError = passwordProblem(password || '');

  if (passwordError) {
    return {
      ok: false,
      msg: 'Temporary password: ' + passwordError,
    };
  }

  return {
    ok: false,
    msg: 'User creation must be performed through the backend administrator API.',
  };
}

export function setUser(by, id, changes, what) {
  update('users', [], users =>
    users.map(user =>
      user.id === id
        ? { ...user, ...changes }
        : user
    )
  );

  const user = get('users', []).find(x => x.id === id);

  audit(
    by,
    what,
    user
      ? `${user.name} (${user.email})`
      : String(id)
  );
}

export function removeUser(by, id) {
  const user = get('users', []).find(x => x.id === id);

  update('users', [], users =>
    users.filter(x => x.id !== id)
  );

  audit(
    by,
    'Removed user',
    user
      ? `${user.name} (${user.email})`
      : String(id)
  );
}
