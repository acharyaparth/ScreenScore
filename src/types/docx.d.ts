declare module 'docx' {
  export class Document {
    constructor(options: {
      sections: Array<{
        properties?: any;
        children: Array<Paragraph | Table | null>;
      }>;
    });
  }

  export class Packer {
    static toBlob(doc: Document): Promise<Blob>;
  }

  export class Paragraph {
    constructor(options: {
      text?: string;
      heading?: HeadingLevel;
      spacing?: {
        before?: number;
        after?: number;
      };
    });
  }

  export enum HeadingLevel {
    TITLE = 'TITLE',
    HEADING_1 = 'HEADING_1',
    HEADING_2 = 'HEADING_2',
    HEADING_3 = 'HEADING_3',
    HEADING_4 = 'HEADING_4',
    HEADING_5 = 'HEADING_5',
    HEADING_6 = 'HEADING_6'
  }

  export class Table {
    constructor(options: {
      width?: {
        size: number;
        type: 'pct' | 'dxa';
      };
      borders?: {
        top?: Border;
        bottom?: Border;
        left?: Border;
        right?: Border;
      };
      rows: TableRow[];
    });
  }

  export class TableRow {
    constructor(options: {
      children: TableCell[];
    });
  }

  export class TableCell {
    constructor(options: {
      children: Paragraph[];
      width?: {
        size: number;
        type: 'pct' | 'dxa';
      };
    });
  }

  export interface Border {
    style: BorderStyle;
    size: number;
  }

  export enum BorderStyle {
    SINGLE = 'single',
    DOUBLE = 'double',
    DASHED = 'dashed',
    DOTTED = 'dotted'
  }
} 