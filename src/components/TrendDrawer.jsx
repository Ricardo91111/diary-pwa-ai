// src/components/TrendDrawer.jsx
/** 趋势抽屉：展示最近 4 周任务趋势，只读。 */
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

// 图表几何常量（仅组件内使用）
const CHART_PLOT_TOP = 8;
const CHART_PLOT_HEIGHT = 72;
const CHART_LABEL_HEIGHT = 20;
const CHART_TOTAL_HEIGHT = CHART_PLOT_TOP + CHART_PLOT_HEIGHT + CHART_LABEL_HEIGHT;
const CHART_WIDTH = 280;

export default function TrendDrawer({ open, onClose, weeks }) {
  const rates = (weeks || []).map((w) => Number(w.completionRate) || 0);
  const hasTrendData =
    weeks.length > 0 && weeks.some((w) => (w.total || 0) > 0);

  let summaryText = "本周与近几周基本持平";
  if (rates.length < 2) {
    summaryText = "最近完成情况稳定记录中";
  } else {
    const first = rates[0];
    const last = rates[rates.length - 1];
    const deltaLast = rates[rates.length - 1] - rates[rates.length - 2];
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    if (last - first >= 10) summaryText = "近 4 周完成率整体上升";
    else if (last - first <= -10) summaryText = "近 4 周完成率整体回落";
    else if (deltaLast >= 8) summaryText = "本周较上周有所提升";
    else if (deltaLast <= -8) summaryText = "本周较上周有所回落";
    else if (max - min >= 25) summaryText = "近 4 周波动较明显";
  }

  const n = rates.length;
  const lastIdx = n - 1;
  const stepX = n <= 1 ? 0 : (CHART_WIDTH - 1) / (n - 1);
  const points = rates.map((r, i) => {
    const x = n <= 1 ? CHART_WIDTH / 2 : i * stepX;
    const y =
      CHART_PLOT_TOP + (CHART_PLOT_HEIGHT * (100 - Math.max(0, Math.min(100, r)))) / 100;
    return { x, y, rate: r };
  });
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const weekLabels =
    n <= 0
      ? []
      : rates.map((_, i) =>
          i === lastIdx ? "本周" : `第${i + 1}周`
        );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-label="关闭趋势"
          />
          <motion.div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            initial={{ y: 24 }}
            animate={{ y: 0 }}
            exit={{ y: 24 }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">趋势</h3>
                  <p className="mt-0.5 text-sm text-gray-500">最近 4 周任务趋势</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-500 bg-white active:scale-95 transition-transform"
                  onClick={onClose}
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 min-h-0 px-5 py-4 pb-8">
              <div className="space-y-4">
                {/* 完成率趋势卡片 */}
                <section className="rounded-2xl bg-slate-50 ring-1 ring-slate-100 ring-inset px-4 py-3">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">
                    完成率趋势
                  </h4>
                  {!hasTrendData ? (
                    <p className="text-sm text-gray-500 py-4">
                      最近 4 周暂无任务数据
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-gray-500 mb-3">{summaryText}</p>
                      <div className="flex justify-center">
                        <svg
                          width={CHART_WIDTH}
                          height={CHART_TOTAL_HEIGHT}
                          className="overflow-visible"
                          aria-hidden
                        >
                          <defs>
                            <linearGradient
                              id="trendLineGradient"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="0%"
                            >
                              <stop
                                offset="0%"
                                stopColor="rgb(99, 102, 241)"
                              />
                              <stop
                                offset="100%"
                                stopColor="rgb(129, 140, 248)"
                              />
                            </linearGradient>
                          </defs>
                          {/* 3 条浅灰辅助横线：0%、50%、100% */}
                          {[0, 50, 100].map((pct) => (
                            <line
                              key={pct}
                              x1={0}
                              y1={
                                CHART_PLOT_TOP +
                                (CHART_PLOT_HEIGHT * (100 - pct)) / 100
                              }
                              x2={CHART_WIDTH}
                              y2={
                                CHART_PLOT_TOP +
                                (CHART_PLOT_HEIGHT * (100 - pct)) / 100
                              }
                              stroke="rgb(226, 232, 240)"
                              strokeWidth="1"
                              strokeDasharray="2 2"
                            />
                          ))}
                          {points.length > 0 && (
                            <>
                              <polyline
                                fill="none"
                                stroke="url(#trendLineGradient)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={polylinePoints}
                              />
                              {points.map((p, i) => (
                                <circle
                                  key={i}
                                  cx={p.x}
                                  cy={p.y}
                                  r={i === lastIdx ? 5 : 3.5}
                                  fill={
                                    i === lastIdx
                                      ? "rgb(99, 102, 241)"
                                      : "rgb(129, 140, 248)"
                                  }
                                  stroke={
                                    i === lastIdx
                                      ? "rgb(255,255,255)"
                                      : "none"
                                  }
                                  strokeWidth={i === lastIdx ? 2 : 0}
                                />
                              ))}
                              {points.length > 0 && lastIdx >= 0 && (
                                <text
                                  x={points[lastIdx].x}
                                  y={Math.max(CHART_PLOT_TOP + 2, points[lastIdx].y - 12)}
                                  textAnchor="middle"
                                  className="fill-indigo-600 text-[10px] font-medium"
                                  style={{ fontSize: 10 }}
                                >
                                  {points[lastIdx].rate}%
                                </text>
                              )}
                              {weekLabels.map((label, i) => (
                                <text
                                  key={i}
                                  x={points[i]?.x ?? 0}
                                  y={CHART_PLOT_TOP + CHART_PLOT_HEIGHT + 14}
                                  textAnchor="middle"
                                  className="fill-gray-500 text-[10px] font-medium"
                                  style={{ fontSize: 10 }}
                                >
                                  {label}
                                </text>
                              ))}
                            </>
                          )}
                        </svg>
                      </div>
                    </>
                  )}
                </section>

                {weeks.map((week) => (
                  <section
                    key={`${week.start}-${week.end}`}
                    className="rounded-2xl bg-slate-50 ring-1 ring-slate-50 ring-inset p-4"
                  >
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">
                      {week.start} ~ {week.end}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">总任务</span>
                        <span className="ml-2 font-medium text-gray-900">{week.total}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">已完成</span>
                        <span className="ml-2 font-medium text-gray-900">{week.completed}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">完成率</span>
                        <span className="ml-2 font-medium text-gray-900">{week.completionRate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">活跃天数</span>
                        <span className="ml-2 font-medium text-gray-900">{week.activeDays}</span>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
