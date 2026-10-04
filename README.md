# [RUSO](https://rusonow.com) — Footwear & Streetwear Shop

Premium black & white, Gen-Z streetwear-style shoe store with live backend synchronization, cart management, instant checkout, and real-time admin portal.

## Project Structure

```
ruso-shop/
├── index.html        → Main storefront & admin portal
├── css/style.css      → Design system & UI styles
├── js/script.js        → Frontend logic, cart, API integration & admin handlers
├── assets/
│   ├── logo.svg       → Crisp transparent vector logo
│   ├── favicon.svg    → Browser tab favicon
│   └── logo.png       → Brand logo asset
└── README.md
```

## Running Locally

1. Open `ruso-shop` in VS Code or any editor.
2. If using VS Code, install the **Live Server** extension.
3. Right-click `index.html` → **Open with Live Server**.
4. The storefront opens at `http://127.0.0.1:5500/index.html`.
5. Ensure `ruso-backend` is running on `http://localhost:4000` (or configure `API_BASE` in `js/script.js`).

## Features

- **Live Catalog & Inventory**: Products and stock levels load directly from the REST API.
- **Dynamic Collection & Search**: Fast multi-category filtering and full search.
- **Cart & Checkout**: Real-time stock enforcement, delivery zone calculation (Inside / Outside Sylhet), and multiple payment options (**bKash**, **Nagad**, **Cash on Delivery**).
- **Direct WhatsApp Confirmation**: Generates formatted order details with single-click WhatsApp order confirmation.
- **Admin Dashboard**:
  - Secure server-verified login (no passwords stored in client code).
  - Add, edit, and delete products (live stock adjustments, prices, photos, and video links).
  - Manage incoming customer orders with live status updates (`Pending confirmation`, `Confirmed`, `Shipped`, `Delivered`, `Cancelled`).

## Production Deployment (Hostinger / Cloudflare Pages / GitHub Pages)

### Option A: Cloudflare Pages / GitHub Pages (Free)
1. Push `ruso-shop` to a GitHub repository.
2. Connect the repository to **Cloudflare Pages** or enable **GitHub Pages** in repository settings.
3. Add your custom domain (e.g. `ruso.shop`) in DNS settings.

### Option B: Hostinger Hosting
1. Upload the contents of `ruso-shop/` directly to your `public_html` folder via File Manager or FTP.
2. In `js/script.js`, set `API_BASE` to your deployed backend URL (e.g. `https://api.ruso.shop` or your Render URL).
