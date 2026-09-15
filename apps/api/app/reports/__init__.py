"""PDF/report generation layer.

Pipeline::

    Application Data → Report Generator → PDF

Datasets are pure functions over domain rows; rendering is one WeasyPrint
helper with RTL/Persian styling. New report types add a dataset + template,
never a new PDF stack.
"""

from app.reports.pdf import render_pdf
from app.reports.students import student_list_dataset

__all__ = ["render_pdf", "student_list_dataset"]
