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
  return api("/my-page/links", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function getMyPageShopProducts(q = "") {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return api(`/my-page/shop/products${qs}`);
}

export function saveMyPageShop(productIds = []) {
  return api("/my-page/shop", {
    method: "PUT",
    body: JSON.stringify({
      shop: {
        productIds: Array.isArray(productIds) ? productIds : [],
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
