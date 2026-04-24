# Clause Fair Use — plan Unlimited

Paragraphe à intégrer dans les CGU de tempaloo.com (section "Limites d'usage" ou
"Plan Unlimited") **avant la commercialisation publique du plan Unlimited**.

Validé 2026-04-24 dans `plan-de-travail.md` §4.3.

---

## Version FR

> **Plan Unlimited — usage équitable.** Le plan Unlimited inclut un volume
> mensuel de conversions d'images sans plafond strict. Toutefois, un seuil
> indicatif d'usage équitable est fixé à **500 000 conversions par mois et par
> licence**. Au-delà de ce seuil, Tempaloo se réserve le droit de prendre
> contact avec le client afin d'évaluer la nature du trafic et, le cas
> échéant, de proposer une offre adaptée. Aucune coupure automatique de
> service n'intervient. En cas d'usage manifestement abusif (notamment :
> robots de crawl massifs, revente de l'API en marque blanche, utilisation
> non liée à un site WordPress légitime), Tempaloo se réserve le droit de
> limiter le débit (rate limiting) ou de suspendre l'accès, après notification
> écrite préalable de 7 jours sauf urgence opérationnelle.

## English version

> **Unlimited plan — fair use.** The Unlimited plan includes monthly image
> conversions without a hard cap. A fair-use guideline of **500,000
> conversions per month per license** applies. Beyond this threshold,
> Tempaloo may contact the customer to discuss traffic patterns and, where
> appropriate, propose a tailored plan. No service is interrupted
> automatically. In the event of manifestly abusive use (e.g. mass scraping
> bots, white-label resale of the API, use unrelated to a legitimate
> WordPress site), Tempaloo reserves the right to apply rate limiting or
> suspend access, with at least 7 days' prior written notice except in
> operational emergencies.

---

## Liens cohérents à mettre à jour le jour de la publication

- `web/app/webp/page.tsx` (landing) — lien "Fair use policy" dans le footer.
- `plugin/tempaloo-webp/admin-app/src/pages/Upgrade.tsx` — petit lien sous la
  card Unlimited "*Subject to fair use*".
- `docs/freemius-setup.md` §9.5 — référence à cette clause.

## Quand publier

À publier **avant** le premier client Unlimited payant. Le watcher
`api/src/jobs/unlimited-watch.ts` envoie déjà l'alerte interne au-delà du
seuil ; sans CGU publiée, on n'a aucune base légale pour une éventuelle
limitation contractuelle.
