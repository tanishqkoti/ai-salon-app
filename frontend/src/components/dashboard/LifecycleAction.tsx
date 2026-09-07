"use client";

import { useState } from "react";

type Props = {
  actionLabel: "Archive customer" | "Deactivate staff" | "Archive service";
  onConfirm: () => Promise<void>;
};

export default function LifecycleAction({ actionLabel, onConfirm }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setIsSubmitting(true);
    setError("");
    try {
      await onConfirm();
      setIsOpen(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : `Unable to ${actionLabel.toLowerCase()}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setError(""); setIsOpen(true); }}
        className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
      >
        {actionLabel}
      </button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2b1b25]/40 px-4 py-8">
          <div role="dialog" aria-modal="true" aria-labelledby="lifecycle-action-title" className="w-full max-w-md rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-xl">
            <h2 id="lifecycle-action-title" className="text-2xl font-bold">{actionLabel}</h2>
            <p className="mt-3 text-sm leading-6 text-[#6d5863]">This keeps historical records intact while removing this item from new booking choices.</p>
            {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={isSubmitting} onClick={() => setIsOpen(false)} className="rounded-full border border-[#e9d4df] px-4 py-2 text-sm font-semibold text-[#6d5863] disabled:opacity-60">Cancel</button>
              <button type="button" disabled={isSubmitting} onClick={handleConfirm} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? (actionLabel.startsWith("Archive") ? "Archiving..." : "Deactivating...") : actionLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
