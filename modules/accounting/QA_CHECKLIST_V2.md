# Accounting V2 QA Checklist

## Functional
- [ ] Dashboard shows KPIs only
- [ ] Localization does not appear on dashboard after installation
- [ ] Settings page saves cafeteria toggle, country, currency, fiscal year start
- [ ] Localization page installs chart, journals, taxes
- [ ] Customer invoices load
- [ ] Customer credit notes load
- [ ] Vendor bills load
- [ ] Vendor credit notes load
- [ ] Customer payments load
- [ ] Vendor payments load
- [ ] Transfers load
- [ ] Payment methods load
- [ ] Trial balance loads
- [ ] Profit and loss loads
- [ ] Balance sheet loads
- [ ] Customer ledger loads
- [ ] Vendor ledger loads
- [ ] Revenue by business line loads

## Data / Posting
- [ ] Journal entries stay balanced
- [ ] Vendor bill posting debits expense and credits payables
- [ ] Customer invoice posting debits receivable and credits revenue/deferred revenue logic target
- [ ] Customer credit note reverses receivable/revenue direction
- [ ] Vendor credit note reverses payable/expense direction
- [ ] Payment registration updates invoice residual/state
- [ ] Transfer creates a balancing liquidity move

## Cafeteria
- [ ] OFF excludes new cafeteria postings
- [ ] ON posts new cafeteria sales
- [ ] Historical entries remain intact when toggle changes

## Technical
- [ ] No 404 on all route map endpoints
- [ ] Arabic and English render correctly
- [ ] RTL remains visually correct
- [ ] Menu items point to real pages
