'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getStoredAuth, isAuthValid, normalizeAuthResponse, saveAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth && isAuthValid(auth)) {
      router.replace('/dashboard');
    }
  }, [router]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    const trimmedEmail = String(email || '').trim();

    if (!trimmedEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emailAddress: trimmedEmail,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.errors?.error || 'Login failed. Please check your credentials and try again.');
        return;
      }

      const normalizedAuth = normalizeAuthResponse(payload);
      saveAuth(normalizedAuth);
      router.replace('/dashboard');
    } catch {
      setError('Unable to connect to the authentication service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-aside-left" style={{ backgroundImage: 'url(/admin-assets/images/login-bg.jpg)' }}>
        <Link href="/login" className="login-logo">
          <img src="/admin-assets/images/logo-w.png" alt="Camion" />
        </Link>

        <div className="login-description">
          <h2 className="text-white mb-4">CAMION</h2>
          <p className="fs-12">
            CAMION is a technology-powered online shopping platform that helps you discover, compare, and order products from worldwide, all in one seamless mobile experience. CAMION gives you access to a broader global marketplace with transparent information and smart tools.
          </p>
          <ul className="social-icons mt-4">
            <li>
              <Link href="#">
                <i className="fa fa-facebook" />
              </Link>
            </li>
            <li>
              <Link href="#">
                <i className="fa fa-twitter" />
              </Link>
            </li>
            <li>
              <Link href="#">
                <i className="fa fa-linkedin" />
              </Link>
            </li>
          </ul>
          <div className="mt-5">
            {/* <Link href="#" className="text-white mr-4">
              Privacy Policy
            </Link>
            <Link href="#" className="text-white mr-4">
              Contact
            </Link> */}
            <Link href="#" className="text-white">
              © {currentYear} Camion
            </Link>
          </div>
        </div>
      </div>

      <div className="login-aside-right">
        <div className="row m-0 justify-content-center h-100 align-items-center">
          <div className="col-xl-6 col-xxl-8">
            <div className="authincation-content">
              <div className="row no-gutters">
                <div className="col-xl-12">
                  <div className="auth-form">
                    <div className="mb-3">
                      <h2 className="text-primary">Welcome to Camion</h2>
                    </div>
                    <h4 className="mb-4">Sign in by entering information below</h4>

                    {error ? <div className="text-danger">{error}</div> : null}

                    <form onSubmit={onSubmit}>
                      <div className="form-group">
                        <label className="mb-2">
                          <strong>Email</strong>
                        </label>
                        <input
                          type="email"
                          className="form-control"
                          name="email"
                          value={email}
                          placeholder='Enter Email'
                          autoComplete="email"
                          required
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>

                      <div className="form-group">
                        <label className="mb-2">
                          <strong>Password</strong>
                        </label>
                        <input
                          type="password"
                          className="form-control"
                          name="password"
                          value={password}
                          placeholder='Enter Password'
                          autoComplete="current-password"
                          required
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      <div className="text-center">
                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                          {loading ? 'Signing In...' : 'Sign In'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
