'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import PushNotificationForm from '@/components/notifications/PushNotificationForm';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';
import { toApiError } from '@/lib/apiError';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function NewCustomNotificationPage() {
  const router = useRouter();
  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || '';

  const [menuToggled, setMenuToggled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notificationImage, setNotificationImage] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    brief: '',
    message: '',
    priority: 'medium',
    scheduleType: '',
    scheduledFor: '',
    scheduledAt: '',
  });

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

  const apiFetch = useCallback(async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    headers.set('authorization', `Bearer ${token}`);
    if (options.body !== undefined && !headers.has('Content-Type') && !(typeof FormData !== 'undefined' && options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(path, { ...options, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw toApiError(payload, response, 'Request failed.');
    return payload;
  }, [token]);

  const uploadNotificationImage = useCallback(async (uuid, file) => {
    if (!uuid || !file) return;
    const body = new FormData();
    body.append('file', file);
    await apiFetch(`/api/push-notifications/${uuid}/images`, { method: 'POST', body });
  }, [apiFetch]);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'scheduleType') {
        if (value === 'recurring') next.scheduledAt = '';
        if (value === 'fixed') next.scheduledFor = '';
        if (!value) {
          next.scheduledFor = '';
          next.scheduledAt = '';
        }
      }
      if (name === 'scheduledFor' && value) next.scheduledAt = '';
      if (name === 'scheduledAt' && value) next.scheduledFor = '';
      return next;
    });
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (!formData.title.trim() || !formData.brief.trim() || !formData.message.trim()) {
      setError('Title, brief and message are required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: formData.title.trim(),
        brief: formData.brief.trim(),
        message: formData.message.trim(),
        priority: formData.priority,
      };
      if (formData.scheduleType === 'recurring' && formData.scheduledFor) payload.scheduledFor = formData.scheduledFor;
      if (formData.scheduleType === 'fixed' && formData.scheduledAt) payload.scheduledAt = new Date(formData.scheduledAt).toISOString();

      const created = await apiFetch('/api/push-notifications', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (notificationImage) {
        await uploadNotificationImage(created?.uuid, notificationImage);
      }
      router.push('/notifications/custom');
    } catch (err) {
      setFieldErrors(err?.fieldErrors || {});
      setError(err.message || 'Failed to create custom notification.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <div className="screen-center">Loading notifications...</div>;
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
              <PushNotificationForm
                title="Create Notification"
                backHref="/notifications/custom"
                submitLabel="Create Notification"
                submitting={submitting}
                error={error}
                success=""
                fieldErrors={fieldErrors}
                formData={formData}
                onChange={onChange}
                onSubmit={onSubmit}
                imageFile={notificationImage}
                onImageChange={(event) => setNotificationImage(event.target.files?.[0] || null)}
                existingImageUrl=""
              />
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
