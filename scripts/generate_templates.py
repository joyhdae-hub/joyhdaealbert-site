#!/usr/bin/env python3
"""Generate the three free starter templates into /downloads.

    pip install -r scripts/requirements.txt
    python3 scripts/generate_templates.py        (or: npm run generate-templates)

Every file is generic, styled in the site palette, carries the license line in its
footer, and has author / company / last-modified-by metadata stripped.
"""
import datetime
import io
import os
import re
import zipfile

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "downloads")
LICENSE = "For personal or internal business use only. Not for resale or redistribution. © Joyhdae Albert"
FIXED_DATE = datetime.datetime(2026, 11, 4, 12, 0, 0)

ESPRESSO, TEXT, SOFT = "2B1D14", "3D2E22", "6B5847"
LINEN, LINEN_DEEP, ROSE, ROSE_INK, GOLD = "F6EFE5", "EFE3D2", "C79C92", "8A5649", "B78B4E"
ROSE_PALE = "EBD7D1"
HEAD_FONT, BODY_FONT = "Georgia", "Calibri"


def rgb(h):
    return RGBColor(int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


# ---------------------------------------------------------------- zip hygiene
def scrub_zip(path):
    """Blank author, company, manager and last-modified-by in an OOXML file."""
    with open(path, "rb") as f:
        src = zipfile.ZipFile(io.BytesIO(f.read()))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename in ("docProps/core.xml", "docProps/app.xml"):
                s = data.decode("utf-8")
                for tag in ("dc:creator", "cp:lastModifiedBy", "Company", "Manager"):
                    s = re.sub(r"<%s>.*?</%s>" % (tag, tag), "<%s></%s>" % (tag, tag), s, flags=re.S)
                data = s.encode("utf-8")
            dst.writestr(item, data)
    with open(path, "wb") as f:
        f.write(buf.getvalue())


# ---------------------------------------------------------------- docx helpers
def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)


def borders(table, color=ROSE, size=4):
    tbl = table._tbl
    tblPr = tbl.tblPr
    b = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = OxmlElement("w:" + edge)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), str(size))
        el.set(qn("w:space"), "0")
        el.set(qn("w:color"), color)
        b.append(el)
    tblPr.append(b)


def run(p, text, size=10.5, bold=False, italic=False, color=TEXT, font=BODY_FONT):
    r = p.add_run(text)
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.italic = italic
    r.font.name = font
    r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    r.font.color.rgb = rgb(color)
    return r


def cell_text(cell, text, **kw):
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.space_before = Pt(2)
    run(p, text, **kw)


def set_widths(table, widths):
    table.autofit = False
    for i, w in enumerate(widths):
        table.columns[i].width = Inches(w)
    for row in table.rows:
        for i, w in enumerate(widths):
            row.cells[i].width = Inches(w)


def new_doc(title):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.left_margin = sec.right_margin = Inches(0.8)
    sec.top_margin, sec.bottom_margin = Inches(0.7), Inches(0.8)
    st = doc.styles["Normal"]
    st.font.name = BODY_FONT
    st.font.size = Pt(10.5)
    cp = doc.core_properties
    cp.author = ""
    cp.last_modified_by = ""
    cp.title = title
    cp.subject = ""
    cp.comments = ""
    cp.keywords = ""
    cp.category = ""
    cp.created = FIXED_DATE
    cp.modified = FIXED_DATE
    # footer with the license line
    fp = sec.footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    run(fp, LICENSE, size=8, color=SOFT)
    return doc


def title_block(doc, title, subtitle):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run(p, title, size=26, color=ESPRESSO, font=HEAD_FONT, bold=True)
    p2 = doc.add_paragraph()
    p2.paragraph_format.space_after = Pt(4)
    run(p2, subtitle, size=11, color=SOFT)
    # thin gold rule, the one gold accent in the document
    rule = doc.add_paragraph()
    rule.paragraph_format.space_after = Pt(8)
    pPr = rule._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    bt = OxmlElement("w:bottom")
    bt.set(qn("w:val"), "single")
    bt.set(qn("w:sz"), "6")
    bt.set(qn("w:space"), "1")
    bt.set(qn("w:color"), GOLD)
    bdr.append(bt)
    pPr.append(bdr)


