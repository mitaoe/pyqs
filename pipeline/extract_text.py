"""PDF text extraction with OCR fallback.

Most 2018-2024 papers have a text layer (PyMuPDF). Scanned papers (2016,
some 2025) yield almost no text — below MIN_TEXT_CHARS we rasterize each
page and run Tesseract instead. PyMuPDF renders the page images itself, so
no poppler dependency is needed; the Actions runner installs tesseract-ocr
via apt.
"""

import io
import logging

import fitz  # PyMuPDF
import pytesseract
from PIL import Image

import config

log = logging.getLogger(__name__)


def extract_text(pdf_path):
    """Return (text, method) where method is 'text' or 'ocr'."""
    with fitz.open(pdf_path) as doc:
        text = "\n".join(page.get_text() for page in doc)
        if len(text.strip()) >= config.MIN_TEXT_CHARS:
            return text, "text"

        log.info(
            "text layer has only %d chars — OCR fallback over %d page(s)",
            len(text.strip()), doc.page_count,
        )
        parts = []
        for page in doc:
            pix = page.get_pixmap(dpi=config.OCR_DPI)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            parts.append(pytesseract.image_to_string(img))
        return "\n".join(parts), "ocr"
