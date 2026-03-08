/**
 * AI 周报总结请求：接口地址、超时与 fetch 封装。
 */

export const AI_SUMMARY_URL = "/api/weekly-summary";
export const AI_SUMMARY_TIMEOUT_MS = 20000;

const AI_MONTHLY_SUMMARY_URL = "/api/monthly-summary";

/**
 * 请求月报 AI 总结。payload 与周报结构相似：{ range, stats, days }。
 * @returns {Promise<{ comment: string, highlights: string[], suggestions: string[] }>}
 */
export async function requestAiMonthlySummary(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SUMMARY_TIMEOUT_MS);
  try {
    const res = await fetch(AI_MONTHLY_SUMMARY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.snippet = data?.snippet;
      throw err;
    }
    if (!data.ok || !data.result) {
      const err = new Error(data?.error || "invalid_response");
      err.snippet = data?.snippet;
      throw err;
    }
    return data.result;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      const err = new Error("timeout");
      err.isAbort = true;
      throw err;
    }
    throw e;
  }
}

/**
 * 请求周报 AI 总结。
 * @param {object} payload - { range, stats, days }
 * @returns {Promise<{ comment: string, highlights: string[], suggestions: string[] }>}
 */
export async function requestAiWeeklySummary(payload) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_SUMMARY_TIMEOUT_MS);
  try {
    const res = await fetch(AI_SUMMARY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data?.error || data?.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.snippet = data?.snippet;
      throw err;
    }
    if (!data.ok || !data.result) {
      const err = new Error(data?.error || "invalid_response");
      err.snippet = data?.snippet;
      throw err;
    }
    return data.result;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      const err = new Error("timeout");
      err.isAbort = true;
      throw err;
    }
    throw e;
  }
}
