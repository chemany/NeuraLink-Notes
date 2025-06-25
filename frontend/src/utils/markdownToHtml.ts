import { marked } from 'marked';

/**
 * 将Markdown文本转换为HTML格式
 * 专门用于AI回答保存到富文本编辑器时的格式转换
 * @param markdown - 输入的markdown文本
 * @returns 转换后的HTML字符串
 */
export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';

  try {
    // 预处理markdown文本，修复换行问题
    let processedMarkdown = markdown
      // 🔥 强制将编号标题转换为明确的标题格式
      .replace(/^(\d+\.\s*)(.+)$/gm, '### $1$2')
      // 修复编号标题：确保数字和标题内容在同一行 (更精确的匹配)
      .replace(/^(\d+\.\s*)\n+([^\n]+)/gm, '### $1$2')
      .replace(/^(\d+\.\s*)[\r\n]+([^\r\n]+)/gm, '### $1$2')
      // 🔥 修复列表项：确保标记和内容在同一行，并清理多余换行
      .replace(/^(\s*[-*•]\s*)\n+(.+)/gm, '$1$2')
      .replace(/^(\s*[-*•]\s*)(.+?)\n+([^-*•\n#\d])/gm, '$1$2 $3')
      // 修复其他可能的不当换行 - 更加保守的处理
      .replace(/([。！？])\n+([^\n#\-*•\d\s])/g, '$1\n\n$2')
      // 移除标题标记和内容之间的换行符
      .replace(/^(#{1,6}\s*)\n+(.+)/gm, '$1$2');

    // 配置marked选项
    marked.setOptions({
      gfm: true, // 启用GitHub Flavored Markdown
      breaks: false, // 关闭自动换行转<br>，避免不必要的换行
    });

    // 转换markdown为HTML
    const html = marked(processedMarkdown) as string;
    
    // 清理一些可能的问题并处理中文排版格式
    let cleanedHtml = html
      .replace(/^<p><\/p>$/gm, '') // 移除空段落
      .replace(/\n\s*\n/g, '\n') // 清理多余的空行
      .replace(/^\s+/gm, '') // 移除每行开头的空白字符
      .replace(/\s+$/gm, '') // 移除每行末尾的空白字符
      // 🎯 关键修复：处理被错误分割的编号标题
      .replace(/<p>(\d+\.)\s*<\/p>\s*<p>([^<]+)<\/p>/g, '<h3>$1$2</h3>')
      .replace(/<p>(\d+\.)\s*<\/p>\s*([^<\n]+)/g, '<h3>$1$2</h3>')
      // 处理其他可能的分割情况
      .replace(/<p>(\d+\.\s*)<br\s*\/?>\s*([^<]+)<\/p>/g, '<h3>$1$2</h3>')
      .trim();
    
    // 🔥 彻底解决列表项问题：将列表转换为带有自定义bullet的段落
    cleanedHtml = cleanedHtml
      // 提取列表项内容并转换为段落形式
      .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/g, (match, listContent) => {
        // 提取所有li内容
        const listItems = listContent.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
        return listItems.map((item: string) => {
          const content = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/, '$1')
            .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1') // 移除内嵌的p标签
            .replace(/<br\s*\/?>/g, ' ') // 将br转换为空格
            .trim();
          return `<p style="text-indent: 0; margin: 0.3em 0; padding: 0; padding-left: 1.5em; position: relative; white-space: normal;"><span style="position: absolute; left: 0; color: #333;">•</span>${content}</p>`;
        }).join('');
      })
      // 处理有序列表
      .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/g, (match, listContent) => {
        const listItems = listContent.match(/<li[^>]*>([\s\S]*?)<\/li>/g) || [];
        return listItems.map((item: string, index: number) => {
          const content = item.replace(/<li[^>]*>([\s\S]*?)<\/li>/, '$1')
            .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1') // 移除内嵌的p标签
            .replace(/<br\s*\/?>/g, ' ') // 将br转换为空格
            .trim();
          return `<p style="text-indent: 0; margin: 0.3em 0; padding: 0; padding-left: 1.5em; position: relative; white-space: normal;"><span style="position: absolute; left: 0; color: #333;">${index + 1}.</span>${content}</p>`;
        }).join('');
      });
    
    // 为段落添加中文排版样式：首行缩进两个字符
    cleanedHtml = cleanedHtml.replace(
      /<p>/g, 
      '<p style="text-indent: 2em; margin: 0.5em 0; padding: 0; white-space: normal;">'
    );
    
    // 确保标题没有缩进且在一行显示
    cleanedHtml = cleanedHtml.replace(
      /<(h[1-6])>/g, 
      '<$1 style="text-indent: 0; margin: 0.5em 0; padding: 0; white-space: nowrap; display: block;">'
    );
    
    // 特别处理h3标题（编号标题）
    cleanedHtml = cleanedHtml.replace(
      /<h3([^>]*)>/g, 
      '<h3$1 style="text-indent: 0; margin: 0.5em 0; padding: 0; white-space: nowrap; display: block; font-size: 1.1em; font-weight: bold;">'
    );
    
    // 优化列表样式
    cleanedHtml = cleanedHtml.replace(
      /<ul>/g, 
      '<ul style="margin: 0.5em 0; padding-left: 2em;">'
    );
    cleanedHtml = cleanedHtml.replace(
      /<ol>/g, 
      '<ol style="margin: 0.5em 0; padding-left: 2em;">'
    );
    cleanedHtml = cleanedHtml.replace(
      /<li>/g, 
      '<li style="text-indent: 0; margin: 0; padding: 0; white-space: normal; display: list-item; line-height: 1.5;">'
    );
    
    console.log('[convertMarkdownToHtml] 原始文本:', markdown);
    console.log('[convertMarkdownToHtml] 转换结果:', cleanedHtml);
    
    return cleanedHtml;
  } catch (error) {
    console.error('[markdownToHtml] 转换失败:', error);
    // 如果marked转换失败，回退到简单的文本格式
    return `<p>${markdown.replace(/\n/g, '<br>')}</p>`;
  }
};

/**
 * 检测文本是否包含markdown语法
 * @param text - 待检测的文本
 * @returns 是否包含markdown语法
 */
export const containsMarkdown = (text: string): boolean => {
  if (!text) return false;
  
  // 检测常见的markdown语法标记
  const markdownPatterns = [
    /^#{1,6}\s/, // 标题
    /\*\*.*?\*\*/, // 粗体
    /\*.*?\*/, // 斜体
    /`.*?`/, // 行内代码
    /```[\s\S]*?```/, // 代码块
    /^\s*[-*+]\s/, // 无序列表
    /^\s*\d+\.\s/, // 有序列表
    /^\s*>\s/, // 引用
    /\[.*?\]\(.*?\)/, // 链接
    /!\[.*?\]\(.*?\)/, // 图片
  ];
  
  return markdownPatterns.some(pattern => pattern.test(text));
};

/**
 * 智能转换函数：如果文本包含markdown语法则转换，否则保持原样
 * @param text - 输入文本
 * @returns 处理后的HTML
 */
export const smartConvertToHtml = (text: string): string => {
  if (!text) return '';
  
  // 如果包含markdown语法，则转换
  if (containsMarkdown(text)) {
    return convertMarkdownToHtml(text);
  }
  
  // 否则只做基本的HTML转义和换行处理
  return `<p>${text.replace(/\n/g, '<br>')}</p>`;
}; 