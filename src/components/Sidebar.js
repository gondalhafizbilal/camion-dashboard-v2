"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

const dashboardItem = {
  title: "Dashboard",
  href: "/dashboard",
  iconClass: "flaticon-381-networking",
};

const sectionedMenu = [
  {
    label: "Manage Section",
    items: [
      { title: "Users", href: "/users", iconClass: "la la-users" },
      {
        title: "Customers",
        href: "/customers",
        iconClass: "flaticon-381-user-2",
      },
      {
        title: "Referral",
        href: "/referral",
        iconClass: "la la-share-alt",
        children: [
          { title: "Affiliates", href: "/referral/affiliates" },
          { title: "Wallets", href: "/referral/wallets" },
          { title: "Transactions", href: "/referral/transactions" },
          { title: "Coupons", href: "/referral/coupons" },
          // { title: "Global Coupons", href: "/referral/global-coupons" },
        ],
      },
      {
        title: "Global Coupons",
        href: "/referral/global-coupons",
        iconClass: "la la-share-alt",
      },
    ],
  },
  {
    label: "Product & Orders Section",
    items: [
      {
        title: "Categories",
        href: "/categories",
        iconClass: "flaticon-381-list",
      },
      {
        title: "Products",
        href: "/products",
        iconClass: "flaticon-381-box",
        children: [
          { title: "Products", href: "/products" },
          { title: "Product Reviews", href: "/products/reviews" },
        ],
      },
      { title: "Campaigns", href: "/campaigns", iconClass: "la la-bullhorn" },
      { title: "Bundles", href: "/bundles", iconClass: "la la-cubes" },
      // { title: "Product Category Resync", href: "/products/resync-categories", iconClass: "la la-refresh" },
      {
        title: "Procurement",
        href: "/procurement",
        iconClass: "flaticon-381-search-2",
        children: [
          { title: "Search Listing", href: "/procurement" },
          { title: "Create Order", href: "/procurement/create-order" },
          { title: "Bulk Order", href: "/procurement/bulk-order" },
          // { title: "Resync Job Status", href: "/procurement/resync-job-status" },
        ],
      },
      {
        title: "Orders",
        href: "/orders",
        iconClass: "flaticon-381-notepad",
        children: [
          { title: "Orders", href: "/orders" },
          { title: "Dispatch Orders", href: "/orders/dispatch-orders" },
          { title: "Dispatched Orders", href: "/orders/dispatched-orders" },
        ],
      },
    ],
  },
  {
    label: "Return & Refund Section",
    items: [
      {
        title: "Return Requests",
        href: "/return-refund",
        iconClass: "la la-undo",
      },
    ],
  },
  {
    label: "Misc Section",
    items: [
      {
        title: "Notifications",
        href: "/notifications",
        iconClass: "flaticon-381-notification",
        children: [
          { title: "Custom Notification", href: "/notifications/custom" },
        ],
      },
      { title: "Warehouses", href: "/warehouses", iconClass: "la la-building" },
      { title: "Currencies", href: "/currencies", iconClass: "la la-money" },
      {
        title: "Languages",
        href: "/languages",
        iconClass: "flaticon-381-earth-globe",
      },
      {
        title: "Exchange Rates",
        href: "/exchange-rates",
        iconClass: "la la-line-chart",
      },
      {
        title: "Key Value Pairs",
        href: "/key-value-pairs",
        iconClass: "flaticon-381-settings-2",
      },
      { title: "Posts", href: "/posts", iconClass: "flaticon-381-file-1" },
      { title: "Stories", href: "/stories", iconClass: "flaticon-381-notepad" },
      { title: "Promos", href: "/promos", iconClass: "flaticon-381-promotion" },
      { title: "Banners", href: "/banners", iconClass: "flaticon-381-picture" },
      {
        title: "Export Requests",
        href: "/export-requests",
        iconClass: "flaticon-381-files-1",
      },
      {
        title: "Site Settings",
        href: "/site-settings",
        iconClass: "flaticon-381-settings-2",
      },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const defaultOpenMenus = useMemo(() => {
    const openState = {};
    sectionedMenu.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children) {
          openState[item.href] = pathname?.startsWith(item.href);
        }
      });
    });
    return openState;
  }, [pathname]);
  const [openMenus, setOpenMenus] = useState(defaultOpenMenus);

  const isActive = (href) =>
    pathname === href || pathname?.startsWith(`${href}/`);
  const isMenuOpen = (href) => Boolean(openMenus[href] || isActive(href));
  const toggleMenu = (href) => {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  };

  const renderMenuItem = (item) => {
    if (!item.children) {
      return (
        <li key={item.href} className={isActive(item.href) ? "mm-active" : ""}>
          <Link href={item.href}>
            <i className={item.iconClass} />
            <span className="nav-text">{item.title}</span>
          </Link>
        </li>
      );
    }

    const open = isMenuOpen(item.href);
    return (
      <li key={item.href} className={open ? "mm-active" : ""}>
        <a
          href="#"
          className="has-arrow"
          aria-expanded={open ? "true" : "false"}
          onClick={(e) => {
            e.preventDefault();
            toggleMenu(item.href);
          }}
        >
          <i className={item.iconClass} />
          <span className="nav-text">{item.title}</span>
        </a>
        <ul
          className={open ? "mm-show" : ""}
          style={{ display: open ? "block" : "none" }}
        >
          {item.children.map((child) => (
            <li
              key={child.href}
              className={isActive(child.href) ? "mm-active" : ""}
            >
              <Link href={child.href}>{child.title}</Link>
            </li>
          ))}
        </ul>
      </li>
    );
  };

  return (
    <div className="deznav">
      <div className="deznav-scroll">
        <ul className="metismenu" id="menu">
          {renderMenuItem(dashboardItem)}
          {sectionedMenu.flatMap((section) => [
            <li key={`${section.label}-label`} className="nav-label">
              {section.label}
            </li>,
            ...section.items.map((item) => renderMenuItem(item)),
          ])}
        </ul>
        <div className="copyright">
          <p>
            <strong>CAMION</strong> © {year} All Rights Reserved
          </p>
        </div>
      </div>
    </div>
  );
}