def heading(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    run(p, text, size=14, color=ESPRESSO, font=HEAD_FONT, bold=True)


def grid(doc, headers, rows, widths, header_fill=ROSE_PALE, row_height=None, hint_row=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    borders(t)
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        shade(c, header_fill)
        cell_text(c, h, bold=True, color=ESPRESSO, size=10)
    if hint_row:
        r = t.add_row()
        for i, h in enumerate(hint_row):
            cell_text(r.cells[i], h, italic=True, color=SOFT, size=9)
    for row in rows:
        r = t.add_row()
        for i, v in enumerate(row):
            cell_text(r.cells[i], v, size=10)
        if row_height:
            r.height = Inches(row_height)
    set_widths(t, widths)
    return t


def kv_table(doc, pairs, widths=(1.5, 2.0, 1.5, 1.9)):
    """Two label/value pairs per row."""
    rows = (len(pairs) + 1) // 2
    t = doc.add_table(rows=rows, cols=4)
    borders(t)
    for idx, label in enumerate(pairs):
        r, c = divmod(idx, 2)
        lc, vc = t.rows[r].cells[c * 2], t.rows[r].cells[c * 2 + 1]
        shade(lc, LINEN_DEEP)
        cell_text(lc, label, bold=True, color=ESPRESSO, size=10)
        cell_text(vc, "", size=10)
    set_widths(t, widths)
    return t


# ---------------------------------------------------------------- run of show
def make_run_of_show():
    doc = new_doc("Event and roadshow run-of-show")
    title_block(doc, "Run-of-show", "Event or roadshow. Fill in the shaded fields, then share the final version with the team.")
    kv_table(doc, ["Event", "Date", "Venue", "Event lead", "Start time", "End time", "Headcount", "Dress code"])
    heading(doc, "Timeline")
    grid(
        doc,
        ["Time", "Length", "What happens", "Owner", "Notes"],
        [["", "", "", "", ""] for _ in range(14)],
        [0.8, 0.7, 2.6, 1.2, 1.6],
        row_height=0.32,
        hint_row=["Example: 08:15", "15 min", "Car service departs", "Logistics", "Two vehicles"],
    )
    heading(doc, "Key contacts")
    grid(doc, ["Name", "Role", "Phone", "Notes"], [["", "", "", ""] for _ in range(5)], [1.7, 1.6, 1.4, 2.2], row_height=0.3)
    heading(doc, "Logistics")
    grid(
        doc,
        ["Area", "Details"],
        [[a, ""] for a in ["Transportation", "Meals and dietary needs", "Venue and AV", "Materials and printing", "Backup plan"]],
        [1.9, 5.0],
        row_height=0.4,
    )
    heading(doc, "Notes")
    for _ in range(3):
        p = doc.add_paragraph()
        run(p, "_" * 86, color=ROSE, size=10)
    path = os.path.join(OUT, "event-run-of-show.docx")
    doc.save(path)
    scrub_zip(path)


# ---------------------------------------------------------------- move checklist
PHASES = [
    ("About three months out", [
        "Confirm the move date and the budget",
        "Review lease obligations and notice dates for the current space",
        "Name the move lead and brief the move team",
        "Request quotes from movers and key vendors",
        "Draft the floor plan and seating plan",
    ]),
    ("Six to eight weeks out", [
        "Book the mover and collect insurance certificates",
        "Order furniture and equipment",
        "Coordinate network, phone, and cabling for the new space",
        "Reserve elevators and the loading dock with building management",
        "Update the vendor list: utilities, supplies, cleaning, security",
    ]),
    ("Four weeks out", [
        "Share the move plan with everyone affected",
        "Order signage, keys, and access cards",
        "Update the new address with banks, insurers, and mailing lists",
        "Start the clear-out: shred, recycle, donate",
        "Set the labeling and packing scheme",
    ]),
    ("Final week", [
        "Send packing instructions and deadlines",
        "Confirm elevator, dock, and mover arrival times",
        "Walk through the new space",
        "Confirm the IT cutover plan",
        "Complete a final inventory",
    ]),
    ("Move day", [
        "Move lead on site at both ends",
        "Check crates and labels against the inventory",
        "Hand out keys and access cards",
        "Record any damage before the mover leaves",
        "Keep the emergency contact list at hand",
    ]),
    ("After the move", [
        "Walk the space and build the punch list",
        "Test phones, printers, and meeting rooms",
        "Update emergency and evacuation plans",
        "Return keys and inspect the old space",
        "Collect feedback from the team",
        "Close out mover and vendor invoices",
    ]),
]


def make_move_checklist():
    doc = new_doc("Office move checklist")
    title_block(doc, "Office move checklist", "Work through each phase in order. Add, remove, and reassign tasks to suit your move.")
    kv_table(doc, ["Move date", "Move lead", "Moving from", "Moving to"])
    for name, tasks in PHASES:
        heading(doc, name)
        t = grid(doc, ["", "Task", "Owner", "Due"], [["☐", x, "", ""] for x in tasks], [0.35, 4.0, 1.4, 1.1])
        for r in t.rows[1:]:
            for p in r.cells[0].paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                for rn in p.runs:
                    rn.font.name = "Segoe UI Symbol"
                    rn.font.size = Pt(12)
    path = os.path.join(OUT, "office-move-checklist.docx")
    doc.save(path)
    scrub_zip(path)


# ---------------------------------------------------------------- tracker xlsx
def make_tracker():
    wb = Workbook()
    ws = wb.active
    ws.title = "Tracker"
    first, last = 5, 104
    thin = Side(style="thin", color=ROSE)
    box = Border(left=thin, right=thin, top=thin, bottom=thin)

    ws["A1"] = "Vendor and contract tracker"
    ws["A1"].font = Font(name=HEAD_FONT, size=20, bold=True, color=ESPRESSO)
    ws["A2"] = "Enter vendors below. Days to renewal and the highlights update automatically. The three example rows can be deleted."
    ws["A2"].font = Font(name=BODY_FONT, size=10, color=SOFT)
    ws.row_dimensions[1].height = 30

    headers = ["Vendor", "Service", "Owner", "Annual spend", "Contract start", "Renewal date", "Notice (days)",
               "Notice deadline", "Days to renewal", "Renewal flag", "Status", "Notes"]
    widths = [26, 20, 16, 14, 14, 14, 12, 15, 14, 22, 16, 34]
    for i, (h, w) in enumerate(zip(headers, widths), start=1):
        c = ws.cell(row=4, column=i, value=h)
        c.font = Font(name=BODY_FONT, bold=True, color=ESPRESSO, size=10)
        c.fill = PatternFill("solid", fgColor=ROSE)
        c.alignment = Alignment(vertical="center", wrap_text=True)
        c.border = box
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[4].height = 30

    examples = [
        ("Example vendor A", "Cleaning", "Office manager", 12000, "=TODAY()-300", "=TODAY()+25", 30, "Active", "Example row. Delete or overwrite."),
        ("Example vendor B", "Equipment lease", "Office manager", 8400, "=TODAY()-200", "=TODAY()+70", 60, "Active", "Example row. Delete or overwrite."),
        ("Example vendor C", "Software", "IT lead", 5000, "=TODAY()-100", "=TODAY()+200", 30, "Active", "Example row. Delete or overwrite."),
    ]
    for r in range(first, last + 1):
        ex = examples[r - first] if r - first < len(examples) else None
        vals = {1: ex[0] if ex else None, 2: ex[1] if ex else None, 3: ex[2] if ex else None,
                4: ex[3] if ex else None, 5: ex[4] if ex else None, 6: ex[5] if ex else None,
                7: ex[6] if ex else None, 11: ex[7] if ex else None, 12: ex[8] if ex else None}
        for col, v in vals.items():
            if v is not None:
                ws.cell(row=r, column=col, value=v)
        ws.cell(row=r, column=8, value='=IF(OR(F%d="",G%d=""),"",F%d-G%d)' % (r, r, r, r))
        ws.cell(row=r, column=9, value='=IF(F%d="","",F%d-TODAY())' % (r, r))
        ws.cell(row=r, column=10, value=(
            '=IF(F{r}="","",IF(F{r}<TODAY(),"Past due",IF(F{r}-TODAY()<=30,"Renewing in 30 days",'
            'IF(F{r}-TODAY()<=90,"Renewing in 90 days",""))))').format(r=r))
        for col in range(1, 13):
            c = ws.cell(row=r, column=col)
            c.border = box
            c.font = Font(name=BODY_FONT, size=10, color=TEXT)
            c.alignment = Alignment(vertical="center", wrap_text=(col == 12))
        ws.cell(row=r, column=4).number_format = '"$"#,##0'
        for col in (5, 6, 8):
            ws.cell(row=r, column=col).number_format = "mmm d, yyyy"
        ws.cell(row=r, column=9).number_format = "0"

    rng = "A%d:L%d" % (first, last)
    # Order matters: first match wins.
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['$K%d="Terminated"' % first], font=Font(color="9A8C80", strike=True), stopIfTrue=True))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['AND($F%d<>"",$F%d<TODAY())' % (first, first)],
        fill=PatternFill("solid", bgColor="D9B0A6"), font=Font(color=ROSE_INK, bold=True), stopIfTrue=True))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['AND($F%d<>"",$F%d-TODAY()<=30)' % (first, first)],
        fill=PatternFill("solid", bgColor="E6C3BB"), font=Font(color=ESPRESSO, bold=True), stopIfTrue=True))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=['AND($F%d<>"",$F%d-TODAY()<=90)' % (first, first)],
        fill=PatternFill("solid", bgColor=ROSE_PALE), font=Font(color=ESPRESSO)))

    dv = DataValidation(type="list", formula1='"Active,In negotiation,Expired,Terminated"', allow_blank=True)
    dv.add("K%d:K%d" % (first, last))
    ws.add_data_validation(dv)
    dn = DataValidation(type="whole", operator="greaterThanOrEqual", formula1="0", allow_blank=True)
    dn.add("G%d:G%d" % (first, last))
    ws.add_data_validation(dn)

    ws.freeze_panes = "B5"
    ws.auto_filter.ref = "A4:L%d" % last
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_title_rows = "4:4"
    ws.oddFooter.left.text = LICENSE
    ws.oddFooter.left.size = 8
    ws.sheet_properties.tabColor = ROSE

    # Summary
    s = wb.create_sheet("Summary")
    s.sheet_view.showGridLines = False
    s["A1"] = "Summary"
    s["A1"].font = Font(name=HEAD_FONT, size=20, bold=True, color=ESPRESSO)
    rows = [
        ("Vendors tracked", "=COUNTA(Tracker!A%d:A%d)" % (first, last), "0"),
        ("Total annual spend", "=SUM(Tracker!D%d:D%d)" % (first, last), '"$"#,##0'),
        ("Renewing in the next 90 days", '=COUNTIFS(Tracker!I%d:I%d,">=0",Tracker!I%d:I%d,"<=90")' % (first, last, first, last), "0"),
        ("Annual spend renewing in 90 days", '=SUMIFS(Tracker!D%d:D%d,Tracker!I%d:I%d,">=0",Tracker!I%d:I%d,"<=90")' % (first, last, first, last, first, last), '"$"#,##0'),
        ("Renewing in the next 30 days", '=COUNTIFS(Tracker!I%d:I%d,">=0",Tracker!I%d:I%d,"<=30")' % (first, last, first, last), "0"),
        ("Past due", '=COUNTIF(Tracker!I%d:I%d,"<0")' % (first, last), "0"),
    ]
    for i, (label, f, fmt) in enumerate(rows, start=3):
        a, b = s.cell(row=i, column=1, value=label), s.cell(row=i, column=2, value=f)
        a.font = Font(name=BODY_FONT, size=11, color=TEXT)
        b.font = Font(name=HEAD_FONT, size=13, bold=True, color=ESPRESSO)
        b.number_format = fmt
        b.alignment = Alignment(horizontal="left")
        a.border = Border(bottom=thin)
        b.border = Border(bottom=thin)
    s.column_dimensions["A"].width = 38
    s.column_dimensions["B"].width = 18
    s.oddFooter.left.text = LICENSE
    s.oddFooter.left.size = 8
    s["A11"] = LICENSE
    s["A11"].font = Font(name=BODY_FONT, size=9, color=SOFT)

    # How to use
    h = wb.create_sheet("How to use")
    h.sheet_view.showGridLines = False
    h["A1"] = "How to use this tracker"
    h["A1"].font = Font(name=HEAD_FONT, size=20, bold=True, color=ESPRESSO)
    steps = [
        "1. On the Tracker sheet, replace the three example rows with your vendors. Add up to 100 rows.",
        "2. Enter the renewal date and the notice period in days. The notice deadline is worked out for you.",
        "3. Rows renewing within 90 days are tinted. Within 30 days they are stronger. Past due rows are the strongest.",
        "4. Set the status from the drop-down. Terminated rows are greyed out and struck through.",
        "5. The Summary sheet totals spend and counts upcoming renewals.",
        "6. Use the filter arrows in the header row to sort by renewal date, owner, or status.",
    ]
    for i, t in enumerate(steps, start=3):
        c = h.cell(row=i, column=1, value=t)
        c.font = Font(name=BODY_FONT, size=11, color=TEXT)
        c.alignment = Alignment(wrap_text=True, vertical="top")
        h.row_dimensions[i].height = 32
    h.column_dimensions["A"].width = 110
    h["A10"] = LICENSE
    h["A10"].font = Font(name=BODY_FONT, size=9, color=SOFT)
    h.oddFooter.left.text = LICENSE
    h.oddFooter.left.size = 8

    p = wb.properties
    p.creator = ""
    p.lastModifiedBy = ""
    p.title = "Vendor and contract tracker"
    p.subject = ""
    p.description = ""
    p.keywords = ""
    p.category = ""
    p.created = FIXED_DATE
    p.modified = FIXED_DATE
    path = os.path.join(OUT, "vendor-contract-tracker.xlsx")
    wb.save(path)
    scrub_zip(path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    make_tracker()
    make_run_of_show()
    make_move_checklist()
    print("Generated 3 templates in", OUT)
