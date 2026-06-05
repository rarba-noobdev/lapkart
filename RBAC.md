# LapKart Roles & Permissions Specification

## Customer (User) Interaction Flow

1. **Browse/Search Products:**
   - ✅ _User can_ view the product catalog (via `/products`), search by keywords or filters, and see available products.
   - ❌ _User cannot_ modify the catalog or see any admin-only fields (e.g. supplier SKUs or cost).

2. **View Product Details (`/product/[id]`):**
   - ✅ _User can_ view product information (title, description, images, price, stock level, specifications).
   - ❌ _User cannot_ see hidden attributes (internal notes, procurement costs) or change product info.

3. **Add to Cart (`/cart`):**
   - ✅ _User can_ add products to their shopping cart and adjust quantities (up to available stock). The app should validate quantity against stock.
   - ❌ _User cannot_ add more items than are in stock, set negative quantities, or manipulate another user’s cart.

4. **Manage Cart:**
   - ✅ _User can_ update item quantities or remove items from their own cart.
   - ❌ _User cannot_ proceed to checkout with an empty cart; cannot add items reserved by other carts beyond stock.

5. **Select Delivery Location:**
   - ✅ _User can_ enter their delivery address or pick a location via the Ola Maps interface. The system should reverse-geocode and validate the address.
   - ❌ _User cannot_ enter an invalid or unsupported address (the map/address fields must validate input). Users cannot skip providing a delivery address when required.

6. **Fetch Courier Options:**
   - ✅ _System automatically_ fetches available courier and shipping options (via Shiprocket/Ola Maps) for the given delivery address before payment. The user can then select a shipping option.
   - ❌ _User cannot_ bypass courier selection; cannot choose a courier service that isn’t offered for their location.

7. **Checkout & Payment (`/checkout`):**
   - ✅ _User can_ review the order summary (items, totals, shipping), apply a coupon code, and select a payment method (Razorpay or eligible COD).
   - ❌ _User cannot_ finalize checkout if required information is missing/invalid (e.g. address, payment info). The UI should disable the **Place Order** button until all fields are valid.

8. **Razorpay Payment:**
   - ✅ _User can_ enter payment details and authorize the transaction via Razorpay. Upon success, Razorpay returns a confirmation.
   - ❌ _User cannot_ proceed without a successful payment authorization. The system must handle and report payment failures (e.g. card decline) and not create the order.

9. **Cash on Delivery (COD):**
   - ✅ _User can_ select COD if it is available for their location. The system may check eligibility (e.g. ZIP code) before allowing COD.
   - ❌ _User cannot_ select COD if the location is ineligible or if order exceeds COD limits.

10. **Place Order:**
    - ✅ _User can_ confirm the order once payment is approved (or if COD is valid). An order record is created with status **Pending** or **Confirmed**. The UI should display an order confirmation.
    - ❌ _User cannot_ alter the order contents, prices, or shipping address after confirmation. All order details (items, quantities, prices, shipping address) are frozen as a **snapshot**. (This means even admins cannot retroactively change these fields on the order.)

11. **Order Confirmation:**
    - ✅ _User receives_ an order ID and confirmation message. An email/in-app notification is sent.

12. **View Order History (`/orders`):**
    - ✅ _User can_ view a list of their own past orders with basic info (order number, date, status).
    - ❌ _User cannot_ see anyone else’s orders or their details.

13. **View Order Details (`/order/[id]`):**
    - ✅ _User can_ view details of their own order (items, price breakdown, shipping address, current status, tracking info from Shiprocket).
    - ❌ _User cannot_ edit any order information here. They also cannot cancel or return the order unless the order status allows it (see below).

14. **Order Cancellation (User):**
    - ✅ _User can_ cancel their own order if the system allows it (typically only before shipping). For example, if the order status is still “Confirmed” or “Processing,” a **Cancel Order** button should be available.
    - ❌ _User cannot_ cancel once the order is marked **Shipped** or beyond; the UI should hide/disable the cancel option when cancellation is not allowed.

15. **Order Returns & Refunds:**
    - ✅ _User can_ initiate a return request for delivered orders (if returns are supported by the platform).
    - ❌ _User cannot_ complete a return without admin processing; they cannot mark the order as returned or directly trigger a refund.

16. **Account/Profile Management (`/dashboard`):**
    - ✅ _User can_ view and edit their profile data (name, password, address book entries).
    - ✅ _User can_ add or modify shipping addresses in their address book.
    - ❌ _User cannot_ change identity-critical fields once set. For example, after registration, the _phone number_ (and possibly email/username) should not be editable by the user. (Admin might be able to change it pre-order, but after an order is placed, even admin edits should be locked.)

