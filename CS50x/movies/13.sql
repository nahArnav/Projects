-- 13. Names of all people who starred in a movie in which Kevin Bacon also starred
SELECT DISTINCT name FROM people WHERE id in (
    SELECT DISTINCT person_id FROM stars WHERE movie_id in (
        SELECT id FROM movies WHERE id in (
            SELECT movie_id FROM stars WHERE person_id in (
                SELECT id FROM people WHERE name = 'Kevin Bacon'
            )
        )
    )
) AND name <> 'Kevin Bacon';
