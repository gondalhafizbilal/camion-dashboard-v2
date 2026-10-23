'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuth, getStoredAuth } from '@/lib/auth';

export default function Topbar({ name, role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notificationsRef = useRef(null);
  const messagesRef = useRef(null);
  const profileRef = useRef(null);
  const auth = getStoredAuth();
  const currentUserUUID = auth?.user?.uuid || '';

  const title = (() => {
    if (!pathname || pathname === '/') return 'Dashboard';
    const first = pathname.split('/').filter(Boolean)[0] || 'dashboard';
    return first.charAt(0).toUpperCase() + first.slice(1);
  })();

  const onToggleMenu = () => {
    const mainwrapper = document.querySelector('#main-wrapper');
    if (!mainwrapper) return;
    mainwrapper.classList.toggle('menu-toggle');
  };

  const onLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  useEffect(() => {
    const onClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (messagesRef.current && !messagesRef.current.contains(event.target)) {
        setMessagesOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const onViewProfile = () => {
    setProfileOpen(false);
    if (currentUserUUID) {
      router.push(`/users/${currentUserUUID}`);
      return;
    }
    router.push('/users');
  };

  const onChangePassword = () => {
    setProfileOpen(false);
    if (currentUserUUID) {
      router.push(`/users/${currentUserUUID}/edit`);
      return;
    }
    router.push('/users');
  };

  return (
    <div className="header">
      <div className="header-content">
        <nav className="navbar navbar-expand">
          <div className="collapse navbar-collapse justify-content-between">
            <div className="header-left">
              <div className="dashboard_bar topbar-title-wrap" style={{ textTransform: 'capitalize' }}>
                <span>{title}</span>
              </div>
            </div>
            <ul className="navbar-nav header-right">
              <li className="nav-item">
                <div className="input-group search-area d-xl-inline-flex d-none">
                  <input type="text" className="form-control" placeholder="Search here..." />
                  <div className="input-group-append">
                    <span className="input-group-text">
                      <i className="flaticon-381-search-2" />
                    </span>
                  </div>
                </div>
              </li>
              <li className="nav-item dropdown notification_dropdown" ref={notificationsRef}>
                <a
                  className="nav-link ai-icon"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setNotificationsOpen((prev) => !prev);
                    setMessagesOpen(false);
                    setProfileOpen(false);
                  }}
                >
                  <i className="flaticon-381-ring" />
                  <div className="pulse-css" />
                </a>
                <div className={`dropdown-menu dropdown-menu-right mt-2 ${notificationsOpen ? 'show' : ''}`}>
                  <div className="widget-media dz-scroll p-3 height380">
                    <ul className="timeline">
                      <li>
                        <div className="timeline-panel">
                          <div className="media mr-2">
                            <img src="/admin-assets/images/profile/20.jpg" width="50" alt="n1" />
                          </div>
                          <div className="media-body">
                            <h6 className="mb-1">Dr sultads Send you Photo</h6>
                            <small className="d-block">29 July 2020 - 02:26 PM</small>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div className="timeline-panel">
                          <div className="media mr-2 media-info">KG</div>
                          <div className="media-body">
                            <h6 className="mb-1">Resport created successfully</h6>
                            <small className="d-block">29 July 2020 - 02:26 PM</small>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div className="timeline-panel">
                          <div className="media mr-2 media-success">
                            <i className="fa fa-home" />
                          </div>
                          <div className="media-body">
                            <h6 className="mb-1">Reminder : Treatment Time!</h6>
                            <small className="d-block">29 July 2020 - 02:26 PM</small>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div className="timeline-panel">
                          <div className="media mr-2">
                            <img src="/admin-assets/images/profile/20.jpg" width="50" alt="n2" />
                          </div>
                          <div className="media-body">
                            <h6 className="mb-1">Dr sultads Send you Photo</h6>
                            <small className="d-block">29 July 2020 - 02:26 PM</small>
                          </div>
                        </div>
                      </li>
                      <li>
                        <div className="timeline-panel">
                          <div className="media mr-2 media-danger">KG</div>
                          <div className="media-body">
                            <h6 className="mb-1">Resport created successfully</h6>
                            <small className="d-block">29 July 2020 - 02:26 PM</small>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>
                  <a href="#" className="all-notification" onClick={(e) => e.preventDefault()}>
                    See all notifications <i className="ti-arrow-right" />
                  </a>
                </div>
              </li>
              <li className="nav-item dropdown header-profile" ref={profileRef}>
                <a
                  className="nav-link i-false d-flex align-items-center"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setNotificationsOpen(false);
                    setMessagesOpen(false);
                    setProfileOpen((prev) => !prev);
                  }}
                >
                  <img src="/admin-assets/images/profile/17.jpg" width={48} alt="profile" />
                </a>
                <div className={`dropdown-menu dropdown-menu-right mt-2 ${profileOpen ? 'show' : ''}`}>
                  <button type="button" className="dropdown-item ai-icon" onClick={onViewProfile}>
                    View Profile
                  </button>
                  <button type="button" className="dropdown-item ai-icon" onClick={onChangePassword}>
                    Change Password
                  </button>
                  <button
                    type="button"
                    className="dropdown-item ai-icon text-danger"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}
