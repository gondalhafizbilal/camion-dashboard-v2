"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function BundleShowPage() {
  const router = useRouter();
  const params = useParams();
  const uuid = params?.uuid;
  const [menuToggled, setMenuToggled] = useState(false);
  const [bundle, setBundle] = useState(null);
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
      const response = await fetch(path, { ...options, headers });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw toApiError(payload, response, "Request failed.");
      return payload;
    },
    [token],
  );

  useEffect(() => {
    if (!uuid || !token) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiFetch(`/api/bundles/${uuid}`, { method: "GET" });
        setBundle(data || null);
      } catch (err) {
        setError(err.message || "Failed to load bundle.");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiFetch, token, uuid]);

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
              <h4 className="card-title mb-0">Bundle Details</h4>
              <div className="d-flex" style={{ gap: "8px" }}>
                <Link
                  href="/bundles"
                  className="btn btn-outline-primary btn-sm"
                >
                  Back
                </Link>
                <Link
                  href={`/bundles/${uuid}/edit`}
                  className="btn btn-primary btn-sm"
                >
                  Edit
                </Link>
              </div>
            </div>
            <div className="card-body">
              {error ? <div className="alert alert-danger">{error}</div> : null}
              {loading ? <p className="mb-0">Loading bundle...</p> : null}
              {!loading && bundle ? (
                <>
                  {bundle.imageUrl ? (
                    <img
                      src={getTransformedImageUrl(bundle.imageUrl)}
                      alt={bundle.titleEn || "Bundle"}
                      style={{
                        width: 140,
                        height: 140,
                        objectFit: "cover",
                        borderRadius: 8,
                        marginBottom: 16,
                      }}
                    />
                  ) : null}
                  <table className="table table-bordered">
                    <tbody>
                      <tr>
                        <th>Title (EN)</th>
                        <td>{bundle.titleEn || "-"}</td>
                      </tr>
                      <tr>
                        <th>Title (AR)</th>
                        <td>{bundle.titleAr || "-"}</td>
                      </tr>
                      <tr>
                        <th>Slug</th>
                        <td>{bundle.slug || "-"}</td>
                      </tr>
                      <tr>
                        <th>Mode</th>
                        <td>{formatBundleMode(bundle.mode)}</td>
                      </tr>
                      <tr>
                        <th>Discount Type</th>
                        <td>{bundle.discountType || "-"}</td>
                      </tr>
                      <tr>
                        <th>Flat Total</th>
                        <td>{bundle.flatPriceValue ?? "-"}</td>
                      </tr>
                      <tr>
                        <th>Discount Percentage</th>
                        <td>{bundle.discountPercentage ?? "-"}</td>
                      </tr>
                      <tr>
                        <th>Discount Amount</th>
                        <td>{bundle.discountAmountValue ?? "-"}</td>
                      </tr>
                      <tr>
                        <th>Amount Currency</th>
                        <td>{bundle.amountCurrencyCode || "-"}</td>
                      </tr>
                      <tr>
                        <th>Anchor Product UUID</th>
                        <td>{bundle.anchorProductUuid || "-"}</td>
                      </tr>
                      <tr>
                        <th>Source Categories</th>
                        <td>
                          {Array.isArray(bundle.sourceCategoryUuids) &&
                          bundle.sourceCategoryUuids.length > 0
                            ? bundle.sourceCategoryUuids.join(", ")
                            : "-"}
                        </td>
                      </tr>
                      <tr>
                        <th>Auto Fill Count</th>
                        <td>{bundle.autoFillCount ?? "-"}</td>
                      </tr>
                      <tr>
                        <th>Active</th>
                        <td>{bundle.isActive ? "Yes" : "No"}</td>
                      </tr>
                      <tr>
                        <th>Starts At</th>
                        <td>{formatDateTime(bundle.startsAt)}</td>
                      </tr>
                      <tr>
                        <th>Finishes At</th>
                        <td>{formatDateTime(bundle.finishesAt)}</td>
                      </tr>
                    </tbody>
                  </table>

                  <h5 className="mt-4">
                    {bundle.mode === "auto" ? "Resolved Bundle Items" : "Bundle Items"}
                  </h5>
                  <div className="table-responsive">
                    <table className="table table-striped table-bordered">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Variant</th>
                          <th>Quantity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(bundle.items || []).map((item, index) => (
                          <tr key={`${item?.id || index}`}>
                            <td>
                              {item?.product?.titleEn ||
                                item?.variant?.product?.titleEn ||
                                "-"}
                            </td>
                            <td>{item?.variant?.titleEn || "Any variant"}</td>
                            <td>{item?.quantity ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
