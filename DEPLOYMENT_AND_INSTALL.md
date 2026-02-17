# Deploy and Install Flexible Policy App as a Custom App

This guide walks you through deploying this Shopify app and installing it on any store as a **custom app** (not listed in the App Store).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Create or Use an App in Shopify Partners](#2-create-or-use-an-app-in-shopify-partners)
3. [Deploy the App](#3-deploy-the-app)
4. [Configure Environment Variables in Production](#4-configure-environment-variables-in-production)
5. [Update App URLs in Shopify Partners](#5-update-app-urls-in-shopify-partners)
6. [Install the App on a Store](#6-install-the-app-on-a-store)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

- **Node.js** 20.x or 22.x
- **npm** (or yarn/pnpm)
- A **Shopify Partners** account: [partners.shopify.com](https://partners.shopify.com)
- A **Shopify store** to test on (Development store or any store where you have admin access)
- A **hosting provider** for the app (e.g. Fly.io, Render, Railway, or your own server)

---

## 2. Create or Use an App in Shopify Partners

1. Go to [partners.shopify.com](https://partners.shopify.com) and sign in.
2. Click **Apps** → **Create app** → **Create app manually** (or use an existing app).
3. Note your app’s **Client ID** and **Client secret** (under **App setup** or **Client credentials**). You’ll use these as `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`.
4. Under **App setup**:
   - Set **App URL** to your production URL (e.g. `https://your-app.fly.dev`). You can update this again after deployment.
   - Set **Allowed redirection URL(s)** to:  
     `https://your-app.fly.dev/auth/callback`  
     (Replace with your real app URL when you have it.)
5. Under **Configuration** → **Scopes**, add the scopes your app needs (e.g. `read_products`, `write_products`). These must match the `scopes` in `shopify.app.toml` and the `SCOPES` env var.
6. Ensure the app is a **Custom app** or **Development** app (not “Public”). This app is configured with `AppDistribution.CustomApp` so it can be installed on any store via install link.

---

## 3. Deploy the App

Choose one of the options below.

### Option A: Deploy with Fly.io (recommended for getting started)

1. **Install Fly CLI**: [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/)

2. **Log in and create app**:
   ```bash
   fly auth login
   fly launch
   ```
   - Choose an app name and region.
   - Say **No** to PostgreSQL if asked (the template uses SQLite by default; for production you may later switch to a database).

3. **Set secrets** (see [Section 4](#4-configure-environment-variables-in-production) for values):
   ```bash
   fly secrets set SHOPIFY_API_KEY=your_api_key
   fly secrets set SHOPIFY_API_SECRET=your_api_secret
   fly secrets set SHOPIFY_APP_URL=https://your-app-name.fly.dev
   fly secrets set SCOPES=read_products,write_products
   fly secrets set NODE_ENV=production
   ```

4. **Deploy**:
   ```bash
   fly deploy
   ```

5. Your app URL will be: `https://your-app-name.fly.dev`. Use this in the next steps.

### Option B: Deploy with Render

1. Push your code to GitHub (or connect another Git provider to Render).
2. In [Render](https://render.com): **New** → **Web Service**.
3. Connect the repo and configure:
   - **Build command**: `npm install && npm run build`
   - **Start command**: `npm run setup && npm run start`
   - **Environment**: add all variables from [Section 4](#4-configure-environment-variables-in-production).
4. Deploy. Your app URL will be like `https://your-app-name.onrender.com`.

### Option C: Deploy with Docker (any host)

1. **Build the image**:
   ```bash
   docker build -t flexible-policy-app .
   ```

2. **Run the container** (set env vars or use a `.env` file):
   ```bash
   docker run -p 3000:3000 \
     -e SHOPIFY_API_KEY=your_api_key \
     -e SHOPIFY_API_SECRET=your_api_secret \
     -e SHOPIFY_APP_URL=https://your-domain.com \
     -e SCOPES=read_products,write_products \
     -e NODE_ENV=production \
     flexible-policy-app
   ```

3. Put a reverse proxy (e.g. Nginx, Caddy) or load balancer in front with HTTPS. Your app must be served over **HTTPS** for Shopify.

### Option D: Manual deployment (VPS or server)

1. On the server, clone the repo and install dependencies:
   ```bash
   git clone <your-repo-url> .
   npm ci
   ```

2. Set environment variables (see [Section 4](#4-configure-environment-variables-in-production)).

3. Build and run:
   ```bash
   npm run setup
   npm run build
   npm run start
   ```

4. Use a process manager (e.g. PM2) and serve over HTTPS (e.g. Nginx + SSL).

---

## 4. Configure Environment Variables in Production

Set these in your hosting dashboard (Fly.io secrets, Render env vars, Docker env, or server `.env`):

| Variable               | Description                                      | Example                          |
|------------------------|--------------------------------------------------|----------------------------------|
| `SHOPIFY_API_KEY`      | App Client ID from Partners                      | `0abef6a4385ff48379323bf70c4d3649` |
| `SHOPIFY_API_SECRET`   | App Client secret from Partners                  | (from Partners dashboard)        |
| `SHOPIFY_APP_URL`      | Full public URL of your deployed app (HTTPS)     | `https://your-app.fly.dev`       |
| `SCOPES`               | Comma-separated OAuth scopes                     | `read_products,write_products`   |
| `NODE_ENV`             | Must be `production` in production               | `production`                     |

**Optional:**

- `SHOP_CUSTOM_DOMAIN` – If stores use a custom admin domain (e.g. `admin.my-store.com`), set it here.

**Database (default: SQLite):**

- The app uses Prisma with SQLite by default (`prisma/schema.prisma`). For a single-instance deployment this is fine.
- For multiple instances or stronger durability, switch the Prisma datasource to PostgreSQL (or another DB) and set `DATABASE_URL` accordingly.

---

## 5. Update App URLs in Shopify Partners

After deployment, point your app in Partners to the live URL:

1. In [Partners](https://partners.shopify.com) → **Apps** → your app → **App setup** (or **Configuration**).
2. Set **App URL** to your production URL, e.g. `https://your-app.fly.dev`.
3. Set **Allowed redirection URL(s)** to:
   - `https://your-app.fly.dev/auth/callback`
   (Add any other auth redirect URLs your app uses.)
4. If you use **App proxy**, set the proxy URL to match your app (e.g. subpath and prefix as in `shopify.app.toml`).
5. Save.

---

## 6. Install the App on a Store

Because this app is configured as a **custom app**, you install it via an install link (no App Store listing).

### Step 1: Get the install link

1. In Partners: **Apps** → your app → **Distribution** (or **App setup**).
2. Find **Install link** / **Test your app** / **Preview URL**. It looks like:
   ```text
   https://your-store.myshopify.com/admin/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=read_products,write_products&redirect_uri=...
   ```
   Or use the standard form:
   ```text
   https://{store}.myshopify.com/admin/oauth/authorize?client_id={SHOPIFY_API_KEY}&scope={SCOPES}&redirect_uri={SHOPIFY_APP_URL}/auth/callback
   ```
   Replace:
   - `{store}` – store’s myshopify subdomain (e.g. `my-store`)
   - `{SHOPIFY_API_KEY}` – your app’s Client ID
   - `{SCOPES}` – same scopes as in `SCOPES` (e.g. `read_products,write_products`)
   - `{SHOPIFY_APP_URL}` – your production app URL

### Step 2: Install on a store

1. **Store admin** (or you): Open the install link in a browser.
2. You’ll be asked to log in to the store (if not already).
3. Approve the requested permissions.
4. You’ll be redirected to your app; the app is now installed on that store.

### Step 3: Open the app later

- From the store admin: **Apps** → your app name.
- Or use the app’s entry URL (e.g. `https://your-app.fly.dev` with the right session); normally merchants use the Apps menu.

---

## 7. Troubleshooting

### “Redirect URI mismatch”

- In Partners, **Allowed redirection URL(s)** must exactly match what the app uses, e.g. `https://your-app.fly.dev/auth/callback` (no trailing slash if your app doesn’t use one).
- Ensure `SHOPIFY_APP_URL` in production has no trailing slash and uses `https`.

### “The table Session does not exist”

- Run migrations in production: `npm run setup` (runs `prisma migrate deploy`). On Fly.io/Render, the start command should include this (e.g. `npm run setup && npm run start`).

### App loads but shows errors or blank

- Check hosting logs for missing env vars (`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`).
- Ensure `NODE_ENV=production` and that you’re using the same Client ID/secret as in Partners.

### Install link returns 404 or wrong app

- Confirm **App URL** and **Allowed redirection URL(s)** in Partners match your deployed URL.
- Ensure the app is set as **Custom** or **Development** and that you’re using the correct Client ID in the install URL.

### Database (SQLite) in production

- SQLite is fine for a single instance. For zero-downtime deploys or multiple instances, switch to PostgreSQL (or another DB) in `prisma/schema.prisma` and set `DATABASE_URL` on your host.

---

## Quick reference

| Step              | What to do |
|-------------------|------------|
| Create app        | Partners → Create app manually → note Client ID & secret |
| Deploy            | Fly.io / Render / Docker / VPS (see Section 3) |
| Env vars          | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES`, `NODE_ENV=production` |
| Partners URLs     | App URL = `https://your-app.domain`, Redirect = `https://your-app.domain/auth/callback` |
| Install on store  | Use install link from Partners or build URL with client_id, scope, redirect_uri |

For more on deployment and hosting, see [Shopify deployment docs](https://shopify.dev/docs/apps/launch/deployment).
