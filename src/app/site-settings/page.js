'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavHeader from '@/components/NavHeader';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import Footer from '@/components/Footer';
import { clearAuth, getStoredAuth, isAuthValid } from '@/lib/auth';

function getUserRole(user) {
  return user?.role?.name || user?.roleName || user?.role || user?.userRole || 'user';
}

function getUserName(user) {
  return user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'User';
}

export default function SiteSettingsPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'Camion Admin',
    supportEmail: 'support@camion.app',
    timezone: 'Asia/Karachi',
    maintenanceMode: false,
  });

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);

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

  if (!isValid) {
    return <div className="screen-center">Loading site settings...</div>;
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
                <div className="card-header">
                  <h4 className="card-title mb-0">Site Settings</h4>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Site Name</label>
                      <input
                        className="form-control"
                        value={settings.siteName}
                        onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Support Email</label>
                      <input
                        type="email"
                        className="form-control"
                        value={settings.supportEmail}
                        onChange={(e) => setSettings((prev) => ({ ...prev, supportEmail: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Timezone</label>
                      <input
                        className="form-control"
                        value={settings.timezone}
                        onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-6 mb-3 d-flex align-items-end">
                      <label className="mb-0 d-flex align-items-center" style={{ gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={settings.maintenanceMode}
                          onChange={(e) => setSettings((prev) => ({ ...prev, maintenanceMode: e.target.checked }))}
                        />
                        Maintenance Mode
                      </label>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <button className="btn btn-primary btn-sm" type="button">
                      Save Settings
                    </button>
                  </div>
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

