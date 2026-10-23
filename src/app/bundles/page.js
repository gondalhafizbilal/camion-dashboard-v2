"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import NavHeader from "@/components/NavHeader";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import { clearAuth, getStoredAuth, isAuthValid } from "@/lib/auth";
import { getTransformedImageUrl } from "@/lib/imageUrl";
import { toApiError } from "@/lib/apiError";

function getUserRole(user) {
  return (
    user?.role?.name || user?.roleName || user?.role || user?.userRole || "user"
  );
}

function getUserName(user) {
  return (
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.name ||
    "User"
  );
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function formatBundleMode(mode) {
  switch (mode) {
    case "hybrid":
      return "Hybrid";
    case "auto":
      return "Auto";
    default:
      return "Fixed";
  }
}

export default function BundlesPage() {
  const router = useRouter();
  const [menuToggled, setMenuToggled] = useState(false);
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const auth = getStoredAuth();
  const isValid = isAuthValid(auth);
  const token = auth?.access_token || "";

  useEffect(() => {
    if (!isValid) {
      clearAuth();
      router.replace("/login");
      return;
    }
    const body = document.body;
    body.setAttribute(
      "data-sidebar-style",
      window.innerWidth <= 768 ? "overlay" : "full",
    );
    const onResize = () =>
      body.setAttribute(
        "data-sidebar-style",
        window.innerWidth <= 768 ? "overlay" : "full",
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isValid, router]);

  const fullName = useMemo(() => getUserName(auth?.user), [auth?.user]);
  const role = useMemo(() => getUserRole(auth?.user), [auth?.user]);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = new Headers(options.headers || {});
      headers.set("authorization", `Bearer ${token}`);
      if (options.body !== undefined && !headers.has("Content-Type"))
        headers.set("Content-Type", "application/json");
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw toApiError(payload, response, "Request failed.");
      return payload;
    },
    [token],
  );

  const loadBundles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiFetch(
        "/api/bundles?pageNumber=1&itemsPerPage=100",
        { method: "GET" },
      );
      setBundles(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load bundles.");
    } finally {
      setLoading(false);
    }
  }, [apiFetch, token]);

  useEffect(() => {
    loadBundles();
  }, [loadBundles]);

  const onDelete = async (uuid) => {
    if (!uuid || !window.confirm("Delete this bundle?")) return;
    try {
      await apiFetch(`/api/bundles/${uuid}`, { method: "DELETE" });
      await loadBundles();
    } catch (err) {
      setError(err.message || "Failed to delete bundle.");
    }
  };

  if (!isValid) return <div className="screen-center">Loading bundles...</div>;

  return (
    <div
      id="main-wrapper"
      className={`show${menuToggled ? " menu-toggle" : ""}`}
    >
      <NavHeader
        toggled={menuToggled}
        onToggle={() => setMenuToggled((prev) => !prev)}
      />
      <Sidebar />
      <Topbar name={fullName} role={role} />
      <div className="content-body" style={{ minHeight: "100vh" }}>
        <div className="container-fluid">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h4 className="card-title mb-0">Bundles</h4>
              <Link href="/bundles/new" className="btn btn-primary btn-sm">
                Create Bundle
              </Link>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {loading ? <p className="mb-0">Loading bundles...</p> : null}
              {!loading && bundles.length === 0 ? (
                <p className="mb-0">No bundles found.</p>
              ) : null}
              {!loading && bundles.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-bordered table-striped">
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Title</th>
                        <th>Mode</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Active</th>
                        <th>Starts</th>
                        <th>Finishes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bundles.map((bundle) => (
                        <tr key={bundle.uuid}>
                          <td>
                            {bundle.imageUrl ? (
                              <img
                                src={getTransformedImageUrl(bundle.imageUrl)}
                                alt={bundle.titleEn || "Bundle"}
                                style={{
                                  width: 56,
                                  height: 56,
                                  objectFit: "cover",
                                  borderRadius: 6,
                                }}
                              />
                            ) : (
                              "-"
                            )}
                          </td>
                          <td>
                            <div>{bundle.titleEn || "-"}</div>
                            <small className="text-muted">
                              {bundle.slug || "-"}
                            </small>
                          </td>
                          <td>{formatBundleMode(bundle.mode)}</td>
                          <td>{bundle.discountType || "-"}</td>
                          <td>
                            {Array.isArray(bundle.items)
                              ? bundle.items.length
                              : 0}
                          </td>
                          <td>{bundle.isActive ? "Yes" : "No"}</td>
                          <td>{formatDateTime(bundle.startsAt)}</td>
                          <td>{formatDateTime(bundle.finishesAt)}</td>
                          <td>
                            <div
                              className="d-flex gap-2"
                              style={{ gap: "8px" }}
                            >
                              <Link
                                href={`/bundles/${bundle.uuid}`}
                                className="btn btn-outline-dark btn-sm"
                              >
                                View
                              </Link>
                              <Link
                                href={`/bundles/${bundle.uuid}/edit`}
                                className="btn btn-info btn-sm"
                              >
                                Edit
                              </Link>
                              <button
                                className="btn btn-danger btn-sm"
                                type="button"
                                onClick={() => onDelete(bundle.uuid)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
