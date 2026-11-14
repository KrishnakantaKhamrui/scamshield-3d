"use strict";

const processedMessages = new WeakSet();
const pendingMessages = new Set();
let flushTimer = null;
let scanInProgress = false;

function isVisible(element) {
  return (
    element instanceof HTMLElement &&
    element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden"
  );
}

function getWhatsAppMessages(root) {
  const nodes = [];
  if (
    root instanceof Element &&
    root.matches(".message-in")
  ) {
    nodes.push(root);
  }
  if (root instanceof ParentNode) {
    nodes.push(...root.querySelectorAll(".message-in"));
  }
  return nodes;
}

function getGmailMessages(root) {
  const nodes = [];
  if (
    root instanceof Element &&
    root.matches("[role='main'] .a3s.aiL")
  ) {
    nodes.push(root);
  }
  if (root instanceof ParentNode) {
    nodes.push(...root.querySelectorAll("[role='main'] .a3s.aiL"));
  }
  return nodes;
}

function currentGmailUser() {
  const account =
    document.querySelector(
      '[aria-label^="Google Account:"], [aria-label^="Google Account "]',
    ) || document.querySelector("#gb [data-email]");
  const raw =
    account?.getAttribute("data-email") ||
    account?.getAttribute("aria-label") ||
    "";
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : "";
}

function isIncomingMessage(element) {
  if (location.hostname === "web.whatsapp.com") {
    return (
      element.matches(".message-in") &&
      !element.closest(".message-out") &&
      !element.querySelector(".scamshield-badge")
    );
  }

  if (location.hostname === "mail.google.com") {
    const message = element.closest(".h7") || element.closest(".gs") || element;
    const sender = message.querySelector(".gD[email], [email]");
    const senderEmail = sender?.getAttribute("email")?.toLowerCase() || "";
    const ownEmail = currentGmailUser();
    return Boolean(senderEmail && ownEmail && senderEmail !== ownEmail);
  }

  return false;
}

function visibleText(element) {
  if (!isVisible(element)) {
    return "";
  }
  const content =
    location.hostname === "web.whatsapp.com"
      ? element.querySelector(".selectable-text") || element
      : element;
  return (content.innerText || content.textContent || "").trim();
}

function maskLightly(text) {
  return text
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/gi, "[PAN]")
    .replace(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, "[CARD]")
    .replace(/(?<!\d)(?:\d[ -]?){11}\d(?!\d)/g, "[AADHAAR]")
    .replace(/(?<!\d)(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?)?[6-9]\d(?:[ .-]?\d){8}(?!\d)/g, "[PHONE]")
    .replace(
      /\b(?:otp|one[- ]time(?: password| code)?|verification code|security code|pin|cvv)\b[^0-9]{0,24}\d{4,8}\b/gi,
      (match) => match.replace(/\d{4,8}/g, "[OTP]"),
    )
    .replace(
      /\b\d{4,8}\b(?=[^.!?\n]{0,24}\b(?:otp|one[- ]time|verification code|security code|pin|cvv)\b)/gi,
      "[OTP]",
    );
}

function requestAnalysis(text) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          ok: false,
          paused: true,
          message: "Protection paused because the extension service is unavailable.",
        });
        return;
      }
      resolve(response || { ok: false, message: "No analysis response." });
    });
  });
}

function showFailure(element, message) {
  const badge = document.createElement("span");
  badge.className = "scamshield-badge scamshield-paused";
  badge.textContent = message.startsWith("The extension limit")
    ? "Scan limit reached"
    : "Protection paused";
  element.insertAdjacentElement("afterend", badge);
}

function showResult(element, maskedText, verdict) {
  const badge = document.createElement("button");
  badge.className = `scamshield-badge scamshield-${verdict.label}`;
  badge.type = "button";
  badge.textContent =
    verdict.label === "safe"
      ? "Safe"
      : `${verdict.label === "scam" ? "Scam" : "Suspicious"} ${Math.round(verdict.score)}`;
  badge.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.className = "scamshield-panel";
  panel.hidden = true;

  const heading = document.createElement("strong");
  heading.textContent = `${verdict.scamType} · ${Math.round(verdict.score)}/100`;
  panel.appendChild(heading);

  const reasons = document.createElement("ul");
  for (const reason of verdict.reasons.slice(0, 3)) {
    const item = document.createElement("li");
    item.textContent = reason;
    reasons.appendChild(item);
  }
  panel.appendChild(reasons);

  const reportLink = document.createElement("a");
  reportLink.href = `${globalThis.SCAMSHIELD_CONFIG.apiOrigin}${globalThis.SCAMSHIELD_CONFIG.appPath}`;
  reportLink.target = "_blank";
  reportLink.rel = "noopener noreferrer";
  reportLink.textContent = "Full report";
  panel.appendChild(reportLink);

  badge.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    badge.setAttribute("aria-expanded", String(!panel.hidden));
  });

  element.insertAdjacentElement("afterend", panel);
  element.insertAdjacentElement("afterend", badge);
}

function addCandidate(element) {
  if (isIncomingMessage(element) && isVisible(element)) {
    pendingMessages.add(element);
  }
}

async function flushQueue() {
  if (scanInProgress) {
    return;
  }
  scanInProgress = true;

  try {
    while (pendingMessages.size > 0) {
      const element = pendingMessages.values().next().value;
      pendingMessages.delete(element);
      if (
        !(element instanceof HTMLElement) ||
        !element.isConnected ||
        processedMessages.has(element) ||
        !isIncomingMessage(element)
      ) {
        continue;
      }

      const state = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { type: "GET_STATE", siteHost: location.hostname },
          (response) => resolve(chrome.runtime.lastError ? null : response),
        );
      });
      if (
        !state ||
        !state.consentAccepted ||
        !state.enabled ||
        state.protectionPaused ||
        state.isSitePaused
      ) {
        continue;
      }

      const text = visibleText(element);
      if (text.length < 20) {
        processedMessages.add(element);
        continue;
      }

      processedMessages.add(element);
      const maskedText = maskLightly(text).slice(0, 6000);
      const response = await requestAnalysis(maskedText);
      if (response?.ok && response.verdict) {
        showResult(element, maskedText, response.verdict);
      } else if (response?.paused || response?.message?.startsWith("The extension limit")) {
        showFailure(element, response.message || "Protection paused");
      }
    }
  } finally {
    scanInProgress = false;
  }
}

function scheduleFlush() {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, 350);
}

function collectMessages(root) {
  const messages =
    location.hostname === "web.whatsapp.com"
      ? getWhatsAppMessages(root)
      : getGmailMessages(root);
  for (const message of messages) {
    addCandidate(message);
  }
  if (messages.length > 0) {
    scheduleFlush();
  }
}

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof Element) {
        collectMessages(node);
      }
    }
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});
collectMessages(document);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName === "local" &&
    ((changes.enabled?.newValue === true &&
      changes.consentAccepted?.newValue === true) ||
      changes.pausedSites)
  ) {
    collectMessages(document);
  }
});
