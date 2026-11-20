import { Router } from "express";
import path from "path";
import { IMAGE_NAME, IMAGE_TYPES, imageDir } from "../../services/institutions/institutionImageStore";

/**
 * Read-only access to institution photos and covers. No login or API key (an <img> cannot send them),
 * but only files named by their content hash in the image folder can be read, always as an image.
 */
export const institutionImageRouter = Router();

institutionImageRouter.get("/:environment/:name", (req, res) => {
  const { environment, name } = req.params;
  if ((environment !== "production" && environment !== "sandbox") || !IMAGE_NAME.test(name)) return res.status(404).end();
  res.set({
    "Content-Type": IMAGE_TYPES[path.extname(name).slice(1)],
    "Cache-Control": "public, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  return res.sendFile(name, { root: imageDir(environment), dotfiles: "deny" }, (error) => {
    if (error && !res.headersSent) res.status(404).end();
  });
});
