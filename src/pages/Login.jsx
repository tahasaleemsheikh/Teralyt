
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Logo, useTitle } from '../components/ui.jsx';
import { BASE } from '../lib/data.js';
import {
  login,
  logout,
  useSession,
  HOME,
  ROLES,
  EMAIL_RE,
} from '../lib/auth.js';

export function AuthFrame({ title, text, children }) {
  return (
    <div className="auth2">
      <div className="aimg">
        <Link className="brand" to="/" style={{ padding: 0 }}>
          <Logo />
          Terralyt
        </Link>

        <div>
          <h2>{title}</h2>
          <p style={{ color: '#cdbd9f' }}>{text}</p>
        </div>
      </div>

      <div className="af">
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function Login() {
  useTitle('Log in');

  const [q] = useSearchParams();
  const nav = useNavigate();
  const session = useSession();

  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [role, setRole] = useState(
    q.get('role') && ROLES[q.get('role')]
      ? q.get('role')
      : 'user'
  );

  const [msg, setMsg] = useState(
    q.get('verified') === '1'
      ? 'Email verified successfully. You can now log in.'
      : ''
  );

  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [forgot, setForgot] = useState(false);

  const next = q.get('next');

  const submit = async e => {
    e.preventDefault();
    setMsg('');

    if (!EMAIL_RE.test(email.trim())) {
      setMsg('Enter a valid email address.');
      return;
    }

    if (!pw) {
      setMsg('Enter your password.');
      return;
    }

    setBusy(true);

    const result = await login(email, pw, role);

    setBusy(false);

    if (!result.ok) {
      setMsg(result.msg);
      return;
    }

    nav(
      next && next.startsWith('/')
        ? next
        : HOME[result.session.role],
      { replace: true }
    );
  };

  return (
    <AuthFrame
      title="Satellite evidence, not guesswork."
      text="Evaluate FDA City from anywhere."
    >
      <img
        className="full"
        src={BASE + 'logo-full.png'}
        alt="Terralyt"
      />

      {session && (
        <div className="note">
          You are logged in as <b>{session.name}</b>
          {' '}({ROLES[session.role]}).
          {' '}
          <Link to={HOME[session.role]}>Continue</Link>
          {' · '}
          <a
            href="#/login"
            onClick={e => {
              e.preventDefault();
              logout();
              nav('/login', { replace: true });
            }}
          >
            Log out
          </a>
        </div>
      )}

      <h1 style={{ textAlign: 'center' }}>Welcome back</h1>

      <p className="mut" style={{ textAlign: 'center' }}>
        Log in to your account.
      </p>

      <form onSubmit={submit} noValidate>
        <label htmlFor="em">Email</label>
        <input
          id="em"
          type="email"
          autoComplete="username"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <label htmlFor="pw">Password</label>

        <div className="pwrow">
          <input
            id="pw"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={pw}
            onChange={e => setPw(e.target.value)}
          />

          <button
            type="button"
            className="pweye"
            onClick={() => setShow(x => !x)}
          >
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        <label htmlFor="rl">Role</label>
        <select
          id="rl"
          value={role}
          onChange={e => setRole(e.target.value)}
        >
          {Object.entries(ROLES).map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>

        {msg && (
          <p className="ferr" role="alert">
            {msg}
          </p>
        )}

        <button
          className="btn"
          style={{ width: '100%' }}
          disabled={busy}
        >
          {busy ? 'Checking...' : 'Log in'}
        </button>
      </form>

      <p className="mut" style={{ textAlign: 'center' }}>
        <a
          href="#/login"
          onClick={e => {
            e.preventDefault();
            setForgot(x => !x);
          }}
        >
          Forgot password?
        </a>
        {' · '}
        <Link to="/signup">Create account</Link>
      </p>

      {forgot && (
        <div className="note">
          Password reset is not available yet.
          Please contact the System Administrator.
        </div>
      )}

      <div className="note">
        Email verification is required before login.
        Five incorrect passwords lock an account for five minutes.
      </div>
    </AuthFrame>
  );
}
