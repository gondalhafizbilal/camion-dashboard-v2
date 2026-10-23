'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import ExportRequestForm from '@/components/export-requests/ExportRequestForm';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

function flattenCategories(categories, depth = 0) {
  if (!Array.isArray(categories)) return [];
  const rows = [];
  categories.forEach((category) => {
    rows.push({ ...category, depth });
    if (Array.isArray(category.children) && category.children.length > 0) {
      rows.push(...flattenCategories(category.children, depth + 1));
    }
  });
  return rows;
}

function normalizeErrors(payload) {
  const backendErrors = payload?.errors || {};
  return {
    name: backendErrors?.name || '',
    format: backendErrors?.format || '',
    pagesCount: backendErrors?.pagesCount || '',
    categoryUUID: backendErrors?.categoryUUID || '',
    type: backendErrors?.type || '',
    error: backendErrors?.error || backendErrors?.type || payload?.message || '',
  };
}

export default function ExportRequestCreatePage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    format: '',
    pagesCount: '20',
    categoryUUID: '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);

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
        const mergedMessage = Array.isArray(payload?.message) ? payload.message.join('; ') : payload?.message;
        const backendError = payload?.errors?.error || mergedMessage || payload?.error || 'Request failed.';
        throw Object.assign(new Error(backendError), { payload });
      }

      return payload;
    },
    [token]
  );

  const loadCategories = useCallback(async () => {
    if (!token) return;
    setCategoryLoading(true);
    try {
      const data = await apiFetch('/api/categories?itemsPerPage=100&pageNumber=1', { method: 'GET' });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrors((prev) => ({ ...prev, error: err.message || 'Failed to load categories.' }));
    } finally {
      setCategoryLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    if (!String(formData.format || '').startsWith('products-') && formData.categoryUUID) {
      setFormData((prev) => ({ ...prev, categoryUUID: '' }));
    }
  }, [formData.categoryUUID, formData.format]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        name: String(formData.name || '').trim(),
        format: String(formData.format || '').trim(),
        pagesCount: Number(formData.pagesCount || 0),
      };
      if (String(formData.format || '').startsWith('products-') && formData.categoryUUID) {
        payload.categoryUUID = formData.categoryUUID;
      }

      const created = await apiFetch('/api/export-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(created?.uuid ? `/export-requests/${created.uuid}` : '/export-requests');
    } catch (err) {
      setErrors(normalizeErrors(err.payload || {}));
    } finally {
      setSaving(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading export requests...</div>;
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
                  <h4 className="card-title mb-0">Create Export Request</h4>
                  <Link href="/export-requests" className="btn btn-outline-primary btn-sm">
                    Back to List
                  </Link>
                </div>
                <div className="card-body">
                  <ExportRequestForm
                    mode="create"
                    formData={formData}
                    setFormData={setFormData}
                    errors={errors}
                    categories={categoryOptions}
                    categoryLoading={categoryLoading}
                    saving={saving}
                    onSubmit={onSubmit}
                    onCancel={() => router.push('/export-requests')}
                  />
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
