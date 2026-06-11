-- ============================================================
-- Business customization: logo, cover image, card color
-- ============================================================

-- Add card_color column to businesses (stores hex color e.g. '#6C3DF4')
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT NULL;

-- ── Storage bucket for business assets ──────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-assets',
  'business-assets',
  true,
  5242880,  -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── RLS Policies for business-assets bucket ─────────────────

-- Anyone can read (public bucket)
CREATE POLICY "Public read access on business-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-assets');

-- Only authenticated users can upload to their own folder
CREATE POLICY "Business owners can upload assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-assets'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the owner can update their own files
CREATE POLICY "Business owners can update their assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Only the owner can delete their own files
CREATE POLICY "Business owners can delete their assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-assets'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
