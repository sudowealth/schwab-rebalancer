<!-- markdownlint-disable MD029 -->
# Local HTTPS and Stable Callback (Schwab OAuth)

This project uses a single, local HTTPS origin for OAuth during development: `https://127.0.0.1` (no port shown). This avoids rotating tunnels and satisfies providers that disallow explicit ports in redirect URIs.

---

## Local HTTPS on 127.0.0.1 (no domain; Schwab-compatible)

Schwab accepts `https://127.0.0.1/...` without an explicit port. We terminate TLS locally on 443 and reverse proxy to Vite at 3000.

### One-time setup

1. Install tooling (macOS/Homebrew)

```bash
brew install mkcert caddy
```

2. Generate and trust a local cert (in the project root)

```bash
mkcert -install
mkcert 127.0.0.1    # creates 127.0.0.1.pem and 127.0.0.1-key.pem in the repo
```

3. Start Caddy (pick one)

- Recommended: run in background (simplest)

  ```bash
  sudo caddy validate --config ./Caddyfile
  sudo caddy run --config ./Caddyfile >/tmp/caddy.log 2>&1 & disown
  ```

  Stop later:

  ```bash
  sudo pkill -f 'caddy run --config'
  ```

- Alternative: Homebrew service (auto-start on login)

  ```bash
  sudo ln -sf "$(pwd)/Caddyfile" /opt/homebrew/etc/Caddyfile
  sudo ln -sf "$(pwd)/127.0.0.1.pem" /opt/homebrew/etc/127.0.0.1.pem
  sudo ln -sf "$(pwd)/127.0.0.1-key.pem" /opt/homebrew/etc/127.0.0.1-key.pem
  sudo brew services start caddy
  # manage: sudo brew services restart|stop caddy
  ```

4. Configure Schwab Developer Portal

- Callback URL: `https://127.0.0.1/schwab/callback`

  > **⚠️ Important**: Schwab processes new callback URLs overnight. After registering your callback URL, OAuth authentication may not work until the next business day.

#### Ongoing (daily) development

```bash
pnpm dev
# browse https://127.0.0.1 (not http://localhost:3000)
```

If you moved the repo or cert files and Caddy errors on restart, re-run the three `ln -sf` commands above, then `sudo brew services restart caddy`.

Optional: if Caddy isn’t running, start the service again with `sudo brew services start caddy`.

### Troubleshooting

- **Browser trust**: `mkcert -install` should import a local CA and remove warnings.
- **Cookies/session**: the app automatically detects the correct base URL. No manual configuration needed.
- **Always browse the same origin** you used for the callback (`https://127.0.0.1`).

### Quick verification

- **Check that something is listening on 443:**

  ```bash
  sudo lsof -nP -iTCP:443 -sTCP:LISTEN
  ```

- **Probe the proxy/cert quickly:**

  ```bash
  curl -vkI https://127.0.0.1
  ```

- **If Caddy fails to start or proxy:**
  - When started with the background one‑liner, check `/tmp/caddy.log`.
  - When using Homebrew service: `brew services log caddy`.

Notes

- Apple Silicon Homebrew paths are under `/opt/homebrew`; on Intel they are typically under `/usr/local`.
- If you switch between `http://localhost:3000` and `https://127.0.0.1`, clear cookies for each origin to avoid session confusion.

---

### Quick Reference

- Set/clear base URL locally

You can now access your app at `https://127.0.0.1` with a valid SSL certificate.

- Start dev

```bash
pnpm dev
```

If something fails, share the exact error and we’ll tune the config.
