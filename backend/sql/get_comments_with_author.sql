CREATE OR REPLACE FUNCTION get_comments_with_author(p_livrable_id UUID)
RETURNS TABLE (
    id UUID,
    contenu TEXT,
    created_at TIMESTAMPTZ,
    auteur_nom TEXT,
    auteur_prenom TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.id,
        lc.contenu,
        lc.created_at,
        u.nom::text,
        u.prenom::text
    FROM
        livrable_commentaires lc
    JOIN
        utilisateurs u ON lc.auteur_id = u.id
    WHERE
        lc.livrable_id = p_livrable_id
    ORDER BY
        lc.created_at DESC;
END;
$$ LANGUAGE plpgsql;
