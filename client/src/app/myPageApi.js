import { api } from "./api.js";

export function getMyPage() {
  return api("/my-page");
}

export function saveMyPage(payload) {
  return api("/my-page", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveMyPageLinks(payload) {
  const avatarMode = String(payload?.avatarMode || "").trim().toLowerCase();
  const avatarFile = payload?.avatarFile || null;
  const hasAvatarFile =
    typeof File !== "undefined" && avatarFile instanceof File;
  const shouldUseFormData =
    hasAvatarFile ||
    avatarMode === "upload" ||
    avatarMode === "url" ||
    avatarMode === "remove";

  if (shouldUseFormData) {
    const formData = new FormData();
    formData.set("slug", payload?.slug || "");
    formData.set("title", payload?.title || "");
    formData.set("subtitle", payload?.subtitle || "");
    formData.set("description", payload?.description || "");
    formData.set("whatsappPhone", payload?.whatsappPhone || "");
    formData.set("buttons", JSON.stringify(payload?.buttons || []));
    formData.set("socialLinks", JSON.stringify(payload?.socialLinks || []));
    formData.set("avatarMode", avatarMode || "keep");

    if (avatarMode === "url") {
      formData.set("avatarUrl", payload?.avatarUrl || "");
    }

    if (hasAvatarFile) {
      formData.set("avatarFile", avatarFile);
    }

    return api("/my-page/links", {
      method: "PUT",
      body: formData,
    });
  }

  return api("/my-page/links", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function saveMyPageAvatar(payload = {}) {
  const avatarMode = String(payload?.avatarMode || "").trim().toLowerCase();
  const avatarFile = payload?.avatarFile || null;
  const hasAvatarFile =
    typeof File !== "undefined" && avatarFile instanceof File;

  if (avatarMode === "upload" || hasAvatarFile) {
    const formData = new FormData();
    formData.set("avatarMode", "upload");
    if (hasAvatarFile) {
      formData.set("avatarFile", avatarFile);
    }

    return api("/my-page/avatar", {
      method: "PUT",
      body: formData,
    });
  }

  return api("/my-page/avatar", {
    method: "PUT",
    body: JSON.stringify({
      avatarMode,
      avatarUrl: payload?.avatarUrl || "",
    }),
  });
}

export function getMyPageShopProducts(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api(`/my-page/shop/products${qs}`);
}

export function saveMyPageShop(productIds = [], showPrices = true) {
  return api("/my-page/shop", {
    method: "PUT",
    body: JSON.stringify({
      shop: {
        productIds: Array.isArray(productIds) ? productIds : [],
        showPrices: showPrices !== false,
      },
    }),
  });
}

export function saveMyPageDesign(design = {}) {
  return api("/my-page/design", {
    method: "PUT",
    body: JSON.stringify({ design }),
  });
}

export function setMyPagePublished(isPublished) {
  return api("/my-page/publish", {
    method: "POST",
    body: JSON.stringify({ isPublished }),
  });
}

export function getMyPageAnalytics() {
  return api("/my-page/analytics");
}

export function getPublicMyPage(slug) {
  return api(`/my-page/public/${encodeURIComponent(slug)}`);
}

export function getPublicMyPageCatalog(slug, q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api(`/my-page/public/${encodeURIComponent(slug)}/catalog${qs}`);
}

export function getPublicMyPageQuoteContext(slug, productIds = []) {
  const ids = Array.isArray(productIds) ? productIds.filter(Boolean) : [];
  const qs = ids.length
    ? `?${ids
        .map((id) => `productId=${encodeURIComponent(id)}`)
        .join("&")}`
    : "";
  return api(`/my-page/public/${encodeURIComponent(slug)}/quote/context${qs}`);
}

export function submitPublicMyPageQuoteRequest(slug, payload) {
  return api(`/my-page/public/${encodeURIComponent(slug)}/quote`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getPublicMyPageScheduleSlots(slug, date) {
  return api(
    `/my-page/public/${encodeURIComponent(slug)}/schedule/slots?date=${encodeURIComponent(date)}`,
  );
}

export function bookPublicMyPageSchedule(slug, payload) {
  return api(`/my-page/public/${encodeURIComponent(slug)}/schedule/book`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resolvePublicMyPagePayment(slug, input) {
  return api(`/my-page/public/${encodeURIComponent(slug)}/pay/resolve`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export function trackPublicMyPageClick(slug, payload) {
  return api(`/my-page/public/${encodeURIComponent(slug)}/click`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getMyPageQuoteRequests(status = "") {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  return api(`/my-page/quote-requests${qs}`);
}

export function updateMyPageQuoteRequestStatus(id, status) {
  return api(`/my-page/quote-requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function getMyPageQuoteRequestPrefill(id) {
  return api(`/my-page/quote-requests/${encodeURIComponent(id)}/prefill`);
}
