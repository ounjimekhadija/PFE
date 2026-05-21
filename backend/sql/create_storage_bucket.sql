-- 1. Créer le bucket 'documents' s'il n'existe pas déjà
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique de lecture (SELECT) : Permettre aux utilisateurs authentifiés de télécharger/visualiser les fichiers du bucket
CREATE POLICY "Allow authenticated users to read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- 3. Politique d'insertion (INSERT) : Permettre aux utilisateurs authentifiés d'uploader des fichiers dans le bucket
CREATE POLICY "Allow authenticated users to upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- 4. Politique de modification (UPDATE) : Permettre aux utilisateurs authentifiés de modifier les fichiers existants
CREATE POLICY "Allow authenticated users to update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents')
WITH CHECK (bucket_id = 'documents');

-- 5. Politique de suppression (DELETE) : Permettre aux utilisateurs authentifiés de supprimer les fichiers existants
CREATE POLICY "Allow authenticated users to delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
