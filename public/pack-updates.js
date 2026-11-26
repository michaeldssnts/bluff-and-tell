export function launchSignup() {
  return `<section class="pack-launch" aria-labelledby="pack-launch-title"><div><span class="eyebrow">THE PARTY’S JUST GETTING STARTED</span><h2 id="pack-launch-title">More packs. More mischief.</h2><p>New expansion packs land in the new year. Want first dibs?</p></div><form id="pack-updates-form"><label for="updates-email">Your email</label><div class="updates-row"><input id="updates-email" name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"><button class="button primary" type="submit">Keep me posted</button></div><label class="updates-consent"><input name="consent" type="checkbox" required> <span>Email me about new Bluff &amp; Tell expansion packs. I can unsubscribe anytime.</span></label><div class="updates-honey" aria-hidden="true"><label>Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div><p class="updates-status" role="status" aria-live="polite"></p><small>Optional. No account needed to play. <a href="/updates">Manage pack emails</a></small></form></section>`;
}
export async function submitPackUpdates(form, unsubscribe = false) {
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('[role="status"]');
  if (button.disabled) return;
  button.disabled = true;
  status.textContent = "One moment…";
  try {
    const response = await fetch(
      "/api/pack-updates" + (unsubscribe ? "/unsubscribe" : ""),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.elements.email.value,
          consent: form.elements.consent?.checked === true,
          website: form.elements.website?.value ?? "",
        }),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw Error(data.error || "Couldn’t save that. Try again.");
    form.reset();
    status.textContent = unsubscribe
      ? "You’re off the list. You can still join every game."
      : "You’re on the list! We’ll confirm your email before sending pack updates.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}
if (document.querySelector("#unsubscribe-form"))
  document
    .querySelector("#unsubscribe-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();
      submitPackUpdates(event.target, true);
    });
