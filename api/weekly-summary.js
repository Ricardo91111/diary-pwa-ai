const isDateKey = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const safeAddDays = (dateStr, deltaDays) => {
  const [y, m, d] = dateStr.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  const yy = dt.getFullYear();
  const mm = `${dt.getMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

const coerceTextSnippet = (s, max = 220) => {
  if (typeof s !== "string") return "";
  return s.replace(/\s+/g, " ").trim().slice(0, max);
};

const tryParseStrictJson = (raw) => {
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
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, data) {
  res.setHeader("Content-Type", "application/json");
  res.status(status).json(data);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return sendJson(res, 400, { ok: false, error: "invalid_payload" });
    }
  }
  if (!payload || typeof payload !== "object") {
    return sendJson(res, 400, { ok: false, error: "invalid_payload" });
  }

  const { range, stats, days } = payload;

  if (
    !range ||
    typeof range !== "object" ||
    !isDateKey(range.start) ||
    !isDateKey(range.end)
  ) {
    return sendJson(res, 400, { ok: false, error: "invalid_range" });
  }

  if (
    !stats ||
    typeof stats !== "object" ||
    typeof stats.total !== "number" ||
    typeof stats.completed !== "number" ||
    typeof stats.completionRate !== "number"
  ) {
    return sendJson(res, 400, { ok: false, error: "invalid_stats" });
  }

  if (!Array.isArray(days) || days.length < 1 || days.length > 7) {
    return sendJson(res, 400, { ok: false, error: "invalid_days" });
  }

  for (const d of days) {
    if (!d || typeof d !== "object" || !isDateKey(d.date) || !Array.isArray(d.tasks)) {
      return sendJson(res, 400, { ok: false, error: "invalid_days_item" });
    }
    if (typeof d.weekdayLabel !== "string") {
      return sendJson(res, 400, { ok: false, error: "invalid_weekdayLabel" });
    }
    if (d.tasks.length > 200) {
      return sendJson(res, 400, { ok: false, error: "too_many_tasks" });
    }
    for (const t of d.tasks) {
      if (
        !t ||
        typeof t !== "object" ||
        typeof t.text !== "string" ||
        typeof t.isCompleted !== "boolean"
      ) {
        return sendJson(res, 400, { ok: false, error: "invalid_task" });
      }
    }
  }

  const expectedDates = Array.from({ length: 7 }, (_, i) => safeAddDays(range.end, i - 6));
  const expectedSet = new Set(expectedDates);
  if (!expectedSet.has(range.start) || !expectedSet.has(range.end)) {
    return sendJson(res, 400, { ok: false, error: "range_not_7_days" });
  }

  const AI_BASE_URL = process.env.AI_BASE_URL;
  const AI_API_KEY = process.env.AI_API_KEY;
  const AI_MODEL = process.env.AI_MODEL;

  if (!AI_BASE_URL || !AI_API_KEY || !AI_MODEL) {
    return sendJson(res, 500, { ok: false, error: "missing_ai_env" });
  }

  const url = `${AI_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  const system = [
    "你是一个高质量的周报总结助手。",
    "你必须只输出一个可 JSON.parse 的纯 JSON 对象，不要输出 Markdown，不要输出多余文字。",
    '输出格式严格为：{"comment":"...","highlights":["..."],"suggestions":["..."]}',
    "comment 为 2-4 句中文总结；highlights 3-6 条；suggestions 3-6 条。",
  ].join("\n");

  const user = {
    range,
    stats,
    days,
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
      return sendJson(res, 502, {
        ok: false,
        error: "upstream_error",
        status: r.status,
        snippet: coerceTextSnippet(upstreamText),
      });
    }

    let data;
    try {
      data = JSON.parse(upstreamText);
    } catch {
      console.error("[weekly-summary] DashScope 响应非 JSON:", coerceTextSnippet(upstreamText, 400));
      return sendJson(res, 502, {
        ok: false,
        error: "upstream_non_json",
        snippet: coerceTextSnippet(upstreamText),
      });
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
      return sendJson(res, 502, {
        ok: false,
        error: "bad_ai_json",
        snippet: coerceTextSnippet(content ?? upstreamText),
      });
    }

    return sendJson(res, 200, {
      ok: true,
      result: {
        comment: parsed.comment,
        highlights: parsed.highlights,
        suggestions: parsed.suggestions,
      },
    });
  } catch (err) {
    console.error("[weekly-summary] 请求 DashScope 异常:", err?.message, err?.cause);
    return sendJson(res, 502, {
      ok: false,
      error: "fetch_failed",
      message: err?.message || "unknown",
      snippet: coerceTextSnippet(upstreamText),
    });
  }
}
