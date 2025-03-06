import express from "express";
import { CreateFAQEntryController } from "../../controllers/faq_store/CreateFAQEntryController";
import { GetFAQEntriesController } from "../../controllers/faq_store/GetFAQEntriesController";

const router = express.Router();

const createFAQEntryController = new CreateFAQEntryController();
const getFAQEntriesController = new GetFAQEntriesController();

router.post("/faq-store", createFAQEntryController.handle);
router.get("/faq-store", getFAQEntriesController.handle);

export { router as faqStoreRouter };
