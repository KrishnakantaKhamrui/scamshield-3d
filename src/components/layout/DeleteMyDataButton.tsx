"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useScanStore } from "@/store/useScanStore";

export function DeleteMyDataButton() {
  const clearScans = useScanStore((state) => state.clearScans);
  const [failed, setFailed] = useState(false);

  function deleteData() {
    if (!window.confirm("Delete all saved scan data from this device?")) {
      return;
    }

    try {
      clearScans();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <button
        type="button"
        onClick={deleteData}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-xs font-medium text-muted underline decoration-border underline-offset-4 transition hover:text-status-scam focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Trash2 aria-hidden="true" size={14} />
        Delete my data
      </button>
      {failed && (
        <span role="alert" className="text-xs text-status-scam">
          Could not clear saved data from this browser. Check storage settings.
        </span>
      )}
    </span>
  );
}
