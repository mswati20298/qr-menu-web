# QR Menu — Web

Angular app for QR Menu, a digital ordering SaaS for Indian restaurants. The API lives in
[qr-menu-api](https://github.com/mswati20298/qr-menu-api).

One app, four areas:

| Route | Who | What |
|---|---|---|
| `/m/:slug` | Customers (no login) | Browse the menu, order, track the order, pay by UPI |
| `/admin` | Restaurant owner | Dashboard, orders, invoices, menu, tables, QR codes, settings, plan |
| `/kitchen` | Kitchen staff (PIN login) or owner | Full-screen kitchen display |
| `/superadmin` | Platform admin | Restaurants, subscriptions, plan catalog |

**Stack:** Angular 20 (standalone components, signals), SCSS, no UI library.

## Run locally

```bash
npm install
npm start
```

Open http://localhost:4200. `proxy.conf.json` forwards `/api` and `/uploads` to the API on http://localhost:5176,
so start the API first.

## Build

```bash
npx ng build
```

The build goes to `dist/web`. No secrets live in this repo: all keys stay on the API side.
