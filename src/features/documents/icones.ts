import { File, FileImage, FileSpreadsheet, FileText, Presentation, type LucideIcon } from "lucide-react";

export function iconeFichier(mime: string | null, nom: string): LucideIcon {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (mime?.startsWith("image/")) return FileImage;
  if (/sheet|excel|csv/.test(mime ?? "") || ["xlsx", "xls", "csv", "ods"].includes(ext)) return FileSpreadsheet;
  if (/presentation|powerpoint/.test(mime ?? "") || ["pptx", "ppt", "odp"].includes(ext)) return Presentation;
  if (mime === "application/pdf" || /word|text/.test(mime ?? "") || ["pdf", "docx", "doc", "txt", "md", "odt"].includes(ext)) return FileText;
  return File;
}
