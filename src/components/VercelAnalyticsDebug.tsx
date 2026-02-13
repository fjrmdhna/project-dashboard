"use client";

import { useEffect } from "react";

const DEBUG_ENDPOINT = "http://127.0.0.1:7242/ingest/1be55c0d-1a66-492c-a67d-c31e2ed19dd1";

function sendLog(payload: Record<string, unknown>) {
  fetch(DEBUG_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
}

export function VercelAnalyticsDebug({ analyticsInLayout }: { analyticsInLayout: boolean }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // #region agent log
    sendLog({
      location: "VercelAnalyticsDebug.tsx:mount",
      message: "Vercel Analytics layout check",
      data: { analyticsInLayout, env: "client" },
      hypothesisId: "H2",
    });
    // #endregion
  }, [analyticsInLayout]);

  return null;
}
