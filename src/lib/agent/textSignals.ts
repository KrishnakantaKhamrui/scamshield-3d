export function isNegatedAt(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 40), index);
  return /\b(?:do\s+not|don't|never|avoid|no)\s+(?:(?:please|ever|just)\s+)?(?:\w+\s+){0,3}$/i.test(
    prefix,
  );
}

export function hasPositiveMatch(text: string, pattern: RegExp): boolean {
  return Array.from(text.matchAll(pattern)).some(
    (match) => match.index !== undefined && !isNegatedAt(text, match.index),
  );
}

export function hasUpiCollectPinToReceive(text: string): boolean {
  const collectRequest =
    /\b(?:collect\s+(?:payment\s+)?request|approve\s+(?:the\s+)?(?:collect\s+)?request)\b/gi;
  const pinToReceive =
    /\b(?:enter|provide|share|tell|send|give)\b.{0,15}\b(?:upi\s+)?pin\b.{0,25}\bto\s+receive\b/gi;

  return (
    hasPositiveMatch(text, collectRequest) &&
    hasPositiveMatch(text, pinToReceive)
  );
}

export function hasPaidSocialTaskOffer(text: string): boolean {
  const paidSocialTask =
    /\b(?:like|liking|subscribe|subscribing|follow|following|watch|watching|rate|rating|review|reviewing)\b.{0,40}\b(?:youtube|videos?|instagram|facebook|posts?|reels?)\b|\b(?:youtube|videos?|instagram|facebook|posts?|reels?)\b.{0,40}\b(?:like|liking|subscribe|subscribing|follow|following|watch|watching|rate|rating|review|reviewing)\b/gi;
  const earningsPromised =
    /\b(?:earn(?:ing)?|income|paid|payment|commission)\b.{0,45}\b(?:\d[\d,]*|daily|per\s+day)\b/gi;
  const messagingGroup =
    /\b(?:telegram|whatsapp|signal)\b.{0,35}\b(?:group|channel|chat)\b|\b(?:group|channel|chat)\b.{0,35}\b(?:telegram|whatsapp|signal)\b/gi;

  return (
    hasPositiveMatch(text, paidSocialTask) &&
    hasPositiveMatch(text, earningsPromised) &&
    hasPositiveMatch(text, messagingGroup)
  );
}
