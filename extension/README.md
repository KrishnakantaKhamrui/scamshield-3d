# ScamShield Auto-protect (prototype)

This Manifest V3 Chrome extension is off until the user accepts the consent
screen. When enabled, it checks visible incoming text on WhatsApp Web and Gmail
and displays a small verdict badge.

## Load unpacked

1. In `constants.js`, set `apiOrigin` to the exact ScamShield web origin.
2. Set the same origin in `manifest.json` under `host_permissions`. The supplied
   development default is `http://localhost:3000`.
3. Open `chrome://extensions`, enable **Developer mode**, choose **Load
   unpacked**, and select this `extension` folder.
4. Copy the extension ID shown by Chrome. Set `CHROME_EXTENSION_ID` to that ID
   in the app's `.env.local` and deployment environment, then restart or
   redeploy the app.
5. Open WhatsApp Web or Gmail, select the extension, review the consent
   explanation, and explicitly enable Auto-protect.

The endpoint only accepts the configured `chrome-extension://<ID>` origin.
The extension ID can change if the unpacked extension is re-created or moved;
update the environment value and reload/redeploy when that happens.

## What is collected

While Auto-protect is on, the content script reads visible incoming message
text on the two supported sites. It masks common phone, Aadhaar, PAN, card, and
OTP patterns in the browser, then sends the masked text to the configured
ScamShield server for analysis. The server applies the normal Privacy Shield
and pipeline again. Raw message text is not intentionally stored by the
extension or returned in the verdict. The extension stores a random
installation token, daily counters, and a bounded cache keyed by SHA-256 of
the masked text; the cache contains only compact verdicts, not message text.

Masking is pattern-based and can miss personal information. Do not enable this
on messages you are not comfortable sending, even in masked form. The install
token identifies a local installation for rate limiting; it is not an account
credential.

## Limits

WhatsApp Web and Gmail can change their DOM without notice. Gmail sender
identification is deliberately conservative and may skip messages when the
signed-in sender cannot be determined. This is a prototype, not a guarantee of
scam detection. Use the web app and official reporting channels for important
decisions.
