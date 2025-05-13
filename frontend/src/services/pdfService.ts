// 检查是否在客户端环境，仅在客户端环境加载PDF.js
const isBrowser = typeof window !== 'undefined';

// 仅在客户端环境加载PDF.js
let pdfjsLib: any = null;
if (isBrowser) {
  // 动态导入PDF.js
  import('pdfjs-dist/build/pdf').then((pdfjs) => {
    pdfjsLib = pdfjs;
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
  }).catch(error => {
    console.error('Error loading PDF.js:', error);
  });
}

/**
 * 从PDF文件中提取文本
 * @param file PDF文件对象
 * @returns 提取的文本内容
 */
export const extractTextFromPDF = async (file: File): Promise<string> => {
  if (!isBrowser || !pdfjsLib) {
    throw new Error('PDF处理功能仅在浏览器环境支持');
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    
    // 加载PDF文档
    const pdfDoc = await pdfjsLib.getDocument({ data: typedArray }).promise;
    
    let fullText = '';
    
    // 逐页提取文本
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const content = await page.getTextContent();
      
      // 收集页面中的文本
      const pageText = content.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('提取PDF文本失败:', error);
    throw new Error('处理PDF文件时出错: ' + (error instanceof Error ? error.message : String(error)));
  }
};

/**
 * 处理PDF文本，去除多余的空格和换行
 * @param text 原始文本内容
 * @returns 处理后的文本
 */
export const preprocessPDFText = (text: string): string => {
  // 替换多个连续空白字符为单个空格
  let processedText = text.replace(/\s+/g, ' ');
  
  // 修复常见的断行问题，如句子在行尾断开的情况
  processedText = processedText.replace(/(\w)-\s+(\w)/g, '$1$2');
  
  // 修复段落断行
  processedText = processedText.replace(/(\w)\s+(\w)/g, (match, p1, p2) => {
    // 如果前一个字符是句号等标点，保留空格
    if (/[.!?]/.test(p1)) {
      return `${p1} ${p2}`;
    }
    // 否则可能是段落内的断行，去除空格
    return `${p1}${p2}`;
  });
  
  return processedText;
}; 