"use client";

import { useState } from "react";
import SalonDashboardHeader from "@/components/layout/SalonDashboardHeader";
import SalonSidebar from "@/components/layout/SalonSidebar";

type SettingKey =
  | "onlineBookingEnabled"
  | "reminderEmails"
  | "vipAccessControls"
  | "marketingConsentPrompts";

const initialSettings: Record<SettingKey, boolean> = {
  onlineBookingEnabled: true,
  reminderEmails: true,
  vipAccessControls: false,
  marketingConsentPrompts: true,
};

const settingLabels: Record<SettingKey, string> = {
  onlineBookingEnabled: "Online booking enabled",
  reminderEmails: "Reminder emails",
  vipAccessControls: "VIP access controls",
  marketingConsentPrompts: "Marketing consent prompts",
};

export default function SalonSettingsPage() {
  const [settings, setSettings] = useState<Record<SettingKey, boolean>>(
    initialSettings
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const updateSetting = (key: SettingKey, value: boolean) => {
    setSettings((currentSettings) => ({
      ...currentSettings,
      [key]: value,
    }));
    setHasChanges(true);
    setSaveMessage("");
  };

  const handleSave = () => {
    setHasChanges(false);
    setSaveMessage("Settings saved locally.");
  };

  return (
    <>
      <SalonDashboardHeader />
      <main className="min-h-screen bg-[#fff9fb] text-[#2b1b25]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[230px_1fr] lg:px-8">
          <SalonSidebar />

          <section className="space-y-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d84b87]">
                Settings
              </p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                Salon preferences
              </h1>
            </div>

            <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">Profile</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-[#fff9fb] p-4">
                  <p className="text-sm text-[#6d5863]">Salon name</p>
                  <p className="mt-2 text-lg font-bold">Aura Studio</p>
                </div>
                <div className="rounded-2xl bg-[#fff9fb] p-4">
                  <p className="text-sm text-[#6d5863]">Location</p>
                  <p className="mt-2 text-lg font-bold">Belagavi, Karnataka</p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-[#f0dce5] bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold">Preferences</h2>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges}
                  className="rounded-full bg-[#d84b87] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#bf356e] disabled:cursor-not-allowed disabled:bg-[#e8c5d6] disabled:text-white/80"
                >
                  Save changes
                </button>
              </div>

              {saveMessage ? (
                <p className="mt-4 rounded-2xl border border-[#d1f3dc] bg-[#ecfdf5] px-4 py-3 text-sm font-medium text-[#155f3b]">
                  {saveMessage}
                </p>
              ) : null}

              <div className="mt-5 space-y-4">
                {(Object.keys(settingLabels) as SettingKey[]).map((key) => {
                  const value = settings[key];

                  return (
                    <div
                      key={key}
                      className="flex flex-col gap-3 rounded-2xl bg-[#fff9fb] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p className="font-medium text-[#2b1b25]">
                        {settingLabels[key]}
                      </p>

                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex min-w-12 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            value
                              ? "bg-[#fce8f3] text-[#b42273]"
                              : "bg-[#f1e8ec] text-[#6d5863]"
                          }`}
                        >
                          {value ? "On" : "Off"}
                        </span>

                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            aria-label={settingLabels[key]}
                            checked={value}
                            onChange={(event) =>
                              updateSetting(key, event.target.checked)
                            }
                            className="peer sr-only"
                          />
                          <span
                            className={`inline-flex h-6 w-11 items-center rounded-full transition ${
                              value ? "bg-[#d84b87]" : "bg-[#e7dfe6]"
                            }`}
                          >
                            <span
                              className={`ml-1 h-4 w-4 rounded-full bg-white transition ${
                                value ? "translate-x-5" : "translate-x-0"
                              }`}
                            />
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
