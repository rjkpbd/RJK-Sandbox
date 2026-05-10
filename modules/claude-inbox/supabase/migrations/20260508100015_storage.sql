-- Migration 015: storage buckets + policies
-- Two private buckets. Files stored at {user_id}/{record_id}/{filename}.
-- RLS enforces that users can only access files under their own user_id prefix.

-- Bucket: attachments (images, PDFs, text files up to 50 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'attachments',
  'attachments',
  false,
  52428800,
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/json'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Bucket: skill-files (supporting files for installed skills, up to 10 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'skill-files',
  'skill-files',
  false,
  10485760
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: attachments bucket
CREATE POLICY "attachments: owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "attachments: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- Storage RLS: skill-files bucket
CREATE POLICY "skill-files: owner select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'skill-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "skill-files: owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'skill-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "skill-files: owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'skill-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

CREATE POLICY "skill-files: owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'skill-files'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
