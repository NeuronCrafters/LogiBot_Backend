-- Custom SQL migration file, put your code below! --
INSERT INTO professor_quiz_disciplines (quiz_id, discipline_id)
SELECT id, discipline_id
FROM professor_quizzes
ON CONFLICT (quiz_id, discipline_id) DO NOTHING;
