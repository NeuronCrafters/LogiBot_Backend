import { promises as fs } from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractTextFromDocument(input: {
  filePath: string;
  sourceType: string;
}) {
  if (input.sourceType === "txt") {
    return fs.readFile(input.filePath, "utf8");
  }

  if (input.sourceType === "docx") {
    const result = await mammoth.extractRawText({ path: input.filePath });
    return result.value;
  }

  if (input.sourceType === "pdf") {
    const data = await fs.readFile(input.filePath);
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  throw new Error(`tipo de documento nao suportado: ${input.sourceType}`);
}

export async function saveExtractedText(input: {
  originalFilePath: string;
  text: string;
}) {
  const extractedTextPath = `${input.originalFilePath}.txt`;
  await fs.writeFile(extractedTextPath, input.text, "utf8");
  return extractedTextPath;
}
