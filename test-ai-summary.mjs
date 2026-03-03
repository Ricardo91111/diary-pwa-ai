/**
 * 本地测试 AI 总结接口（需先启动后端 npm run dev:server）
 * 运行: node test-ai-summary.mjs
 */
const url = "http://localhost:8787/api/weekly-summary";
const payload = {
  range: { start: "2026-02-24", end: "2026-03-02" },
  stats: { total: 5, completed: 3, completionRate: 60, activeDays: 2 },
  days: [
    { date: "2026-02-24", weekdayLabel: "周一", tasks: [] },
    { date: "2026-02-25", weekdayLabel: "周二", tasks: [{ text: "写日记", isCompleted: true }] },
    { date: "2026-02-26", weekdayLabel: "周三", tasks: [] },
    { date: "2026-02-27", weekdayLabel: "周四", tasks: [{ text: "运动", isCompleted: false }] },
    { date: "2026-02-28", weekdayLabel: "周五", tasks: [] },
    { date: "2026-03-01", weekdayLabel: "周六", tasks: [] },
    { date: "2026-03-02", weekdayLabel: "周日", tasks: [] },
  ],
};

try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  console.log("status:", res.status);
  console.log("body:", JSON.stringify(data, null, 2));
  if (data.ok && data.result) {
    console.log("\nAI 总结接口正常。comment:", data.result.comment?.slice(0, 80) + "...");
  } else {
    console.log("\n接口返回异常或未返回 result。");
  }
} catch (e) {
  console.error("请求失败:", e.name, e.message);
}
