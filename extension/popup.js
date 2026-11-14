"use strict";

const consentView = document.getElementById("consent-view");
const controlsView = document.getElementById("controls-view");
const consentButton = document.getElementById("consent-enable");
const enabledToggle = document.getElementById("enabled-toggle");
const enabledLabel = document.getElementById("enabled-label");
const pauseSiteToggle = document.getElementById("pause-site-toggle");
const pauseSiteLabel = document.getElementById("pause-site-label");
const protectionStatus = document.getElementById("protection-status");
const scannedCount = document.getElementById("scanned-count");
const scamCount = document.getElementById("scam-count");
const resumeButton = document.getElementById("resume-button");

let activeSiteHost = "";

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Extension service is unavailable."));
        return;
      }
      resolve(response);
    });
  });
}

function getActiveSiteHost() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs[0]?.url) {
        resolve("");
        return;
      }
      try {
        const host = new URL(tabs[0].url).hostname;
        resolve(
          host === "web.whatsapp.com" || host === "mail.google.com"
            ? host
            : "",
        );
      } catch {
        resolve("");
      }
    });
  });
}

function renderState(state) {
  if (!state.consentAccepted) {
    consentView.hidden = false;
    controlsView.hidden = true;
    return;
  }

  consentView.hidden = true;
  controlsView.hidden = false;
  enabledToggle.checked = state.enabled;
  enabledLabel.textContent = `Auto-protect: ${state.enabled ? "ON" : "OFF"}`;
  scannedCount.textContent = String(state.scannedToday);
  scamCount.textContent = String(state.scamsFoundToday);
  const isPaused = state.enabled && state.protectionPaused;
  protectionStatus.textContent = isPaused
    ? state.pauseMessage || "Protection paused. Resume when ready."
    : state.enabled
      ? "Protection is on."
      : "Protection is off.";
  resumeButton.hidden = !isPaused;
  pauseSiteToggle.disabled = !state.siteSupported;
  pauseSiteToggle.checked = state.isSitePaused;
  pauseSiteLabel.textContent = state.siteSupported
    ? `Pause on ${activeSiteHost}`
    : "Pause on this site (open WhatsApp Web or Gmail)";
}

async function refreshState() {
  const state = await sendMessage({
    type: "GET_STATE",
    siteHost: activeSiteHost,
  });
  renderState(state);
}

consentButton.addEventListener("click", async () => {
  consentButton.disabled = true;
  try {
    await sendMessage({ type: "SET_CONSENT" });
    await refreshState();
  } catch {
    protectionStatus.textContent = "Could not enable protection. Try again.";
  } finally {
    consentButton.disabled = false;
  }
});

enabledToggle.addEventListener("change", async () => {
  try {
    await sendMessage({
      type: "SET_ENABLED",
      enabled: enabledToggle.checked,
    });
    await refreshState();
  } catch {
    protectionStatus.textContent = "Could not update protection. Try again.";
  }
});

pauseSiteToggle.addEventListener("change", async () => {
  try {
    await sendMessage({
      type: "SET_SITE_PAUSED",
      siteHost: activeSiteHost,
      paused: pauseSiteToggle.checked,
    });
    await refreshState();
  } catch {
    protectionStatus.textContent = "Could not update this site's setting.";
  }
});

resumeButton.addEventListener("click", async () => {
  try {
    await sendMessage({ type: "RESUME" });
    await refreshState();
  } catch {
    protectionStatus.textContent = "Could not resume protection. Try again.";
  }
});

void (async () => {
  activeSiteHost = await getActiveSiteHost();
  try {
    await refreshState();
  } catch {
    protectionStatus.textContent = "Extension service is unavailable.";
  }
})();
