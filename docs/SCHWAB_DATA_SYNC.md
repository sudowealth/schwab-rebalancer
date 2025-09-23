# Schwab Data Synchronization

The platform automatically synchronizes portfolio data from Charles Schwab with intelligent timing to balance freshness and API usage:

## Sync Triggers

- **Post-OAuth**: Full sync after connecting Schwab account (only if no recent sync exists)
- **12-Hour Cycle**: Automatic refresh when on a page/tab for more than 12 hours
- **Browser Reopen**: Automatic sync when reopening site after 12+ hours since last sync
- **Connection Recovery**: Sync triggers after reconnecting expired credentials
- **Manual**: User-initiated syncs via Data Feeds page
- **Rebalancing Groups**: Automatic price sync on page load (if prices stale >1 hour) + manual "Fetch Prices" button

## Sync Sequence

When a sync runs, it executes in this order:

1. **Accounts** → Fetch account information and create/update local records
2. **Holdings** → Sync current positions and cash balances
3. **Prices** → Update security prices for held positions
4. **Yahoo Fundamentals** → Fetch additional data for missing securities

## Smart Timing & Behavior

- **Global Hook**: Sync logic runs on every route via root component for consistent timing
- **localStorage Tracking**: Timestamps persist across browser sessions and tabs
- **No Aggressive Syncing**: Won't sync on dev server restarts or page reloads unless needed
- **Connection State Aware**: Only clears sync state when connection is actually lost
- **Background Operation**: Syncs happen automatically without user interaction
- **Error Handling**: Failed syncs don't break the application and retry on next trigger
- **Rebalancing Group Price Sync**: Only syncs prices for securities held in the group or included in the group's model (if assigned), skipping cash equivalents

## Manual Controls

Users can manually trigger syncs via `/data-feeds` page:

- **All**: Full sequence (accounts → holdings → prices)
- **Accounts**: Account information only
- **Holdings**: Positions and balances only
- **Prices**: Security pricing updates
- **Transactions**: Trade history (last 365 days)
