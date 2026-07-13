import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"
import * as XLSX from "xlsx"

export const runtime = "nodejs"

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
const MAX_TEXT_LENGTH = 60_000

const SUPPORTED_EXTENSIONS = new Set(["pdf", "docx", "txt", "xlsx", "xls"])

function getExtension(filename: string) {
  const match = /\.([a-z0-9]+)$/i.exec(filename)
  return match ? match[1].toLowerCase() : ""
}

async function extractPdf(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text
  } finally {
    await parser.destroy()
  }
}

async function extractDocx(buffer: Buffer) {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

function extractSpreadsheet(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const csv = XLSX.utils.sheet_to_csv(sheet).trim()
    return `# Sheet: ${name}\n${csv}`
  }).join("\n\n")
}

export async function POST(request: Request) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: "Expected multipart/form-data." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file." }, { status: 400 })
  }

  if (file.size === 0) {
    return Response.json({ error: "That file is empty." }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE) {
    return Response.json({ error: "File is too large. Limit is 25 MB." }, { status: 413 })
  }

  const extension = getExtension(file.name)
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return Response.json(
      { error: "Unsupported file type. Upload a PDF, DOCX, TXT, or XLSX file." },
      { status: 415 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let text: string
    switch (extension) {
      case "pdf":
        text = await extractPdf(buffer)
        break
      case "docx":
        text = await extractDocx(buffer)
        break
      case "xlsx":
      case "xls":
        text = extractSpreadsheet(buffer)
        break
      default:
        text = buffer.toString("utf-8")
        break
    }

    text = text.replace(/\r\n/g, "\n").trim()
    const truncated = text.length > MAX_TEXT_LENGTH
    if (truncated) {
      text = text.slice(0, MAX_TEXT_LENGTH)
    }

    return Response.json({ text, truncated, characterCount: text.length })
  } catch (error) {
    console.error(`Failed to extract text from "${file.name}":`, error)
    return Response.json(
      {
        error: `Could not read this ${extension.toUpperCase()} file. It may be corrupted, empty, or password-protected.`,
      },
      { status: 422 }
    )
  }
}
