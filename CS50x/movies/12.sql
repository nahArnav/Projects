-- 12. Titles of all of movies in which both Jennifer Lawrence and Bradley Cooper starred
SELECT title FROM movies WHERE id in (
    SELECT movie_id FROM stars WHERE person_id in (
        SELECT id FROM people WHERE name = 'Jennifer Lawrence'
    )
)
AND title in
(
SELECT title FROM movies WHERE id in (
    SELECT movie_id FROM stars WHERE person_id in (
        SELECT id FROM people WHERE name = 'Bradley Cooper'
    )
)
)
