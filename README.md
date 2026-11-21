# COMP3810SEF Group Project — Campus Second-hand Shop

A second-hand shopping platform for campus communities, built with **Express.js + MongoDB (Mongoose) + EJS**.

---

## Team Members & Module Ownership

| Member | Module | Main Files |
|---|---|---|
| **A** | User account & authentication | `models/User.js`, `routes/auth.js`, `routes/profile.js`, `middleware/auth.js` |
| **B** | Product CRUD | `models/Product.js`, `routes/products.js`, `views/products/*` |
| **C** | Shopping cart & favourites | `models/Cart.js`, `models/Favorite.js`, `routes/cart.js`, `routes/cartApi.js`, `routes/favorites.js`, `services/cartService.js`, `views/cart/*`, `views/favorites/*` |
| **D** | Order management | `models/Order.js`, `routes/orders.js`, `views/orders/*` |

---

## Member C — Shopping Cart & Favourites

### Feature Overview

**Shopping cart**
- Add a product to the cart from the product list page
- View the cart with item images, names, prices and the total amount
- Remove an item from the cart
- Success / error messages are shown after each action
- Each second-hand product is a unique item, so the cart stores **no quantity field** — the same product cannot be added twice

**Favourites**
- Add or remove a product from the favourites list (one click toggles both ways)
- View all favourited products on the favourites page
- Favourited products that have since been sold are still listed, with their current status shown

### Files Owned by C

```
models/Cart.js              Cart schema
models/Favorite.js          Favourites schema
services/cartService.js     Shared cart logic (also used by Member D)
routes/cart.js              Cart page routes
routes/cartApi.js           Cart REST API
routes/favorites.js         Favourites page + REST API
views/cart/index.ejs        Cart page
views/favorites/index.ejs   Favourites page
```

### Data Model — Cart

```js
{
  userId: ObjectId,        // ref: User, unique index (one cart per user)
  items: [{
    productId: ObjectId,   // ref: Product
    title: String,         // snapshot at the time of adding
    price: Number,         // snapshot at the time of adding
    imageUrl: String,
    addedAt: Date
  }]
}
```

### Page Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/cart` | View the shopping cart |
| POST | `/cart/add/:productId` | Add a product to the cart |
| POST | `/cart/remove/:productId` | Remove a product from the cart |
| GET | `/favorites` | View the favourites list |
| POST | `/favorites/toggle` | Add / remove a favourite |

### REST API — Cart

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cart` | Read the cart |
| POST | `/api/cart` | Create — add a product (`{ "productId": "..." }`) |
| PUT | `/api/cart/:productId` | Update — change the snapshot price of an item |
| DELETE | `/api/cart/:productId` | Delete — remove a product from the cart |

### REST API — Favourites

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/favorites` | Read the favourites list |
| POST | `/api/favorites` | Create — add a favourite (`{ "productId": "..." }`) |
| DELETE | `/api/favorites/:productId` | Delete — remove a favourite |

---

## CURL Testing Commands

Run the server first (`npm start`), then log in to obtain a session cookie:

```bash
curl -c cookie.txt -X POST http://localhost:3000/login \
  -d "email=your@email.com&password=yourpassword"
```

Replace `<PRODUCT_ID>` with a real product id (visible in the URL of a product page).

### Cart — Read

```bash
curl -b cookie.txt http://localhost:3000/api/cart
```

### Cart — Create

```bash
curl -b cookie.txt -X POST http://localhost:3000/api/cart \
  -H "Content-Type: application/json" \
  -d "{\"productId\": \"<PRODUCT_ID>\"}"
```

### Cart — Update

```bash
curl -b cookie.txt -X PUT http://localhost:3000/api/cart/<PRODUCT_ID> \
  -H "Content-Type: application/json" \
  -d "{\"price\": 25.00}"
```

### Cart — Delete

```bash
curl -b cookie.txt -X DELETE http://localhost:3000/api/cart/<PRODUCT_ID>
```

### Favourites — Read / Create / Delete

```bash
curl -b cookie.txt http://localhost:3000/api/favorites

curl -b cookie.txt -X POST http://localhost:3000/api/favorites \
  -H "Content-Type: application/json" \
  -d "{\"productId\": \"<PRODUCT_ID>\"}"

curl -b cookie.txt -X DELETE http://localhost:3000/api/favorites/<PRODUCT_ID>
```

---

## How to Run

```bash
npm install
```

Create a `.env` file in the project root (see `.env.example`):

```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<db>
SESSION_SECRET=<any random string>
PORT=3000
```

Then:

```bash
npm start
```

Open <http://localhost:3000> in a browser.

---

## Notes for Member D (Order Module)

`routes/cart.js` and `routes/cartApi.js` both delegate to **`services/cartService.js`**, so the order module can read and clear the same cart the user sees on screen.

```js
const cartService = require('../services/cartService');

// Read the cart with live prices (use this for the order amount)
const cart = await cartService.getCartItemsWithCurrentPrice(req.session.userId);

// Each item: { productId, title, imageUrl, currentPrice, available, reason }

// Clear the cart after the order is created
await cartService.clearCart(req.session.userId);
```

**Important:** `item.price` inside the cart is a snapshot taken when the product was added. Sellers may change prices afterwards, so the order amount must be calculated from `currentPrice` and `available` must be checked before checkout — otherwise the same single item could be sold to two buyers.

---

## Notes

- Products store their state in `status`: `available` or `sold`.
- The cart page shows a notice when the current price differs from the price captured when the item was added.
- The checkout button posts to `/orders/checkout`, which is implemented by Member D.