17. **Notifications and Support:**
    - ✅ _User can_ receive notifications (in-app, email, or SMS) about order status changes (order placed, shipped, delivered, canceled, refunded). The system should push updates in real-time or near-real-time.
    - ❌ _User cannot_ send/receive notifications about other users’ orders or admin actions that don’t involve them.

18. **Edge Case Validations:**
    - ✅ The app must validate all user input (names, addresses, etc.). For instance, disallow excessively long names or unsupported characters to avoid UI breakage or database errors.
    - ✅ The cart and checkout forms should sanitize inputs (e.g. trim whitespace, strip HTML) to prevent empty or malicious data.
    - ✅ Handle concurrency: if two users attempt to buy the last unit of stock simultaneously, the second should be prevented (backend should re-check stock on payment).
    - ✅ If a user tries to go “back” after purchase (e.g. using browser back button on the thank-you page), the app should prevent double order submission (disable the button or show a message).

## Admin Interaction Flow

1. **Admin Login:**
   - ✅ _Admin can_ log in via `/login` and access the admin interface (`/admin`, `/admin/fulfillment`). Only admin accounts should authenticate here.
   - ❌ _Non-admin users cannot_ access any `/admin/*` routes or see admin navigation. The frontend must hide admin links, and backend must reject unauthorized access.

2. **Admin Dashboard:**
   - ✅ _Admin can_ view a summary dashboard (sales metrics, low-stock alerts, pending orders, etc.).

3. **Catalog Management:**
   - ✅ _Admin can_ create, read, update, and delete products and categories. In the admin UI they can edit **all** product fields: title, description, price, SKU, stock count, images/media, attributes.
   - ❌ _Admin cannot_ edit fields that should be immutable on past orders (e.g. price on an already placed order remains as originally recorded). Backend should enforce that price changes do not retroactively affect existing orders.
   - ❌ _Admin cannot_ save a product that violates data rules (e.g. empty title, invalid price). The frontend should validate entries; the backend must also enforce constraints (e.g. non-negative price, stock).

4. **Pricing & Discounts:**
   - ✅ _Admin can_ set product prices and create promotional discounts (coupons, sale events).
   - ✅ _Admin can_ create and manage coupon codes (set discount %, expiration, usage limits).
   - ❌ _Admin cannot_ apply coupons themselves at checkout like a customer (coupons exist only for user checkout flows).
   - ❌ _Admin should not_ change pricing policies without audit. For example, editing a coupon after it’s been issued may not affect already placed orders (orders should store coupon discount at time of order).

5. **Inventory (Stock) Management:**
   - ✅ _Admin can_ adjust stock quantities for products (restock new inventory or correct counts).
   - ✅ _Admin can_ view stock levels and receive low-stock notifications.
   - ❌ _Admin cannot_ set stock below zero.
   - ❌ _Admin cannot_ change stock quantities on orders that have been fulfilled/shipped – those are finalized.

6. **Media and Assets:**
   - ✅ _Admin can_ upload and manage product images and other media in Supabase Storage (linked via product records).

7. **User and Role Management:**
   - ✅ _Admin can_ view all user accounts, edit non-sensitive user data (e.g. name), and assign roles (e.g. promote another user to admin or support staff).
   - ❌ _Admin cannot_ change a user’s phone number or email if the user has placed an order (to preserve consistency of order records). After order placement, identity fields are effectively locked.
   - ✅ _Admin can_ reset user passwords or deactivate/reactivate accounts.
   - ❌ _Admin cannot_ impersonate a user without explicit “login as user” functionality.

8. **Support and Notifications:**
   - ✅ _Admin can_ access the support dashboard: view user-submitted tickets or questions, respond to them, and close tickets.
   - ✅ _Admin can_ view stock-notification subscriptions (users waiting for items) and mark users as notified when items are restocked.
   - ❌ _Admin cannot_ view unrelated private user data through support tools (only info provided in the ticket).

9. **Order Management:**
   - ✅ _Admin can_ view **all** orders across customers in an orders admin panel (filter by status, date, user, etc.).
   - ✅ _Admin can_ change an order’s status to progress it (e.g. **Pending→Processing→Shipped→Delivered**).
   - ✅ _Admin can_ cancel an order that has not been shipped yet. Cancelling should trigger the refund workflow if payment was captured, and should restock items if configured. (Admin can choose to refund fully, partially, or later.)
   - ❌ _Admin cannot_ cancel an order once it’s **shipped** or beyond; the UI must disable the Cancel option in that case. The backend must also enforce this rule.
   - ✅ _Admin can_ initiate and process returns for delivered orders, marking items as returned and issuing refunds as needed.
   - ❌ _Admin should not_ delete orders from the database in normal operation (except for test or import-only cases).

