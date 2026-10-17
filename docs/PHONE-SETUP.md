# Phone Remote Access Setup (Tailscale)

This guide walks you through connecting your iPhone browser to ShadowHelicon running on your Windows PC over Tailscale.

Tailscale creates a secure, encrypted peer-to-peer connection between your phone and your PC. Nothing is published to the public internet, and access requires your authenticated Tailscale IP and token.

Follow each step in order. Verify each step before moving to the next.

---

## Step 1: Verify Muse CLI and Login on PC

First, ensure the Muse Code CLI is installed and authenticated on your PC.

1. Open PowerShell on your Windows PC.
2. Run this command to verify Muse is found:
   ```powershell
   muse --version
   ```
   **Verification:** You should see the installed Muse version number (for example: `1.4.9`).
3. If not already logged in, log in to your Meta Muse account:
   ```powershell
   muse login
   ```
   **Verification:** Follow the browser prompt. Once complete, running `muse whoami` or `muse --version` succeeds without authentication errors.

---

## Step 2: Install and Connect Tailscale on PC and iPhone

1. On your Windows PC:
   - Download and install Tailscale from `https://tailscale.com/download/windows`.
   - Launch Tailscale and log in with your account.
2. On your iPhone:
   - Install Tailscale from the App Store.
   - Launch Tailscale and log in using the exact same account you used on your PC.
   - Toggle the Tailscale switch to Connected (VPN profile active).
3. On your PC, find your PC Tailscale IP address:
   ```powershell
   tailscale ip -4
   ```
   **Verification:** You will see an IP address starting with `100.` (for example: `100.115.92.44`). Note this address down.

---

## Step 3: Generate a Secure Token and Start ShadowHelicon Daemon

On your PC, generate a random security token and launch the ShadowHelicon server bound to all local interfaces:

1. In PowerShell, generate a random token:
   ```powershell
   $token = [System.Guid]::NewGuid().ToString("N")
   Write-Host "Your connection token is: $token"
   ```
2. Navigate to your ShadowHelicon directory:
   ```powershell
   Set-Location "C:\Users\white\OneDrive\Documents\GitHub\ShadowHelicon"
   ```
3. Start the server (replace `100.x.y.z` with your PC Tailscale IP from Step 2):
   ```powershell
   node packages/server/dist/src/cli.js --host 0.0.0.0 --port 3127 --token $token --allow-origin "http://100.x.y.z:3127" --static ./apps/web/dist
   ```
   **Verification:** The console will display:
   `helicon-server listening on http://0.0.0.0:3127`

---

## Step 4: Connect from Your iPhone Browser

1. On your iPhone, open Safari or Chrome.
2. Ensure Tailscale is connected (the VPN icon shows in your iOS status bar).
3. In the address bar, enter your PC Tailscale address:
   ```text
   http://100.x.y.z:3127/#/connect
   ```
   (Replace `100.x.y.z` with your PC Tailscale IP).
4. The ShadowHelicon Connect screen will appear.
5. In the Daemon Address field, confirm `http://100.x.y.z:3127` is entered.
6. In the Token field, enter the token you generated in Step 3.
7. Tap Connect.

**Verification:** The web interface will securely exchange the token for an HttpOnly session cookie and load your project workspace and active threads.

---

## Troubleshooting Checklist

If the page does not load on your phone, check these five items in order:

1. **Check daemon running:** Look at your PC PowerShell window and verify the server process has not exited or crashed.
2. **Check Tailscale on both devices:** Confirm Tailscale is active and shows "Connected" on both your Windows PC and your iPhone. In the Tailscale app on your phone, your PC should show an active green dot.
3. **Verify IP and Port:** Ensure the address in your phone browser matches the exact IPv4 shown by `tailscale ip -4` on your PC, followed by `:3127`.
4. **Windows Firewall:** If Windows Firewall prompts you when starting the server, click "Allow access" on Private networks. You can also test access from your PC browser first at `http://127.0.0.1:3127`.
5. **Re-enter Token:** If the connect screen reports an authentication failure, verify that the token string in the phone browser matches the generated token string without leading or trailing spaces.
