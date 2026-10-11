// The text a merchant pastes into their coding agent to wire the webhook so a paying customer gets access and Blindspot can check it (PRD D21, INTERVIEWS P11).
// Razorpay already hands merchants a prompt in place of the docs. This is the one Blindspot would add to it. Each numbered rule closes a failure the product finds:
// 1 the 401 (signature), 2 duplicate grants, 3 the 200 that grants nothing, 4 the silence nobody notices, 5 a test event that must not grant a real customer anything.
// BLINDSPOT_API and the acknowledgement route are placeholders: nothing like them exists at Razorpay yet.
export const CONNECT_PROMPT = `You are wiring a Razorpay webhook handler so that a customer who pays gets what they paid for, and so that Blindspot can check it.

Context: our app sells access (a plan, a course, a test series). Razorpay sends a signed POST to our webhook when a payment is captured. Today a failure here is silent: the customer is charged and gets nothing, and we find out from a support ticket days later.

Do this in the existing webhook route (create one if there is none):

1. Verify the X-Razorpay-Signature header against the raw request body, using the webhook secret from the environment variable RAZORPAY_WEBHOOK_SECRET. Never hard-code or log the secret. Reply 401 only when the signature is wrong.

2. Handle payment.captured and order.paid. Razorpay sends both for one payment. Use the X-Razorpay-Event-Id header to make the handler safe to repeat: the same event id grants access once and is acknowledged every time.

3. Grant the customer access in our own database FIRST. Only after the grant is saved, reply 200. Never reply 200 before the grant, and never let an error after the reply go unnoticed.

4. After granting, send the fulfilment acknowledgement: POST {BLINDSPOT_API}/acknowledgements, where BLINDSPOT_API is the base URL read from the environment variable BLINDSPOT_API (never hard-coded), with JSON { "payment_id", "event_id", "access_granted_at" }. If that call fails, log it and still reply 200. It must never block the grant.

5. Test events: if the payment notes contain blindspot_test = "true", do every step above EXCEPT the grant (never give a real customer access because of a test), and send the acknowledgement with "test": true and without access_granted_at, because nothing was granted.

6. On any unexpected error reply 500 so Razorpay retries. Write a test for each of: a bad signature, a repeated event id, a failed grant, and a test event.

When you are done, show me the diff and the command that runs the tests. Do not change anything else.`

// What each rule is for, in the order of the prompt: the failure it closes and where the product shows that failure.
export const CONNECT_WHY: { rule: string; closes: string; seen: string }[] = [
  { rule: 'Verify the signature with the secret from the environment', closes: 'A handler that rejects real payments with a 401 because the secret is wrong or missing.', seen: 'The go-live check step "It accepts a signed event"' },
  { rule: 'Make each event id safe to repeat', closes: 'Razorpay sends two events per payment and retries a failure for about 23 hours, so the same payment arrives several times.', seen: 'Nowhere yet. It is a safety rule, not something the product shows' },
  { rule: 'Grant first, then reply 200', closes: 'A handler that answers 200 and grants nothing. Razorpay sees a success, so nobody is alerted.', seen: 'The go-live check step "It grants access and says so", and the customers in INC-1 where the server said OK and granted nothing' },
  { rule: 'Send the fulfilment acknowledgement', closes: 'Silence. With it, Blindspot sees the gap between a captured payment and access within minutes, not from a ticket.', seen: 'The webhook-health monitor and the access reconciler' },
  { rule: 'Treat a marked event as a test', closes: 'A check that would otherwise give a real customer access.', seen: 'The go-live check, which says its test event never grants anyone anything' },
]
