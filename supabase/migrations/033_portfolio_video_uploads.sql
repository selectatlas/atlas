-- Widen the portfolio bucket to accept video.
--
-- Migration 032 deliberately kept this images-only, reasoning that video could
-- stay URL-based via YouTube/Vimeo. That held until Instagram: it serves
-- X-Frame-Options: DENY on its embed endpoint, so an Instagram reel can never
-- play inside Atlas as an iframe. The only way to keep a hirer on-platform for
-- that content is to host the file ourselves.
--
-- Containers are limited to what browsers decode natively (see
-- src/lib/video-verification.ts) because we do not transcode - an AVI would
-- store fine and then fail silently in the player.
--
-- 100MB is ~2 minutes of decent 1080p. RLS policies from 032 already scope
-- writes to the caller's own uid folder and are unchanged here.

update storage.buckets
set
  file_size_limit = 104857600,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime'
  ]
where id = 'portfolio';

-- Hosted projects created the bucket via 032; local stacks that skipped
-- straight to this migration still need it to exist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  104857600,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do nothing;
