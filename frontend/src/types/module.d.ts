/**
 * Type declarations for modules without type definitions
 */

declare module 'react-file-viewer' {
  import React from 'react';
  
  interface FileViewerProps {
    filePath: string;
    fileType: string;
    onError?: (error: any) => void;
    [key: string]: any;
  }
  
  const FileViewer: React.FC<FileViewerProps>;
  export default FileViewer;
}

declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, options?: { autoBom?: boolean }): void;
} 