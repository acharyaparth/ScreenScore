import sys
import pdfplumber

if len(sys.argv) != 2:
    print("Usage: python extract_text.py <pdf_path>")
    sys.exit(1)

pdf_path = sys.argv[1]

try:
    with pdfplumber.open(pdf_path) as pdf:
        full_text = ''
        for page in pdf.pages:
            full_text += page.extract_text() + '\n'
        print(full_text.strip())
except Exception as e:
    print(f"Error extracting text from PDF: {e}")
    sys.exit(1) 