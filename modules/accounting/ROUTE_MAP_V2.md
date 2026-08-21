# Accounting V2 Route Map

## Bootstrap / Config
- GET /api/accounting/bootstrap
- GET /api/accounting/settings
- PUT /api/accounting/settings
- POST /api/accounting/settings/localization/install
- GET /api/accounting/payment-methods

## Accounting Masters
- GET /api/accounting/accounts
- POST /api/accounting/accounts
- GET /api/accounting/journals
- POST /api/accounting/journals
- GET /api/accounting/taxes

## Entries
- GET /api/accounting/journal-entries
- POST /api/accounting/journal-entries
- POST /api/accounting/journal-entries/:id/post

## Sales / Purchases
- GET /api/accounting/customer-invoices
- GET /api/accounting/customer-credit-notes
- GET /api/accounting/vendor-bills
- GET /api/accounting/vendor-credit-notes
- POST /api/accounting/invoices

## Payments
- GET /api/accounting/payments
- GET /api/accounting/customer-payments
- GET /api/accounting/vendor-payments
- GET /api/accounting/transfers
- POST /api/accounting/payments
- POST /api/accounting/transfers

## Reports
- GET /api/accounting/reports/trial-balance
- GET /api/accounting/reports/profit-loss
- GET /api/accounting/reports/balance-sheet
- GET /api/accounting/reports/general-ledger
- GET /api/accounting/reports/aged-receivables
- GET /api/accounting/reports/aged-payables
- GET /api/accounting/reports/customer-ledger
- GET /api/accounting/reports/vendor-ledger
- GET /api/accounting/reports/revenue-business-line
