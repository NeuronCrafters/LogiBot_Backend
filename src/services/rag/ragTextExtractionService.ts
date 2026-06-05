import { promises as fs } from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { logger } from "../../logger";

const SCOPE = "TextExtraction";

export async function extractTextFromDocument(input: {
  filePath: string;
  sourceType: string;
}) {
  logger.info(SCOPE, "Starting extraction.", { filePath: input.filePath, sourceType: input.sourceType });

  let text: string;

  if (input.sourceType === "txt") {
    text = await fs.readFile(input.filePath, "utf8");
  } else if (input.sourceType === "docx") {
    logger.info(SCOPE, "Parsing DOCX with mammoth.");
    const result = await mammoth.extractRawText({ path: input.filePath });
    if (result.messages?.length) {
      logger.warn(SCOPE, "Mammoth reported warnings.", { count: result.messages.length });
    }
    text = result.value;
  } else if (input.sourceType === "pdf") {
    logger.info(SCOPE, "Parsing PDF with pdf-parse.");
    const data = await fs.readFile(input.filePath);
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    await parser.destroy();
    text = result.text;
  } else {
    throw new Error(`tipo de documento nao suportado: ${input.sourceType}`);
  }

  logger.info(SCOPE, "Extraction complete.", {
    sourceType: input.sourceType,
    characters: text.length,
    nonEmptyLines: text.split("\n").filter((l) => l.trim()).length,
  });

  return text;
}

export async function saveExtractedText(input: {
  originalFilePath: string;
  text: string;
}) {
  const extractedTextPath = `${input.originalFilePath}.txt`;
  await fs.writeFile(extractedTextPath, input.text, "utf8");
  return extractedTextPath;
}
