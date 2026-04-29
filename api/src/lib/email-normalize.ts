/**
 * Email normalization for fraud-prevention purposes.
 *
 * Goal: collapse aliases that go to the SAME inbox into one canonical
 * form, so a user can't trivially create multiple "different" accounts
 * by playing with dots and `+` aliases.
 *
 * Gmail / Googlemail rules (per Google's official policy):
 *   · Dots in the local part are ignored:
 *       j.o.h.n@gmail.com  ≡ john@gmail.com
 *   · Plus aliases are stripped:
 *       john+spam@gmail.com  ≡ john@gmail.com
 *   · googlemail.com is an alias of gmail.com
 *
 * Other providers (Yahoo, Outlook, Proton, Apple, Fastmail…):
 *   We DON'T apply the dot/alias rules — most either don't support them
 *   or treat dots as significant. We just lowercase the whole address.
 *
 * The result is stored in `users.email_normalized` (UNIQUE) so the
 * canonical form is the matching key for de-dup, while the original
 * `email` keeps the user's typed casing for emails / display.
 */
export function normalizeEmail(email: string): string {
    const trimmed = email.trim();
    const at = trimmed.lastIndexOf("@");
    if (at < 0) return trimmed.toLowerCase();

    const local = trimmed.slice(0, at).toLowerCase();
    const domain = trimmed.slice(at + 1).toLowerCase();

    if (domain === "gmail.com" || domain === "googlemail.com") {
        // Strip everything after `+`, then strip dots.
        const stripped = local.split("+")[0]!.replace(/\./g, "");
        return `${stripped}@gmail.com`;
    }

    return `${local}@${domain}`;
}
