import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  AlignmentType, 
  HeadingLevel,
  VerticalAlign,
  ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { type Project, type Stakeholder } from '../../../App';

/**
 * Basic HTML to DOCX converter for Tiptap content.
 * Handles: <p>, <ul>, <ol>, <li>, <strong>, <em>, <u>, <h1>, <h2>
 */
const parseHtmlToDocx = (html: string): Paragraph[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const paragraphs: Paragraph[] = [];

  const processNode = (node: Node): Paragraph[] => {
    const nodeParagraphs: Paragraph[] = [];

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      if (element.tagName === 'P') {
        nodeParagraphs.push(new Paragraph({
          children: processChildren(element),
          spacing: { after: 200 }
        }));
      } else if (element.tagName === 'UL' || element.tagName === 'OL') {
        const listItems = element.querySelectorAll('li');
        listItems.forEach((li) => {
          nodeParagraphs.push(new Paragraph({
            children: processChildren(li as HTMLElement),
            bullet: element.tagName === 'UL' ? { level: 0 } : undefined,
            numbering: element.tagName === 'OL' ? { reference: 'main-numbering', level: 0, instance: 0 } : undefined,
            spacing: { after: 120 }
          }));
        });
      } else if (element.tagName === 'H1') {
        nodeParagraphs.push(new Paragraph({
          text: element.textContent || '',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 }
        }));
      } else if (element.tagName === 'H2') {
        nodeParagraphs.push(new Paragraph({
          text: element.textContent || '',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300, after: 150 }
        }));
      } else {
        // Recursively process other tags
        Array.from(element.childNodes).forEach(child => {
          nodeParagraphs.push(...processNode(child));
        });
      }
    }
    return nodeParagraphs;
  };

  const processChildren = (element: HTMLElement): TextRun[] => {
    const runs: TextRun[] = [];
    Array.from(element.childNodes).forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        runs.push(new TextRun({ 
          text: child.textContent || '',
          font: "Calibri",
          size: 24 // 12pt
        }));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const text = el.textContent || '';
        runs.push(new TextRun({
          text,
          bold: el.tagName === 'STRONG' || el.tagName === 'B',
          italics: el.tagName === 'EM' || el.tagName === 'I',
          underline: el.tagName === 'U' ? {} : undefined,
          font: "Calibri",
          size: 24 // 12pt
        }));
      }
    });
    return runs;
  };

  Array.from(doc.body.childNodes).forEach(node => {
    paragraphs.push(...processNode(node));
  });

  return paragraphs;
};

export const exportNoteToWord = async (project: Project, noteData: { titleTemplate: string, stakeholders: Stakeholder[], content: string }) => {
  const now = new Date();
  const dateStr = format(now, 'yyyyMMdd');
  const timeStr = format(now, 'HHmm');
  const displayDateStr = format(now, 'd.MM.yyyy');
  const displayTimeStr = format(now, 'HH:mm');

  const customerStakeholders = noteData.stakeholders.filter(s => s.isPresent && s.company === 'customer');
  const contractorStakeholders = noteData.stakeholders.filter(s => s.isPresent && s.company === 'contractor');

  // Table rows for participants
  const participantRows: TableRow[] = [];

  const cellMargins = { top: 120, bottom: 120, left: 120, right: 120 };

  // Header row
  participantRows.push(new TableRow({
    children: [
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'Po stronie Zamawiającego:', bold: true, size: 28, font: "Calibri" })],
          spacing: { before: 80, after: 80 }
        })],
        shading: { fill: 'E2EFD9', type: ShadingType.CLEAR, color: 'auto' },
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins
      }),
      new TableCell({
        children: [new Paragraph({ 
          children: [new TextRun({ text: 'Po stronie Tukano Software House:', bold: true, size: 28, font: "Calibri" })],
          spacing: { before: 80, after: 80 }
        })],
        shading: { fill: 'E2EFD9', type: ShadingType.CLEAR, color: 'auto' },
        verticalAlign: VerticalAlign.CENTER,
        margins: cellMargins
      }),
    ],
  }));

  // Data row (single row with multiple paragraphs)
  participantRows.push(new TableRow({
    children: [
      new TableCell({
        children: customerStakeholders.length > 0
          ? customerStakeholders.map(s => new Paragraph({ 
              children: [new TextRun({ text: s.name, size: 28, font: "Calibri" })],
              spacing: { before: 60, after: 60 }
            }))
          : [new Paragraph({ text: '' })],
        margins: cellMargins,
        verticalAlign: VerticalAlign.TOP
      }),
      new TableCell({
        children: contractorStakeholders.length > 0
          ? contractorStakeholders.map(s => new Paragraph({ 
              children: [new TextRun({ text: s.name, size: 28, font: "Calibri" })],
              spacing: { before: 60, after: 60 }
            }))
          : [new Paragraph({ text: '' })],
        margins: cellMargins,
        verticalAlign: VerticalAlign.TOP
      }),
    ],
  }));

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: noteData.titleTemplate || `Spotkanie odbyło się ${displayDateStr} o godzinie ${displayTimeStr}`,
              bold: true,
              size: 28,
              font: "Calibri"
            }),
          ],
          spacing: { after: 400 },
        }),

        // Info
        new Paragraph({
          children: [
            new TextRun({
              text: 'W spotkaniu brały udział następujące osoby:',
              size: 28,
              font: "Calibri"
            }),
          ],
          spacing: { after: 200 },
        }),

        // Table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: participantRows,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
            left: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
            right: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
            insideVertical: { style: BorderStyle.SINGLE, size: 6, color: 'auto' },
          }
        }),

        // Spacer
        new Paragraph({ text: '', spacing: { before: 400, after: 400 } }),

        // Content
        ...parseHtmlToDocx(noteData.content),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fileName = `${project.code}_Notatka_spotkanie_${dateStr}_${timeStr}.docx`;
  saveAs(blob, fileName);
};
