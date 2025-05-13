import mammoth from 'mammoth';
import { DocumentStatus } from '@/types/shared_local';
import JSZip from 'jszip';

/**
 * 从Word文档中提取文本
 * @param file Word文档文件
 * @returns 提取的文本内容
 */
export const extractTextFromWord = async (file: File): Promise<string> => {
  try {
    console.log(`开始从Word文档提取文本: ${file.name}`);
    
    // 将文件转换为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 使用mammoth转换Word文档为HTML
    const result = await mammoth.convertToHtml({ arrayBuffer });
    
    // 获取转换后的HTML
    const html = result.value;
    
    // 如果有警告，记录下来
    if (result.messages.length > 0) {
      console.warn('Word文档转换警告:', result.messages);
    }
    
    // 将HTML转换为纯文本
    const text = html
      // 移除HTML标签
      .replace(/<[^>]+>/g, '\n')
      // 处理特殊字符
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      // 移除多余的换行和空格
      .replace(/\n\s*\n/g, '\n\n')
      .trim();
    
    console.log(`Word文档文本提取完成，总长度: ${text.length}`);
    return text;
    
  } catch (error) {
    console.error('Word文档处理失败:', error);
    throw new Error(`Word文档处理失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 从PPT文档中提取文本
 * @param file PPT文档文件
 * @returns 提取的文本内容
 */
export const extractTextFromPPT = async (file: File): Promise<string> => {
  try {
    console.log(`开始从PPT文档提取文本: ${file.name}`);
    
    // 将文件转换为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // 使用JSZip解压PPTX文件
    const zip = new JSZip();
    const pptxZip = await zip.loadAsync(arrayBuffer);
    
    console.log("PPTX文件已解压，开始解析内容");
    
    // 存储提取的文本
    const textContent: string[] = [];
    const slideTexts: Map<number, string[]> = new Map();
    
    // 获取所有的幻灯片文件 (ppt/slides/slide1.xml, slide2.xml, etc.)
    const slideFiles: string[] = [];
    const slideRegex = /ppt\/slides\/slide(\d+)\.xml/;
    
    // 收集所有幻灯片文件
    pptxZip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && slideRegex.test(relativePath)) {
        slideFiles.push(relativePath);
      }
    });
    
    console.log(`找到 ${slideFiles.length} 张幻灯片`);
    
    // 排序幻灯片文件
    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(slideRegex)?.[1] || "0");
      const numB = parseInt(b.match(slideRegex)?.[1] || "0");
      return numA - numB;
    });
    
    // 处理每个幻灯片文件
    for (const slideFile of slideFiles) {
      const slideNum = parseInt(slideFile.match(slideRegex)?.[1] || "0");
      console.log(`处理第 ${slideNum} 张幻灯片`);
      
      // 获取幻灯片XML内容
      const slideXML = await pptxZip.file(slideFile)?.async("text");
      if (!slideXML) {
        console.warn(`无法读取第 ${slideNum} 张幻灯片内容`);
        continue;
      }
      
      // 提取文本内容 (在<a:t>标签中)
      const textMatches = slideXML.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const texts = textMatches.map(match => {
        // 提取<a:t>标签中的文本内容并解码XML实体
        return match
          .replace(/<a:t>|<\/a:t>/g, '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .trim();
      }).filter(text => text.length > 0);
      
      // 存储这张幻灯片的文本
      slideTexts.set(slideNum, texts);
    }
    
    // 按顺序添加各个幻灯片的文本
    for (let i = 1; i <= slideFiles.length; i++) {
      const texts = slideTexts.get(i) || [];
      
      // 添加幻灯片标题
      textContent.push(`--- 幻灯片 ${i} ---`);
      
      // 添加幻灯片内容
      if (texts.length > 0) {
        textContent.push(...texts);
      } else {
        textContent.push("(无文本内容)");
      }
      
      textContent.push(''); // 添加空行分隔幻灯片
    }
    
    // 合并所有文本
    const fullText = textContent.join('\n');
    
    console.log(`PPT文档文本提取完成，总长度: ${fullText.length}`);
    return fullText;
    
  } catch (error) {
    console.error('PPT文档处理失败:', error);
    throw new Error(`PPT文档处理失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}; 