import {
  hasPaidSocialTaskOffer,
  hasPositiveMatch,
  hasUpiCollectPinToReceive,
  isNegatedAt,
} from "@/lib/agent/textSignals";

export interface SenderCheckResult {
  score: number;
  flags: string[];
}

export function checkSender(text: string): SenderCheckResult {
  const flags: string[] = [];
  let score = 0;

  function addFlag(flag: string, points: number): void {
    if (!flags.includes(flag)) {
      flags.push(flag);
      score = Math.min(100, score + points);
    }
  }

  const upiCollectRequest =
    /\b(?:collect\s+(?:payment\s+)?request|approve\s+(?:the\s+)?(?:collect\s+)?request|enter\s+(?:your\s+)?(?:upi\s+)?pin\s+to\s+receive)\b/gi;
  if (hasUpiCollectPinToReceive(text)) {
    addFlag("Combines a UPI collect request with a PIN-to-receive request", 80);
  } else if (hasPositiveMatch(text, upiCollectRequest)) {
    addFlag("UPI collect request or PIN-to-receive language", 25);
  }

  if (
    hasPositiveMatch(
      text,
      /\b(?:share|send|tell|provide|read\s+out|enter|give|reveal)\s+(?:(?:me|your|the)\s+)?(?:one[- ]time\s+password|otp|(?:upi\s+)?pin|cvv|password|passcode|security\s+code)\b/gi,
    )
  ) {
    if (
      !/\bshare\s+(?:the\s+)?otp\b.{0,30}\bonly\s+with\s+(?:the\s+)?(?:driver|delivery\s+person)\b/i.test(
        text,
      )
    ) {
      addFlag("Requests a one-time code or account credential", 30);
    }
  }

  if (
    hasPositiveMatch(
      text,
      /\b(?:install|download|set\s+up)\b.{0,35}\b(?:anydesk|teamviewer|app|application|[\w-]+\.apk)\b|\b[\w-]+\.apk\b/gi,
    )
  ) {
    addFlag("Asks to install a remote-access app or APK", 20);
  }

  const phonePattern =
    /(?<![A-Za-z0-9])(?:\+91[ -]?|0[ -]?)?[6-9](?:[ -]?\d){9}(?!\d)/g;
  for (const match of text.matchAll(phonePattern)) {
    const context = text.slice(
      Math.max(0, match.index - 45),
      Math.min(text.length, match.index + match[0].length + 45),
    );
    if (
      /\b(?:officer|call\s+immediately|contact\s+immediately|call\s+this\s+number)\b/i.test(
        context,
      ) &&
      !isNegatedAt(text, match.index)
    ) {
      addFlag("Provides a phone number for an urgent officer contact", 20);
      break;
    }
  }

  const paymentDemand =
    /\b(?:pay|send|transfer|deposit|remit|payment|money)\b/gi;
  const urgency = /\b(?:urgent(?:ly)?|immediately|right\s+now|today|abhi|turant|jaldi)\b/i;
  const personalAccount =
    /\b(?:personal|my|your)\s+(?:bank\s+)?(?:account|upi(?:\s+id)?)\b|\b[\w.-]+@[\w.-]+\b/i;
  if (
    urgency.test(text) &&
    personalAccount.test(text) &&
    hasPositiveMatch(text, paymentDemand)
  ) {
    addFlag("Urgent payment to a personal account or UPI ID", 25);
  }

  const authority =
    /\b(?:cbi|police|customs|rbi|trai|income\s+tax)\b/i;
  if (authority.test(text) && hasPositiveMatch(text, paymentDemand)) {
    addFlag("Authority impersonation combined with a payment demand", 35);
  }

  if (
    /\b(?:do\s+not\s+tell\s+anyone|don't\s+tell\s+anyone|tell\s+no\s+one|keep\s+(?:this\s+)?(?:it\s+)?secret|do\s+not\s+disconnect|don't\s+disconnect|kisi\s+ko\s+mat\s+batana)\b/i.test(
      text,
    )
  ) {
    addFlag("Demands secrecy or staying on the call", 20);
  }

  if (hasPaidSocialTaskOffer(text)) {
    addFlag("Promotes paid social-media tasks through a messaging group", 75);
  }

  return { score, flags };
}
