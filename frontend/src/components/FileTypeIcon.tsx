import React from 'react';
import { 
  DocumentTextIcon,
  DocumentIcon,
  PhotoIcon,
  FilmIcon,
  MusicalNoteIcon,
  ArchiveBoxIcon,
  CodeBracketIcon,
  TableCellsIcon,
  PresentationChartLineIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

interface FileTypeIconProps {
  fileName?: string;
  fileType?: 'notebook' | 'pdf' | 'doc' | 'image' | 'video' | 'audio' | 'archive' | 'code' | 'excel' | 'powerpoint' | 'unknown';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const getFileTypeFromName = (fileName: string): string => {
  if (!fileName) return 'unknown';
  
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // 文档类型
  if (['pdf'].includes(extension)) return 'pdf';
  if (['doc', 'docx', 'rtf', 'txt', 'md'].includes(extension)) return 'doc';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'excel';
  if (['ppt', 'pptx'].includes(extension)) return 'powerpoint';
  
  // 媒体类型
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) return 'image';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(extension)) return 'audio';
  
  // 代码类型
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'json', 'xml', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'].includes(extension)) return 'code';
  
  // 压缩文件
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return 'archive';
  
  return 'unknown';
};

const sizeMap = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12'
};

const colorMap = {
  notebook: 'text-blue-500',
  pdf: 'text-red-500',
  doc: 'text-blue-600',
  excel: 'text-green-600',
  powerpoint: 'text-orange-500',
  image: 'text-purple-500',
  video: 'text-pink-500',
  audio: 'text-indigo-500',
  code: 'text-gray-600',
  archive: 'text-yellow-600',
  unknown: 'text-gray-400'
};

export default function FileTypeIcon({ fileName, fileType, size = 'md', className = '' }: FileTypeIconProps) {
  const type = fileType || (fileName ? getFileTypeFromName(fileName) : 'unknown');
  const iconSize = sizeMap[size];
  const iconColor = colorMap[type as keyof typeof colorMap] || colorMap.unknown;
  const iconClass = `${iconSize} ${iconColor} ${className}`;

  switch (type) {
    case 'notebook':
      return <DocumentTextIcon className={iconClass} />;
    case 'pdf':
      return <DocumentArrowDownIcon className={iconClass} />;
    case 'doc':
      return <DocumentIcon className={iconClass} />;
    case 'excel':
      return <TableCellsIcon className={iconClass} />;
    case 'powerpoint':
      return <PresentationChartLineIcon className={iconClass} />;
    case 'image':
      return <PhotoIcon className={iconClass} />;
    case 'video':
      return <FilmIcon className={iconClass} />;
    case 'audio':
      return <MusicalNoteIcon className={iconClass} />;
    case 'code':
      return <CodeBracketIcon className={iconClass} />;
    case 'archive':
      return <ArchiveBoxIcon className={iconClass} />;
    default:
      return <DocumentIcon className={iconClass} />;
  }
}

// 导出类型判断函数供其他组件使用
export { getFileTypeFromName };