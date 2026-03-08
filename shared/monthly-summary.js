/**
 * 月报 AI 总结共享逻辑：校验与 AI 请求。
 * 与周报结构相似，返回 { comment, highlights, suggestions }。
 */

const { isDateKey, coerceTextSnippet, tryParseStrictJson } = require("./weekly-summary.js");

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_payload" } };
  }
  const { range, stats, days } = payload;
  if (!range || typeof range !== "object" || !isDateKey(range.start) || !isDateKey(range.end)) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_range" } };
  }
  if (
    !stats ||
    typeof stats !== "object" ||
    typeof stats.total !== "number" ||
    typeof stats.completed !== "number" ||
    typeof stats.completionRate !== "number" ||
    typeof stats.activeDays !== "number"
  ) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_stats" } };
  }
  if (!Array.isArray(days) || days.length < 1 || days.length > 31) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_days" } };
  }
  for (const d of days) {
    if (!d || typeof d !== "object" || !isDateKey(d.date) || !Array.isArray(d.tasks)) {
      return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_days_item" } };
    }
    if (typeof d.weekdayLabel !== "string") {
      return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_weekdayLabel" } };
    }
    if (d.diary !== undefined && typeof d.diary !== "string") {
      return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_diary" } };
    }
    for (const t of d.tasks) {
      if (!t || typeof t !== "object" || typeof t.text !== "string" || typeof t.isCompleted !== "boolean") {
        return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_task" } };
      }
      if (t.tag !== undefined && typeof t.tag !== "string") {
        return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_task_tag" } };
      }
      if (t.tagLabel !== undefined && typeof t.tagLabel !== "string") {
        return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_task_tagLabel" } };
      }
    }
  }
  return { valid: true };
}

async function executeAiSummary(payload) {
  const AI_BASE_URL = process.env.AI_BASE_URL;
  const AI_API_KEY = process.env.AI_API_KEY;
  const AI_MODEL = process.env.AI_MODEL;
  if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
    return { ok: false, statusCode: 500, body: { ok: false, error: "missing_ai_env" } };
  }
  const url = `${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;
  const system = [
    "你是一个高质量的月报复盘助手，面向个人月度总结与移动端简短阅读。",
    "输入中为该月内「有任务或有日记」的日期列表，每天包含：任务列表（tasks，每项含 text、isCompleted、tag、tagLabel）和当日日记（diary）。",
    "标签说明：tag 为稳定英文值，tagLabel 为中文名称。对应关系：空/未分类、work→工作、study→学习、life→生活、fitness→健身。",
    "请从月度复盘角度分析：整体执行节奏、各标签投入与完成情况、日记反映的状态与情绪、下月可执行的改进建议。数据较少时保持简洁，不要强行过度总结。",
    "你必须只输出一个可 JSON.parse 的纯 JSON 对象，不要输出 Markdown，不要输出多余文字。",
    '输出格式严格为：{"comment":"...","highlights":["..."],"suggestions":["..."]}',
    "comment 2-4 句中文；highlights 与 suggestions 各 3-6 条，简洁可执行。",
  ].join("\n");
  const user = {
    range: payload.range,
    stats: payload.stats,
    days: payload.days.map((d) => ({ ...d, diary: typeof d.diary === "string" ? d.diary : "" })),
    output: { language: "zh-CN", style: "简洁、可执行、月度复盘" },
  };
  let upstreamText = "";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(user) },
        ],
      }),
    });
    upstreamText = await r.text();
    if (!r.ok) {
      console.error("[monthly-summary] API 非 2xx:", r.status, coerceTextSnippet(upstreamText, 400));
      return { ok: false, statusCode: 502, body: { ok: false, error: "upstream_error", status: r.status, snippet: coerceTextSnippet(upstreamText) } };
    }
    let data;
    try {
      data = JSON.parse(upstreamText);
    } catch {
      console.error("[monthly-summary] 响应非 JSON:", coerceTextSnippet(upstreamText, 400));
      return { ok: false, statusCode: 502, body: { ok: false, error: "upstream_non_json", snippet: coerceTextSnippet(upstreamText) } };
    }
    const content = data?.choices?.[0]?.message?.content;
    const parsed = tryParseStrictJson(content);
    if (!parsed || typeof parsed.comment !== "string" || !Array.isArray(parsed.highlights) || !Array.isArray(parsed.suggestions)) {
      console.error("[monthly-summary] AI 返回非约定 JSON:", coerceTextSnippet(content ?? upstreamText, 400));
      return { ok: false, statusCode: 502, body: { ok: false, error: "bad_ai_json", snippet: coerceTextSnippet(content ?? upstreamText) } };
    }
    return { ok: true, body: { ok: true, result: { comment: parsed.comment, highlights: parsed.highlights, suggestions: parsed.suggestions } } };
  } catch (err) {
    console.error("[monthly-summary] 请求异常:", err?.message);
    return { ok: false, statusCode: 502, body: { ok: false, error: "fetch_failed", message: err?.message || "unknown", snippet: coerceTextSnippet(upstreamText) } };
  }
}

module.exports = { validatePayload, executeAiSummary };
