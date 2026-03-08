/**
 * 周报 AI 总结共享逻辑：校验、工具函数与 AI 请求。
 * 供 server/index.js 与 api/weekly-summary.js 共用，保证行为与返回结构一致。
 */

function isDateKey(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function safeAddDays(dateStr, deltaDays) {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function coerceTextSnippet(s, max = 220) {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

function tryParseStrictJson(raw) {
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  try {
    return JSON.parse(s);
  } catch {
    const match = s.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * 校验周报 payload，与原有 server / api 校验完全一致。
 * @returns {{ valid: true }} | {{ valid: false, statusCode: number, body: object }}
 */
function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_payload" } };
  }

  const { range, stats, days } = payload;

  if (
    !range ||
    typeof range !== "object" ||
    !isDateKey(range.start) ||
    !isDateKey(range.end)
  ) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_range" } };
  }

  if (
    !stats ||
    typeof stats !== "object" ||
    typeof stats.total !== "number" ||
    typeof stats.completed !== "number" ||
    typeof stats.completionRate !== "number"
  ) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "invalid_stats" } };
  }

  if (!Array.isArray(days) || days.length < 1 || days.length > 7) {
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
    if (d.tasks.length > 200) {
      return { valid: false, statusCode: 400, body: { ok: false, error: "too_many_tasks" } };
    }
    for (const t of d.tasks) {
      if (
        !t ||
        typeof t !== "object" ||
        typeof t.text !== "string" ||
        typeof t.isCompleted !== "boolean"
      ) {
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

  const expectedDates = Array.from({ length: 7 }, (_, i) => safeAddDays(range.end, i - 6));
  const expectedSet = new Set(expectedDates);
  if (!expectedSet.has(range.start) || !expectedSet.has(range.end)) {
    return { valid: false, statusCode: 400, body: { ok: false, error: "range_not_7_days" } };
  }

  return { valid: true };
}

/**
 * 执行周报 AI 请求与结果解析。假定 payload 已通过 validatePayload。
 * @returns {Promise<{ ok: true, body: object }|{ ok: false, statusCode: number, body: object }>}
 */
async function executeAiSummary(payload) {
  const AI_BASE_URL = process.env.AI_BASE_URL;
  const AI_API_KEY = process.env.AI_API_KEY;
  const AI_MODEL = process.env.AI_MODEL;

  if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
    return {
      ok: false,
      statusCode: 500,
      body: { ok: false, error: "missing_ai_env" },
    };
  }

  const url = `${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  const system = [
    "你是一个高质量的周报总结助手，面向个人复盘与移动端简短阅读。",
    "输入中每一天包含：任务列表（tasks，每项含 text、isCompleted、tag、tagLabel）和当日日记（diary）。",
    "标签说明：tag 为稳定英文值，tagLabel 为中文名称。理解标签时请优先使用 tagLabel。对应关系：空/未分类、work→工作、study→学习、life→生活、fitness→健身。",
    "请综合分析：本周任务总量与完成率、每日分布、日记内容，以及**按标签（tag/tagLabel）维度的任务数量与完成情况**。在 comment/highlights/suggestions 中可自然体现：哪类标签任务占比更高、哪类完成较好、哪类完成较弱或易积压、是否存在标签分布失衡（如工作多生活少）；建议可针对某类标签给出更具体、可执行的建议。",
    "若某天 diary 为空字符串则忽略该天日记；若任务或标签信息很少，不要强行按标签分析，保持简洁。",
    "你必须只输出一个可 JSON.parse 的纯 JSON 对象，不要输出 Markdown，不要输出多余文字。",
    '输出格式严格为：{"comment":"...","highlights":["..."],"suggestions":["..."]}',
    "comment 为 2-4 句中文总结；highlights 3-6 条；suggestions 3-6 条。风格：简洁、实用、可执行。",
  ].join("\n");

  const user = {
    range: payload.range,
    stats: payload.stats,
    days: payload.days.map((d) => ({
      ...d,
      diary: typeof d.diary === "string" ? d.diary : "",
    })),
    output: {
      language: "zh-CN",
      style: "简洁、可执行、偏移动端生活节奏",
    },
  };

  let upstreamText = "";
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
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
      console.error("[weekly-summary] DashScope API 非 2xx:", r.status, coerceTextSnippet(upstreamText, 400));
      return {
        ok: false,
        statusCode: 502,
        body: {
          ok: false,
          error: "upstream_error",
          status: r.status,
          snippet: coerceTextSnippet(upstreamText),
        },
      };
    }

    let data;
    try {
      data = JSON.parse(upstreamText);
    } catch {
      console.error("[weekly-summary] DashScope 响应非 JSON:", coerceTextSnippet(upstreamText, 400));
      return {
        ok: false,
        statusCode: 502,
        body: {
          ok: false,
          error: "upstream_non_json",
          snippet: coerceTextSnippet(upstreamText),
        },
      };
    }

    const content = data?.choices?.[0]?.message?.content;
    const parsed = tryParseStrictJson(content);
    if (
      !parsed ||
      typeof parsed.comment !== "string" ||
      !Array.isArray(parsed.highlights) ||
      !Array.isArray(parsed.suggestions)
    ) {
      console.error("[weekly-summary] AI 返回内容无法解析为约定 JSON:", coerceTextSnippet(content ?? upstreamText, 400));
      return {
        ok: false,
        statusCode: 502,
        body: {
          ok: false,
          error: "bad_ai_json",
          snippet: coerceTextSnippet(content ?? upstreamText),
        },
      };
    }

    return {
      ok: true,
      body: {
        ok: true,
        result: {
          comment: parsed.comment,
          highlights: parsed.highlights,
          suggestions: parsed.suggestions,
        },
      },
    };
  } catch (err) {
    console.error("[weekly-summary] 请求 DashScope 异常:", err?.message, err?.cause);
    return {
      ok: false,
      statusCode: 502,
      body: {
        ok: false,
        error: "fetch_failed",
        message: err?.message || "unknown",
        snippet: coerceTextSnippet(upstreamText),
      },
    };
  }
}

module.exports = {
  isDateKey,
  safeAddDays,
  coerceTextSnippet,
  tryParseStrictJson,
  validatePayload,
  executeAiSummary,
};
