const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { validatePayload, executeAiSummary } = require("../shared/weekly-summary.js");
const { validatePayload: validateMonthlyPayload, executeAiSummary: executeMonthlyAiSummary } = require("../shared/monthly-summary.js");

dotenv.config();

const app = express();

app.use(express.json({ limit: "50kb" }));

app.use(
  cors({
    origin: "http://localhost:5173",
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/weekly-summary", async (req, res) => {
  const validation = validatePayload(req.body);
  if (!validation.valid) {
    return res.status(validation.statusCode).json(validation.body);
  }

  const result = await executeAiSummary(req.body);
  if (result.ok) {
    return res.json(result.body);
  }
  return res.status(result.statusCode).json(result.body);
});

app.post("/api/monthly-summary", async (req, res) => {
  const validation = validateMonthlyPayload(req.body);
  if (!validation.valid) {
    return res.status(validation.statusCode).json(validation.body);
  }
  const result = await executeMonthlyAiSummary(req.body);
  if (result.ok) {
    return res.json(result.body);
  }
  return res.status(result.statusCode).json(result.body);
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${port}`);
});
