declare module 'pptx2json' {
  interface SlideContent {
    text?: string;
    table?: Array<Array<{ text: string }>>;
    list?: Array<{ text: string }>;
    children?: SlideContent[];
  }

  interface Slide {
    title?: string;
    content?: SlideContent | SlideContent[];
    notes?: string;
  }

  interface PPTXContent {
    slides: Slide[];
  }

  interface PPTX2JSON {
    parse(buffer: ArrayBuffer): Promise<PPTXContent>;
  }

  const pptx2json: PPTX2JSON;
  export default pptx2json;
} 