10. **Shiprocket Fulfillment:**
    - ✅ _Admin can_ create shipments via Shiprocket for orders (generate airway bills, labels, schedule pickups).
    - ✅ _Admin can_ update tracking numbers and shipment statuses (by fetching updates or manually entering data).
    - ❌ _Admin cannot_ create multiple shipments for the same order lines (no duplicate fulfillment).
    - ❌ _Admin cannot_ create a shipment for a canceled or already delivered order.

11. **Real-Time Updates:**
    - ✅ If _Admin cancels_ an order or processes a refund, the system must immediately notify the user (in-app notification, email or SMS) about the cancellation or refund. For example: “Your order #123 has been canceled by admin. Refund is being processed.”
    - ✅ Admin actions on an order (status changes, etc.) should trigger appropriate notifications to the user.

12. **Audit & Compliance:**
    - ✅ All admin actions (price changes, order cancellations, etc.) should be logged for audit.
    - ❌ Admin cannot disable or bypass audit logging.

## Role-Based Permissions (RBAC)

LapKart uses strict RBAC: permissions are granted by role, not per user. We have two roles: **User (Customer)** and **Admin**. Below is a granular list of allowed (✅) and forbidden (❌) actions/fields for each role. These rules must be enforced both in the UI (to hide/disable actions) and in the backend (to validate requests).

### Customer (User) Role

- **Catalog Access:**
  - ✅ _User can_ **view** products and categories (name, description, images, public price, stock status).
  - ❌ _User cannot_ create/update/delete any product or category.

- **Cart & Checkout:**
  - ✅ _User can_ add/remove items in **their own** cart, apply coupon codes, and initiate checkout.
  - ❌ _User cannot_ edit another user’s cart or bypass checkout validation (e.g. must be logged in).

- **Address & Profile:**
  - ✅ _User can_ add/edit shipping addresses in their profile before an order is placed.
  - ❌ _User cannot_ change identity-critical fields (phone/email) once set; after any order, the address on that order cannot be edited.

- **Orders:**
  - ✅ _User can_ place orders (online payment or eligible COD) and view **their own** order history/status.
  - ❌ _User cannot_ see other users’ orders, or alter order contents or prices after placement.
  - ✅ _User can_ cancel their own order only if it is still unshipped (UI should show cancel button only in that case).
  - ❌ _User cannot_ cancel or modify the order once it has been marked **Shipped**.

- **Returns/Refunds:**
  - ✅ _User can_ request a return or refund for an eligible delivered order.
  - ❌ _User cannot_ process returns/refunds without admin action; they cannot directly mark an order as refunded.

- **Profile Management:**
  - ✅ _User can_ update non-critical profile fields (e.g. name, password).
  - ❌ _User cannot_ escalate their role or grant themselves admin access.

- **Notifications/Support:**
  - ✅ _User can_ receive notifications about their orders and submit support inquiries.
  - ❌ _User cannot_ receive notifications about others or access admin support tools.

### Admin Role

- **Includes All User Permissions** plus management abilities: admins implicitly have the above user capabilities (view products, view any order) **and** the following:

- **Product Catalog:**
  - ✅ _Admin can_ **create**, update, or delete products and categories. This includes editing all product fields (title, description, price, SKU, stock, media, metadata).
  - ❌ _Admin cannot_ retroactively change data on existing orders. For example, updating a product’s price **does not change** the price stored on already-placed orders.

- **Pricing/Discounts:**
  - ✅ _Admin can_ set product prices, create/modify coupon codes and promotional campaigns.
  - ❌ _Admin cannot_ apply coupons as themselves (coupons only apply to customer checkout). Admin also should not create invalid coupons.

- **Inventory:**
  - ✅ _Admin can_ adjust inventory counts (increase for restock, decrease for shrinkage).
  - ❌ _Admin cannot_ set negative stock. Stock on shipped orders cannot be changed.

- **Media:**
  - ✅ _Admin can_ upload and manage product images/assets in Supabase Storage.

- **User Accounts:**
  - ✅ _Admin can_ view/edit user profiles and assign roles.
  - ❌ _Admin cannot_ edit a user’s critical identity fields (phone/email) if the user has an order history (those must remain consistent for order records).

