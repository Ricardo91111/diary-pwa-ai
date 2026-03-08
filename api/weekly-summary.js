const { validatePayload, executeAiSummary } = require("../shared/weekly-summary.js");

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

  const validation = validatePayload(payload);
  if (!validation.valid) {
    return sendJson(res, validation.statusCode, validation.body);
  }

  const result = await executeAiSummary(payload);
  if (result.ok) {
    return sendJson(res, 200, result.body);
  }
  return sendJson(res, result.statusCode, result.body);
};
