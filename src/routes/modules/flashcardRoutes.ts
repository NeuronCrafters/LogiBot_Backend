import { Router, type NextFunction, type Request, type Response } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import {
  FlashcardValidationError,
  archiveDeck,
  getManagedDeck,
  listManagedDecks,
  listStudyDecks,
  questionCandidates,
  reviewCard,
  saveDeck,
  studySession,
} from "../../services/flashcards/flashcardService";

export const flashcardRouter = Router();
flashcardRouter.use(requireAuth);
const staff = requireRoles(["professor", "course-coordinator", "admin"]);
const student = requireRoles(["student"]);

// Staff: decks of their subjects (coordination also the coordinated ones; admins all).
flashcardRouter.get("/decks", staff, asyncHandler(async (req, res) => res.json(await listManagedDecks(getDb(), req.user!, { disciplineId: req.query.disciplineId }))));
flashcardRouter.get("/decks/:id", staff, asyncHandler(async (req, res) => res.json(await getManagedDeck(getDb(), req.user!, req.params.id))));
flashcardRouter.post("/decks", staff, asyncHandler(async (req, res) => res.status(201).json(await saveDeck(getDb(), req.user!, null, req.body))));
flashcardRouter.put("/decks/:id", staff, asyncHandler(async (req, res) => res.json(await saveDeck(getDb(), req.user!, req.params.id, req.body))));
flashcardRouter.delete("/decks/:id", staff, asyncHandler(async (req, res) => { await archiveDeck(getDb(), req.user!, req.params.id); return res.status(204).end(); }));
// Quiz questions of the bank that can become cards.
flashcardRouter.get("/candidates", staff, asyncHandler(async (req, res) => res.json(await questionCandidates(getDb(), req.user!, req.query.disciplineId))));

// Students: published decks of their class's subjects, a study round and the rating of each card.
flashcardRouter.get("/study", student, asyncHandler(async (req, res) => res.json(await listStudyDecks(getDb(), req.user!))));
flashcardRouter.get("/study/:deckId", student, asyncHandler(async (req, res) => res.json(await studySession(getDb(), req.user!, req.params.deckId))));
flashcardRouter.post("/cards/:id/review", student, asyncHandler(async (req, res) => res.json(await reviewCard(getDb(), req.user!, req.params.id, req.body))));

flashcardRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof FlashcardValidationError) return res.status(400).json({ code: error.code, message: error.message, issues: error.issues });
  return next(error);
});
