-- Digital Teras — 0009: flag paket untuk sistem tema (Milestone 6)
-- custom_accent: warna bebas (di luar palet) khusus Pro — sejalan dgn
-- hide_badge (Pro) yang sudah ada di seed 0002.

update public.plans
   set limits = limits || '{"custom_accent": true}'::jsonb
 where code = 'pro';

update public.plans
   set limits = limits || '{"custom_accent": false}'::jsonb
 where code in ('free', 'micro');
