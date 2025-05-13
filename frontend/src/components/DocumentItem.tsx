import { Document } from '@/types';
import { formatFileSize } from '@/utils/formatters';

interface DocumentItemProps {
  document: Document;
  onSelect?: (document: Document) => void;
}

export default function DocumentItem({ document, onSelect }: DocumentItemProps) {
  // 格式化上传日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
  };

  // 处理点击
  const handleClick = () => {
    if (onSelect) {
      onSelect(document);
    }
  };

  return (
    <div 
      className="p-3 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <h3 className="font-medium text-gray-900 truncate">
        {document.fileName}
      </h3>
      <div className="text-xs text-gray-500 mt-1">
        上传于 {formatDate(document.createdAt)} · {formatFileSize(document.fileSize)}
      </div>
      <div className="flex items-center text-xs text-gray-500 mt-1">
        <span className="mr-2">{document.textChunks ? document.textChunks.length : 0} 个文本块</span>
        <span>{document.fileType}</span>
      </div>
    </div>
  );
} 