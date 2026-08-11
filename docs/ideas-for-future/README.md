# Ideas for Future

The `Ideas for Future/` folder in the handoff package was empty.

Kept as a location for forward-looking notes. Open items already identified during setup:

- **Claiming an agent handle.** `agents.is_claimed` exists but nothing sets it. A real
  verification flow is needed before a signed-in user can take ownership of an imported
  2020 handle. See [ADR 0004](../architecture/adr/0004-agents-separate-from-accounts.md).
- **Recover The Big Bang city data** from the original Google Sheet. It exists in a
  screenshot but was deliberately not transcribed —
  [assumptions §B8](../import/assumptions-and-inferred-data.md#b8--city-data-was-left-empty-rather-than-partially-transcribed).
- **Recover the missing agents** visible only in the form-responses screenshot —
  [§B9](../import/assumptions-and-inferred-data.md#b9--agents-visible-only-in-a-screenshot-were-not-imported).
- **Back up all 342 source files off-machine.** The public upload deliberately contains
  only the 272 reviewed, unique campaign assets; excluded originals still need durable
  private preservation.
- **Materialised statistics** if a campaign ever outgrows plain views —
  [ADR 0001](../architecture/adr/0001-supabase-as-backend.md).