- **Order Management:**
  - ✅ _Admin can_ view **all orders** and change their status (e.g. mark as Processing, Shipped, Delivered).
  - ✅ _Admin can_ cancel orders that are not yet shipped, and process refunds/returns when needed.
  - ❌ _Admin cannot_ cancel or refund an order once it is shipped/delivered. The **Cancel** action should be disabled in the admin UI for such orders. Backend must enforce this (reject the request if state is already shipped).
  - ❌ _Admin cannot_ modify order contents (items, quantities, original price, shipping address, or payment method) after order creation. Order data is immutable.

- **Shiprocket Fulfillment:**
  - ✅ _Admin can_ create shipments via Shiprocket (AWB, labels, pickup) and update tracking info.
  - ❌ _Admin cannot_ create multiple shipments for the same order lines or for already completed orders. Cannot void or reuse a label incorrectly.

- **Support & Notifications:**
  - ✅ _Admin can_ view user support tickets and respond.
  - ✅ _Admin can_ trigger stock-notifications to users (e.g. inform waiting users when an item is restocked).
  - ❌ _Admin cannot_ perform actions out of their scope (e.g. cannot directly place orders on behalf of users from the admin panel without using the normal checkout process).

- **System Management:**
  - ✅ _Admin can_ perform maintenance tasks (run migrations, view logs) as needed.
  - ❌ _Admin cannot_ disable RBAC rules or RLS policies. All actions should be logged; Admin should not delete or alter audit trails.

### Data/Field-Level Notes

- **Immutable Fields:** Certain fields must not change after creation for consistency/audit reasons. For example, each order should store its own **shipping address**, prices, and discounts (copied from the user’s profile at time of order). As one guide notes: “don’t allow any order data to be changed at all after an order has been recorded”.
- **Profile Data:** In user profiles, fields like _phone number_ or _username_ should only be set at signup and not editable by the user. Admin may edit them before the first order, but once an order exists, even admin edits should be locked.
- **UI Gating:** The frontend should disable/hide actions the role shouldn’t have. E.g., hide the “Cancel Order” button when an order is shipped; hide admin menus for non-admins. The UI is a convenience, but all rules must also be enforced server-side.

### Order State Transitions

Common order statuses might include: _Pending Payment_, _Confirmed_, _Processing_, _Shipped_, _Delivered_, _Canceled_, _Returned_. Key rules:

- **Cancellation:** Allowed only if order is not yet shipped. (Both user and admin should be prevented from canceling a _Shipped_ order.)
- **Refunds/Returns:** Can only be issued on _Canceled_ or _Returned_ orders.
- **Immutability:** Once an order status moves forward (e.g. from Processing to Shipped), it should not go back (except to Canceled/Refund in exceptional flows).
- **Edge Cases:** If an admin erroneously attempts an invalid transition (e.g. cancel a shipped order), the backend must reject it and inform the client.

### Backend Enforcement (Supabase RLS & Validation)

- Use Supabase Row-Level Security to enforce per-role data access. For example, a policy can ensure **users only see their own orders**:
  ```sql
  CREATE POLICY "Users can view own orders"
    ON orders FOR SELECT
    USING ((auth.uid() IS NOT NULL) AND auth.uid() = user_id);
  ```
  This translates to `SELECT * FROM orders WHERE auth.uid() = orders.user_id;`, as shown in Supabase docs.
- Admins should have RLS or role checks granting them broader access. E.g., allow `auth.role() = 'admin'` to bypass user_id checks on certain tables.
- **All mutations must be validated**: e.g., before canceling an order, the function should check `status != 'shipped'`. Price updates must not cascade to past orders.
- **Auditing:** Every change (especially by admin) should be logged. Use database triggers or Supabase logs.

### Edge-Case & Data Validation (Missed Scenarios)

- **Input Validation:** Always validate fields. For instance, prevent overly long names or strange characters that could break the UI or database. Sanitize addresses, names, and coupon codes.
- **Concurrency:** Lock or re-validate stock at order time to prevent overselling.
- **Session/Token State:** If a user’s role changes (e.g. demoted) or their session expires, the app should handle it gracefully (log them out or refresh permissions).
- **Payment Failures:** Handle declined payments (refund any captured amount, inform user).
- **Network Issues:** Ensure the order isn’t duplicated if the user refreshes or navigates away. Disable buttons after click (debounce rapid submissions).

**Sources:** We apply standard RBAC principles and e-commerce best practices (e.g. Shopify’s order cancellation rules). Orders should be immutable once placed. Supabase RLS can enforce row-level rules like “users see only their data”. Proper input validation is critical to avoid edge-case failures. All the above rules should be implemented with both frontend UI gating and strict backend checks for full security and correctness.
