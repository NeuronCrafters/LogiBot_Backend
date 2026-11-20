import { Router, type NextFunction, type Request, type Response } from "express";
import { getDb } from "../../db/client";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import {
  InstitutionValidationError,
  geocodeForInstitution,
  postalCodeForInstitution,
  institutionPage,
  listInstitutions,
  setInstitutionStatus,
  updateInstitution,
  updateInstitutionImage,
} from "../../services/institutions/institutionService";

export const institutionRouter = Router();
institutionRouter.use(requireAuth);

// Institutions the person may open (admins: all of their database; others: their own).
institutionRouter.get("/", asyncHandler(async (req, res) => res.json(await listInstitutions(getDb(), req.user!))));

// The page, with more or less detail according to the profile.
institutionRouter.get("/:id", asyncHandler(async (req, res) => res.json(await institutionPage(getDb(), req.user!, req.params.id))));

// Admin: name, kind, location, website and "about".
institutionRouter.put("/:id", asyncHandler(async (req, res) => res.json(await updateInstitution(getDb(), req.user!, req.params.id, req.body))));

// Admin: logo and cover (data URL, or null to remove).
institutionRouter.put("/:id/logo", asyncHandler(async (req, res) => res.json(await updateInstitutionImage(getDb(), req.user!, req.params.id, "logo", req.body))));
institutionRouter.put("/:id/cover", asyncHandler(async (req, res) => res.json(await updateInstitutionImage(getDb(), req.user!, req.params.id, "cover", req.body))));

// Whoever edits: map point for an address (OpenStreetMap, through the server).
institutionRouter.get("/:id/geocode", asyncHandler(async (req, res) =>
  res.json(await geocodeForInstitution(getDb(), req.user!, req.params.id, req.query.q, req.headers["accept-language"]?.split(",")[0]))));

// Whoever edits: street, city and state of a Brazilian CEP (ViaCEP, through the server).
institutionRouter.get("/:id/postal-code", asyncHandler(async (req, res) => res.json(await postalCodeForInstitution(getDb(), req.user!, req.params.id, req.query.cep))));

// Owner: turn the institution off or back on.
institutionRouter.post("/:id/status", asyncHandler(async (req, res) => res.json(await setInstitutionStatus(getDb(), req.user!, req.params.id, req.body))));

// Field-level validation errors go back as a list, so the form marks each field.
institutionRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof InstitutionValidationError) return res.status(400).json({ code: error.code, message: error.message, issues: error.issues });
  return next(error);
});
