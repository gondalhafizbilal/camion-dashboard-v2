'use client';

import Link from 'next/link';

export default function NavHeader({ toggled, onToggle }) {
  return (
    <div className="nav-header">
      <Link href="/dashboard" className="brand-logo">
        <img className="logo-abbr" src="/admin-assets/images/logo-o.svg" alt="Camion" />
        <img className="logo-compact" src="/admin-assets/images/logo-text.svg" alt="Camion" />
        <img className="brand-title" src="/admin-assets/images/logo-text.svg" alt="Camion" />
      </Link>

      <div className="nav-control" onClick={onToggle}>
        <div className={`hamburger ${toggled ? 'is-active' : ''}`}>
          <span className="line" />
          <span className="line" />
          <span className="line" />
        </div>
      </div>
    </div>
  );
}
