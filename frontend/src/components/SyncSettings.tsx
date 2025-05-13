import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

const BACKEND_API_BASE = process.env.NEXT_PUBLIC_BACKEND_API_BASE || 'http://localhost:3001';

// 定义配置类型
interface SyncConfig {
  id: string;
  name: string;
  type: 'WEBDAV' | 'S3';
  isActive: boolean;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  s3Region?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Endpoint?: string;
}

export default function SyncSettings() {
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('webdav');
  
  // Form state for WebDAV
  const [webdavName, setWebdavName] = useState('');
  const [webdavUrl, setWebdavUrl] = useState('');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  
  // Form state for S3
  const [s3Name, setS3Name] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  
  useEffect(() => {
    fetchConfigurations();
  }, []);
  
  const fetchConfigurations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/configs`);
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      } else {
        toast.error('无法加载同步配置');
      }
    } catch (error) {
      console.error('加载同步配置失败:', error);
      toast.error('加载同步配置时发生错误');
    } finally {
      setLoading(false);
    }
  };
  
  const handleWebDAVSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!webdavName || !webdavUrl || !webdavUsername || !webdavPassword) {
      toast.error('请填写所有必填字段');
      return;
    }
    
    const config = {
      name: webdavName,
      type: 'WEBDAV' as const,
      webdavUrl,
      webdavUsername,
      webdavPassword,
      isActive: true
    };
    
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success('WebDAV 配置已保存');
        fetchConfigurations();
        
        // 重置表单
        setWebdavName('');
        setWebdavUrl('');
        setWebdavUsername('');
        setWebdavPassword('');
      } else {
        const errorData = await response.json();
        toast.error(`保存失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存WebDAV配置出错:', error);
      toast.error('保存配置时发生错误');
    }
  };
  
  const handleS3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!s3Name || !s3Region || !s3Bucket || !s3AccessKey || !s3SecretKey) {
      toast.error('请填写所有必填字段');
      return;
    }
    
    const config = {
      name: s3Name,
      type: 'S3' as const,
      s3Region,
      s3Bucket,
      s3AccessKey,
      s3SecretKey,
      s3Endpoint: s3Endpoint || undefined,
      isActive: true
    };
    
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      
      if (response.ok) {
        toast.success('S3 配置已保存');
        fetchConfigurations();
        
        // 重置表单
        setS3Name('');
        setS3Region('');
        setS3Bucket('');
        setS3AccessKey('');
        setS3SecretKey('');
        setS3Endpoint('');
      } else {
        const errorData = await response.json();
        toast.error(`保存失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存S3配置出错:', error);
      toast.error('保存配置时发生错误');
    }
  };
  
  const handleTestConnection = async (id: string) => {
    toast.loading('测试连接中...', { id: 'test-connection' });
    
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/configs/${id}/test`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || '连接测试成功', { id: 'test-connection' });
      } else {
        const errorData = await response.json();
        toast.error(`连接测试失败: ${errorData.message || '未知错误'}`, { id: 'test-connection' });
      }
    } catch (error) {
      console.error('连接测试出错:', error);
      toast.error('连接测试时发生错误', { id: 'test-connection' });
    }
  };
  
  const handleSync = async (id: string, direction: 'to-cloud' | 'from-cloud') => {
    const actionText = direction === 'to-cloud' ? '上传到云端' : '从云端下载';
    toast.loading(`${actionText}中...`, { id: `sync-${id}` });
    
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/${direction}/${id}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || `${actionText}成功`, { id: `sync-${id}` });
      } else {
        const errorData = await response.json();
        toast.error(`${actionText}失败: ${errorData.message || '未知错误'}`, { id: `sync-${id}` });
      }
    } catch (error) {
      console.error(`${actionText}出错:`, error);
      toast.error(`${actionText}时发生错误`, { id: `sync-${id}` });
    }
  };
  
  const handleDelete = async (id: string) => {
    const confirmation = window.confirm('确定要删除此同步配置吗？');
    if (!confirmation) return;
    
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/sync/configs/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        toast.success('同步配置已删除');
        fetchConfigurations();
      } else {
        const errorData = await response.json();
        toast.error(`删除失败: ${errorData.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('删除配置出错:', error);
      toast.error('删除配置时发生错误');
    }
  };
  
  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">云同步设置</h2>
      
      {/* 标签切换 */}
      <div className="flex border-b mb-4">
        <button 
          className={`px-4 py-2 ${activeTab === 'webdav' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('webdav')}
        >
          WebDAV
        </button>
        <button 
          className={`px-4 py-2 ${activeTab === 's3' ? 'border-b-2 border-blue-500' : ''}`}
          onClick={() => setActiveTab('s3')}
        >
          S3 存储
        </button>
      </div>
      
      {/* WebDAV表单 */}
      {activeTab === 'webdav' && (
        <form onSubmit={handleWebDAVSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">配置名称</label>
            <input 
              type="text" 
              value={webdavName}
              onChange={(e) => setWebdavName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例如: 我的网盘"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">WebDAV URL</label>
            <input 
              type="url" 
              value={webdavUrl}
              onChange={(e) => setWebdavUrl(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例如: https://dav.jianguoyun.com/dav/"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">用户名</label>
            <input 
              type="text" 
              value={webdavUsername}
              onChange={(e) => setWebdavUsername(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="WebDAV 用户名"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">密码</label>
            <input 
              type="password" 
              value={webdavPassword}
              onChange={(e) => setWebdavPassword(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="WebDAV 密码"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            保存 WebDAV 配置
          </button>
        </form>
      )}
      
      {/* S3表单 */}
      {activeTab === 's3' && (
        <form onSubmit={handleS3Submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">配置名称</label>
            <input 
              type="text" 
              value={s3Name}
              onChange={(e) => setS3Name(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例如: 我的 S3 存储"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">区域 (Region)</label>
            <input 
              type="text" 
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例如: us-east-1"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">存储桶 (Bucket)</label>
            <input 
              type="text" 
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="S3 Bucket 名称"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">访问密钥 (Access Key)</label>
            <input 
              type="text" 
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="S3 Access Key"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">秘密密钥 (Secret Key)</label>
            <input 
              type="password" 
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="S3 Secret Key"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">终端节点 (Endpoint) <span className="text-gray-500 text-xs">可选，用于MinIO等兼容S3的服务</span></label>
            <input 
              type="text" 
              value={s3Endpoint}
              onChange={(e) => setS3Endpoint(e.target.value)}
              className="w-full border rounded px-3 py-2"
              placeholder="例如: https://play.min.io:9000"
            />
          </div>
          
          <button 
            type="submit" 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            保存 S3 配置
          </button>
        </form>
      )}
      
      {/* 已有配置列表 */}
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-2">已保存的配置</h3>
        {loading ? (
          <p className="text-gray-500">加载中...</p>
        ) : configs.length === 0 ? (
          <p className="text-gray-500">暂无保存的同步配置</p>
        ) : (
          <ul className="divide-y">
            {configs.map((config) => (
              <li key={config.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium">{config.name}</p>
                  <p className="text-sm text-gray-500">
                    {config.type === 'WEBDAV' ? 'WebDAV' : 'S3'} · 
                    {config.isActive ? '已启用' : '已禁用'}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button 
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    onClick={() => handleTestConnection(config.id)}
                  >
                    测试
                  </button>
                  <button 
                    className="px-3 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200"
                    onClick={() => handleSync(config.id, 'to-cloud')}
                  >
                    上传
                  </button>
                  <button 
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    onClick={() => handleSync(config.id, 'from-cloud')}
                  >
                    下载
                  </button>
                  <button 
                    className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                    onClick={() => handleDelete(config.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 