# Security Data Plan

- [ ] Check account taxable account 3579 on Monday to see if aged quantity is available for ETF position in Schwab GUI
- [ ] Configure CI/Worker secrets: set repo `CRON_KEY`, `CRON_BASE_URL` and Worker secret `CRON_KEY`
- [ ] Verify `/api/workers/yahoo-sync` returns 200 and sync logs are written
- [ ] Add alert/monitoring for failed nightly sync (optional)
- [ ] Given that Mutual Funds and ETFs have more than one Sector, should we store all of them in a separate table? Also they have no Industry, so we need to determine what to do with that.
- [ ] Allow manual updates to security data? (e.g. name, sector, industry, etc.)

## Environment Variables Cleanup

- [ ] Ensure `CRON_KEY` documented and set in GitHub and Cloudflare Worker
