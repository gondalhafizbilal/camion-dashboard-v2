'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

const TYPE_OPTIONS = ['integer', 'decimal', 'string', 'boolean'];

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  return String(value) === 'true';
}

function buildPayload(formData) {
  return {
    name: formData.name.trim(),
    type: formData.type,
    integerValue: formData.type === 'integer' ? toNumber(formData.integerValue, 0) : 0,
    decimalValue: formData.type === 'decimal' ? toNumber(formData.decimalValue, 0) : 0,
    stringValue: formData.type === 'string' ? formData.stringValue || '' : '',
    booleanValue: formData.type === 'boolean' ? toBoolean(formData.booleanValue) : false,
    sensitive: Boolean(formData.sensitive),
  };
}

export default function CreateKeyValuePairPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    type: 'integer',
    integerValue: '0',
    decimalValue: '0',
    stringValue: '',
    booleanValue: 'false',
    sensitive: false,
  });

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  useEffect(() => {
    if (!isValid) {
      clearAuth();
      router.replace('/login');
      return;
    }

    const body = document.body;
    body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');

    const onResize = () => {
      body.setAttribute('data-sidebar-style', window.innerWidth <= 768 ? 'overlay' : 'full');
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isValid, router]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set('authorization', `Bearer ${token}`);

      if (options.body !== undefined && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const backendError = payload?.errors?.error || payload?.message || 'Request failed.';
        throw new Error(backendError);
      }

      return payload;
    },
    [token]
  );

  const onChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSubmitting(true);

    try {
      await apiFetch('/api/key-value-pairs', {
        method: 'POST',
        body: JSON.stringify(buildPayload(formData)),
      });

      router.push('/key-value-pairs');
    } catch (err) {
      setError(err.message || 'Failed to create key value pair.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading form...</div>;
  }

  return (
    <div id="main-wrapper" className={`show${menuToggled ? ' menu-toggle' : ''}`}>
      <NavHeader toggled={menuToggled} onToggle={() => setMenuToggled((prev) => !prev)} />
      <Sidebar />
      <Topbar name={fullName} role={role} />

      <div className="content-body" style={{ minHeight: '100vh' }}>
        <div className="container-fluid">
          <div className="row">
            <div className="col-xl-12">
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h4 className="card-title mb-0">Create Key Value Pair</h4>
                  <Link href="/key-value-pairs" className="btn btn-outline-primary btn-sm">
                    Back to List
                  </Link>
                </div>
                <div className="card-body">
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <form onSubmit={onSubmit}>
                    <div className="row">
                      <div className="col-md-6 mb-3">
                        <label className="form-label">Name</label>
                        <input className="form-control" name="name" value={formData.name} onChange={onChange} required />
                      </div>

                      <div className="col-md-6 mb-3">
                        <label className="form-label">Type</label>
                        <select className="form-control" name="type" value={formData.type} onChange={onChange}>
                          {TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>

                      {formData.type === 'integer' ? (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Integer Value</label>
                          <input
                            className="form-control"
                            type="number"
                            name="integerValue"
                            value={formData.integerValue}
                            onChange={onChange}
                            required
                          />
                        </div>
                      ) : null}

                      {formData.type === 'decimal' ? (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Decimal Value</label>
                          <input
                            className="form-control"
                            type="number"
                            step="any"
                            name="decimalValue"
                            value={formData.decimalValue}
                            onChange={onChange}
                            required
                          />
                        </div>
                      ) : null}

                      {formData.type === 'string' ? (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">String Value</label>
                          <input className="form-control" name="stringValue" value={formData.stringValue} onChange={onChange} required />
                        </div>
                      ) : null}

                      {formData.type === 'boolean' ? (
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Boolean Value</label>
                          <select className="form-control" name="booleanValue" value={formData.booleanValue} onChange={onChange}>
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </select>
                        </div>
                      ) : null}

                      <div className="col-md-6 mb-3 d-flex align-items-end">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="keyValuePairSensitive"
                            name="sensitive"
                            checked={formData.sensitive}
                            onChange={onChange}
                          />
                          <label className="form-check-label" htmlFor="keyValuePairSensitive">
                            Sensitive
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex" style={{ gap: '8px' }}>
                      <button className="btn btn-primary" type="submit" disabled={submitting}>
                        {submitting ? 'Creating...' : 'Create'}
                      </button>
                      <Link href="/key-value-pairs" className="btn btn-light">
                        Cancel
                      </Link>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
