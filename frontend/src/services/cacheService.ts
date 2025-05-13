/**
 * 缓存服务模块
 * 提供清理各种缓存的功能
 */

/**
 * 清理文档缓存
 * 清除与文档相关的所有缓存数据
 */
export const clearDocumentCache = async (): Promise<void> => {
  try {
    // 清理文档相关的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('doc_') || 
        key.startsWith('document_') ||
        key.includes('_doc_') ||
        key.includes('_document_')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 批量删除缓存项
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`已清理 ${keysToRemove.length} 个文档缓存项`);
  } catch (error) {
    console.error('清理文档缓存失败:', error);
    throw error;
  }
};

/**
 * 清理嵌入缓存
 * 清除与文档嵌入向量相关的缓存数据
 */
export const clearEmbeddingCache = async (): Promise<void> => {
  try {
    // 清理嵌入相关的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('embed_') || 
        key.includes('_embed_') ||
        key.includes('embedding')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 批量删除缓存项
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`已清理 ${keysToRemove.length} 个嵌入缓存项`);
  } catch (error) {
    console.error('清理嵌入缓存失败:', error);
    throw error;
  }
};

/**
 * 清理向量缓存
 * 清除与文档向量相关的缓存数据
 */
export const clearVectorCache = async (): Promise<void> => {
  try {
    // 清理向量相关的localStorage项
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('vector_') || 
        key.includes('_vector_') ||
        key.includes('vectors')
      )) {
        keysToRemove.push(key);
      }
    }
    
    // 批量删除缓存项
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`已清理 ${keysToRemove.length} 个向量缓存项`);
  } catch (error) {
    console.error('清理向量缓存失败:', error);
    throw error;
  }
}; 