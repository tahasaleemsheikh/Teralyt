
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useTitle } from '../components/ui.jsx';
import { AuthFrame } from './Login.jsx';
import { BASE } from '../lib/data.js';
import {
  signup,
  verifyEmail,
  passwordProblem,
} from '../lib/auth.js';

export default function Signup() {
  useTitle('Sign up');

  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    role: 'user',
    agree: false,
  });

  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const [verificationEmail, setVerificationEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState('user');

  const change = key => e => {
    const value = e.target.type === 'checkbox'
      ? e.target.checked
      : e.target.value;

    setForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const strength = form.password
    ? (
        passwordProblem(form.password)
          ? 'weak'
          : form.password.length >= 12 &&
            /[^A-Za-z0-9]/.test(form.password)
            ? 'strong'
            : 'good'
      )
    : '';

  const submitSignup = async e => {
    e.preventDefault();

    const nextErrors = {};

    if (form.password !== form.confirm) {
      nextErrors.confirm = 'The two passwords do not match.';
    }

    if (!form.agree) {
      nextErrors.agree =
        'Please accept the terms about forecasts and plot status.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) {
      return;
    }

    setBusy(true);

    const result = await signup(form);

    setBusy(false);

    if (!result.ok) {
      setErrors({
        [result.field || 'form']: result.msg,
      });
      return;
    }

    setVerificationEmail(result.email);
    setVerificationMessage(
      'A verification code has been sent to your email.'
    );
  };

  const submitVerification = async e => {
    e.preventDefault();
    setVerificationMessage('');

    setVerificationBusy(true);

    const result = await verifyEmail(
      verificationEmail,
      otp
    );

    setVerificationBusy(false);

    if (!result.ok) {
      setVerificationMessage(result.msg);
      return;
    }

    setVerified(true);
    setVerifiedRole(result.role || form.role);
  };

  const ErrorText = ({ field }) => (
    errors[field]
      ? <p className="ferr">{errors[field]}</p>
      : null
  );

  if (verified) {
    const isHead = verifiedRole === 'head';

    return (
      <AuthFrame
        title="Email verified."
        text="Your Terralyt account is almost ready."
      >
        <img
          className="full"
          src={BASE + 'logo-full.png'}
          alt="Terralyt"
        />

        <h1 style={{ textAlign: 'center' }}>
          Email verified
        </h1>

        <div className="note">
          Your email address has been verified successfully.
          {isHead
            ? ' Your Society Head account is waiting for administrator approval.'
            : ' You can now log in to your account.'}
        </div>

        <Link
          className="btn"
          style={{ width: '100%' }}
          to={`/login?role=${verifiedRole}&verified=1`}
        >
          Go to log in
        </Link>
      </AuthFrame>
    );
  }

  if (verificationEmail) {
    return (
      <AuthFrame
        title="Check your email."
        text="Enter the verification code to activate your account."
      >
        <img
          className="full"
          src={BASE + 'logo-full.png'}
          alt="Terralyt"
        />

        <h1 style={{ textAlign: 'center' }}>
          Verify your email
        </h1>

        <p className="mut" style={{ textAlign: 'center' }}>
          We sent a 6-digit code to:
          <br />
          <b>{verificationEmail}</b>
        </p>

        <form onSubmit={submitVerification} noValidate>
          <label htmlFor="otp">Verification code</label>

          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={e =>
              setOtp(
                e.target.value.replace(/\D/g, '').slice(0, 6)
              )
            }
          />

          {verificationMessage && (
            <p className="ferr" role="alert">
              {verificationMessage}
            </p>
          )}

          <button
            className="btn"
            style={{ width: '100%' }}
            disabled={verificationBusy}
          >
            {verificationBusy
              ? 'Verifying...'
              : 'Verify email'}
          </button>
        </form>

        <div className="note">
          The code expires in 10 minutes.
          If it expires, you will need a new verification code.
        </div>

        <p className="mut" style={{ textAlign: 'center' }}>
          <Link to="/login">Back to log in</Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Create your account in a minute."
      text="Buyers, investors and Society Heads welcome."
    >
      <img
        className="full"
        src={BASE + 'logo-full.png'}
        alt="Terralyt"
      />

      <h1 style={{ textAlign: 'center' }}>Get started</h1>

      <p className="mut" style={{ textAlign: 'center' }}>
        Free for the FDA City pilot.
      </p>

      <form onSubmit={submitSignup} noValidate>
        <label htmlFor="nm">Full name</label>
        <input
          id="nm"
          autoComplete="name"
          value={form.name}
          onChange={change('name')}
        />
        <ErrorText field="name" />

        <label htmlFor="em">Email</label>
        <input
          id="em"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={change('email')}
        />
        <ErrorText field="email" />

        <label htmlFor="pw">Password</label>
        <input
          id="pw"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={change('password')}
        />

        {strength && (
          <p className={'pws ' + strength}>
            Password strength: {strength}
            {strength === 'weak'
              ? ` (${passwordProblem(form.password)})`
              : ''}
          </p>
        )}
        <ErrorText field="password" />

        <label htmlFor="pw2">Confirm password</label>
        <input
          id="pw2"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={change('confirm')}
        />
        <ErrorText field="confirm" />

        <label htmlFor="rl">I am a</label>
        <select
          id="rl"
          value={form.role}
          onChange={change('role')}
        >
          <option value="user">
            End User (buyer / investor)
          </option>
          <option value="head">
            Society Head (needs approval)
          </option>
        </select>
        <ErrorText field="role" />

        <label className="chk">
          <input
            type="checkbox"
            checked={form.agree}
            onChange={change('agree')}
          />
          I understand that forecasts are model estimates,
          not guarantees, and plot status comes from
          society records.
        </label>
        <ErrorText field="agree" />
        <ErrorText field="form" />

        <button
          className="btn"
          style={{ width: '100%' }}
          disabled={busy}
        >
          {busy ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="mut" style={{ textAlign: 'center' }}>
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </AuthFrame>
  );
}
