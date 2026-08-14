#!/usr/bin/env python3
"""Generate LionWheel Integration API PDF for external developers."""

from pathlib import Path
from fpdf import FPDF

FONT = "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"
OUT = Path(__file__).resolve().parent / "LionWheel-Integration-API.pdf"

API_KEY = "d66d90d47eb26fe9b8847bd0cc9c92974158e8086d03a9cf854c5b3a165997a6"
ENDPOINT = "https://os.isa-express.com/api/integrations/lionwheel/create"


class ApiPdf(FPDF):
    def header(self):
        self.set_font("ArialUni", "", 10)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "ISA Express — LionWheel Integration API", align="L")
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font("ArialUni", "", 9)
        self.set_text_color(130, 130, 130)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def section_title(pdf, text):
    pdf.set_font("ArialUni", "B", 14)
    pdf.set_text_color(30, 41, 59)
    pdf.multi_cell(0, 8, text)
    pdf.ln(2)


def body(pdf, text, size=11):
    pdf.set_font("ArialUni", "", size)
    pdf.set_text_color(51, 65, 85)
    pdf.multi_cell(0, 6, text)
    pdf.ln(2)


def code_block(pdf, text):
    pdf.set_font("Courier", "", 9)
    pdf.set_fill_color(248, 250, 252)
    pdf.set_text_color(15, 23, 42)
    pdf.multi_cell(0, 5, text, fill=True)
    pdf.ln(3)


def table_row(pdf, col1, col2, bold=False):
    pdf.set_font("ArialUni", "B" if bold else "", 10)
    x, y = pdf.get_x(), pdf.get_y()
    pdf.cell(45, 7, col1, border=1)
    pdf.multi_cell(0, 7, col2, border=1)
    if pdf.get_y() == y:
        pdf.ln(7)


def main():
    pdf = ApiPdf()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_font("ArialUni", "", FONT)
    pdf.add_font("ArialUni", "B", FONT)
    pdf.set_text_shaping(True)
    pdf.add_page()

    section_title(pdf, "API ליצירת משימות LionWheel")
    body(pdf, "מסמך זה מתאר את ה-API ליצירת משימות משלוח/איסוף ב-LionWheel דרך מערכת ISA Express.")

    section_title(pdf, "Endpoint")
    code_block(pdf, f"POST {ENDPOINT}")

    section_title(pdf, "Authentication")
    body(pdf, "יש לשלוח Bearer token ב-header:")
    code_block(pdf, f"Authorization: Bearer {API_KEY}\nContent-Type: application/json")

    section_title(pdf, "שדות חובה")
    pdf.set_font("ArialUni", "B", 10)
    pdf.cell(45, 8, "שדה", border=1, align="C")
    pdf.cell(0, 8, "תיאור", border=1, align="C", new_x="LMARGIN", new_y="NEXT")
    rows = [
        ("destination", "india או thailand — קובע לאיזה חשבון LW נשלח"),
        ("orderId", "מזהה הזמנה אצלכם"),
        ("city", "עיר"),
        ("name", "שם הנמען"),
        ("phone", "טלפון"),
        ("number", "מספר בית"),
    ]
    pdf.set_font("ArialUni", "", 10)
    for field, desc in rows:
        pdf.cell(45, 8, field, border=1)
        pdf.cell(0, 8, desc, border=1, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    section_title(pdf, "שדות אופציונליים")
    body(pdf, "type (pickup / empty), street, boxes, emptyBoxes")

    section_title(pdf, "דוגמת בקשה — India")
    code_block(
        pdf,
        """{
  "destination": "india",
  "orderId": "EXT-12345",
  "city": "Tel Aviv",
  "number": "12",
  "name": "John Doe",
  "phone": "0501234567",
  "boxes": 2
}""",
    )

    section_title(pdf, "דוגמת בקשה — Thailand")
    code_block(
        pdf,
        """{
  "destination": "thailand",
  "orderId": "EXT-67890",
  "type": "pickup",
  "city": "Ramat Gan",
  "number": "5",
  "name": "Jane Smith",
  "phone": "0527654321",
  "boxes": 1
}""",
    )

    section_title(pdf, "תשובה בהצלחה (HTTP 200)")
    code_block(
        pdf,
        """{
  "success": true,
  "task_id": 26959944,
  "public_id": "7SCJVUHZMJ",
  "tracking_link": "https://members.lionwheel.com/locate/7SCJVUHZMJ"
}""",
    )

    section_title(pdf, "שגיאות אפשריות")
    errors = [
        "401 — token שגוי או חסר",
        "400 — שדות חובה חסרים",
        "502 — שגיאה מ-LionWheel",
        "503 — הגדרות שרת חסרות",
    ]
    for err in errors:
        body(pdf, f"• {err}", size=10)

    pdf.ln(4)
    body(pdf, "במקרה של תקלה — שלחו את ה-body שנשלח ואת ה-response שהתקבל.", size=10)

    pdf.output(str(OUT))
    print(OUT)


if __name__ == "__main__":
    main()
