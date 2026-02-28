-- messages: dashboard default sort
create index messages_user_received_idx
  on messages (user_id, received_at desc);

-- classifications: recent feed
create index classifications_user_created_idx
  on classifications (user_id, created_at desc);

-- classifications: filtered by label
create index classifications_user_label_created_idx
  on classifications (user_id, label, created_at desc);
