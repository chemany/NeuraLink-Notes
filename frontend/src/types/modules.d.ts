// 用于模块声明的文件

// 为pdfjs-dist模块添加类型声明
declare module 'pdfjs-dist/build/pdf' {
  // 导出PDF.js库的全部API
  export * from 'pdfjs-dist';
}

// 为缺少类型定义的其他模块添加声明
declare module 'react-file-viewer'; 