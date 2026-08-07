-- =============================================================================
-- 001  Stars for Peace - the first campaign built natively in Brill Ops
-- =============================================================================
-- STATUS: draft, with placeholder values.
--
-- No Stars for Peace material was supplied with the handoff. The Assets/,
-- Branding/ and Ideas for Future/ folders in the package were empty. Rather than
-- invent a campaign and let the invention harden into fact, this seed creates the
-- record in 'draft' with every unknown explicitly marked.
--
-- TO GO LIVE, edit the values below and flip status to 'active':
--   * name / description        - real campaign copy
--   * start_date / end_date     - real dates (the homepage countdown reads end_date)
--   * hero_image_url            - upload to the campaign-media bucket first
--   * brand_colour              - campaign accent
--   * confidence                - set to 'source' once the values are real
--
-- Only one campaign may be 'active' at a time (enforced by a partial unique index),
-- so archive or draft the current one before activating this.
-- =============================================================================

begin;

insert into campaigns (
  id, slug, name, short_name, description, status,
  start_date, end_date, hero_image_url, brand_colour, config,
  confidence, source_reference
)
values (
  '00000000-0000-4000-b000-000000000002',
  'stars-for-peace',
  'Stars for Peace',
  'Stars for Peace',
  'PLACEHOLDER. A global crossfaction Ingress campaign in which communities build ' ||
  'link stars together as a shared statement. Real campaign copy has not been supplied yet.',
  'draft',
  null,   -- start_date  : unknown
  null,   -- end_date    : unknown; drives the homepage countdown
  null,   -- hero_image  : none supplied
  '#2563eb',
  jsonb_build_object(
    'metric_label',   'links created',
    'supports_teams', true,
    'is_placeholder', true,
    'todo', jsonb_build_array(
      'Set real start_date and end_date',
      'Upload hero image to the campaign-media bucket and set hero_image_url',
      'Write the real description and community invitation',
      'Confirm brand colour',
      'Set status to active'
    )
  ),
  'estimated',
  jsonb_build_object(
    'basis', 'No Stars for Peace material was present in the handoff package. ' ||
             'Assets/, Branding/ and Ideas for Future/ were empty directories.',
    'see',   'docs/import/assumptions-and-inferred-data.md'
  )
)
on conflict (slug) do nothing;

commit;
