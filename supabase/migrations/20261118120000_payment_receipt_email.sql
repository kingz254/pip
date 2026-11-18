alter table public.payments
  add column receipt_email_status text not null default 'not_sent'
    check (receipt_email_status in ('not_sent', 'sending', 'sent', 'failed')),
  add column receipt_email_attempted_at timestamptz,
  add column receipt_email_sent_at timestamptz,
  add column receipt_email_error text;
