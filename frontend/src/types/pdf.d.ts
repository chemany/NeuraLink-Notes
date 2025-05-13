declare module 'pdfjs-dist' {
  interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }

  interface PDFPageProxy {
    getTextContent(): Promise<PDFTextContent>;
  }

  interface PDFTextContent {
    items: Array<PDFTextItem>;
  }

  interface PDFTextItem {
    str?: string;
    [key: string]: any;
  }

  interface GlobalWorkerOptions {
    workerSrc: string;
  }

  export const GlobalWorkerOptions: GlobalWorkerOptions;

  export function getDocument(params: {
    data: ArrayBuffer;
  }): PDFDocumentLoadingTask;

  export const version: string;
} 