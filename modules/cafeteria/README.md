# Cafeteria Module for GymOS v3

Production-style modular cafeteria app with:
- product and category management
- warehouse and stock ledger
- POS with cashier sessions
- split payments (cash/card/CliQ)
- held orders and refunds
- dashboard KPIs and reports
- settings, menu, widgets, and i18n injection

## Install
Upload the module ZIP through GymOS module upload, or copy this folder to `modules/cafeteria`.

## Notes
- Depends on `members` and `branches`
- Uses average cost for stock valuation
- Uses global `app.currency` for receipts and reports
- Default demo data is included in the migration
