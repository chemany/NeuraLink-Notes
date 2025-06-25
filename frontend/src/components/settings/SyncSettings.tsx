import React, { useEffect, useState } from 'react';
import { CloudIcon, ArrowUpCircleIcon, ArrowDownCircleIcon, TrashIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import syncService, { SyncConfig } from '../../services/syncService';

// Define constants directly in the component file
export enum SyncProviderType {
  WEBDAV = 'WEBDAV',
  S3 = 'S3',
}

export const S3_ACL_OPTIONS = [
  'private', 'public-read', 'public-read-write', 'authenticated-read', 
  'aws-exec-read', 'bucket-owner-read', 'bucket-owner-full-control'
];

interface SyncSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// 表单状态数据类型
interface FormData {
  name: string;
  type: SyncProviderType;
  isActive: boolean;
  description: string;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavPath: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKey: string;
  s3SecretKey: string;
  s3Endpoint: string;
  s3Path: string;
  s3Acl: string;
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ open, onOpenChange }) => {
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SyncConfig | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: SyncProviderType.WEBDAV,
    isActive: true,
    description: '',
    webdavUrl: '',
    webdavUsername: '',
    webdavPassword: '',
    webdavPath: '',
    s3Region: '',
    s3Bucket: '',
    s3AccessKey: '',
    s3SecretKey: '',
    s3Endpoint: '',
    s3Path: '',
    s3Acl: '',
  });

  const [formTab, setFormTab] = useState('basic');
  
  // 加载同步配置
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await syncService.getAllConfigs();
      setConfigs(data);
    } catch (error) {
      alert('无法加载同步配置');
      console.error('无法加载同步配置', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始化加载
  useEffect(() => {
    if (open) {
      loadConfigs();
    }
  }, [open]);
  
  // 处理输入变更
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData(prev => ({
        ...prev,
        [name]: checkbox.checked
      }));
    } else if (name === 'type') {
      // 处理类型转换，确保枚举值正确
      const syncType = value === 'WEBDAV' ? SyncProviderType.WEBDAV : SyncProviderType.S3;
      setFormData(prev => ({
        ...prev,
        [name]: syncType
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // 打开创建表单
  const handleCreate = () => {
    setFormData({
      name: '',
      type: SyncProviderType.WEBDAV,
      isActive: true,
      description: '',
      webdavUrl: '',
      webdavUsername: '',
      webdavPassword: '',
      webdavPath: '',
      s3Region: '',
      s3Bucket: '',
      s3AccessKey: '',
      s3SecretKey: '',
      s3Endpoint: '',
      s3Path: '',
      s3Acl: '',
    });
    setFormTab('basic');
    setIsEditing(false);
    setIsFormOpen(true);
  };
  
  // 打开编辑表单
  const handleEdit = (config: SyncConfig) => {
    setFormData({
      name: config.name,
      type: config.type as SyncProviderType,
      isActive: config.isActive || false,
      description: config.description || '',
      webdavUrl: config.webdavUrl || '',
      webdavUsername: config.webdavUsername || '',
      webdavPassword: '',  // 出于安全考虑，不回显密码
      webdavPath: config.webdavPath || '',
      s3Region: config.s3Region || '',
      s3Bucket: config.s3Bucket || '',
      s3AccessKey: config.s3AccessKey || '',
      s3SecretKey: '',     // 出于安全考虑，不回显密码
      s3Endpoint: config.s3Endpoint || '',
      s3Path: config.s3Path || '',
      s3Acl: config.s3Acl || '',
    });
    setFormTab('basic');
    setSelectedConfig(config);
    setIsEditing(true);
    setIsFormOpen(true);
  };
  
  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // 验证表单
      if (!formData.name.trim()) {
        alert('请输入名称');
        return;
      }
      
      if (formData.type === SyncProviderType.WEBDAV && !formData.webdavUrl) {
        alert('请输入WebDAV URL');
        return;
      }
      
      if (formData.type === SyncProviderType.S3 && (!formData.s3Bucket || !formData.s3Region)) {
        alert('请输入S3存储桶和区域');
        return;
      }
      
      // 处理提交
      const submitData = { ...formData } as any;
      
      if (isEditing && selectedConfig?.id) {
        // 如果密码字段为空，不更新密码
        if (!submitData.webdavPassword) {
          delete submitData.webdavPassword;
        }
        if (!submitData.s3SecretKey) {
          delete submitData.s3SecretKey;
        }
        
        await syncService.updateConfig(selectedConfig.id, submitData as SyncConfig);
        alert('同步配置已更新');
      } else {
        await syncService.createConfig(submitData as SyncConfig);
        alert('同步配置已创建');
      }
      setIsFormOpen(false);
      loadConfigs();
    } catch (error) {
      alert(isEditing ? '更新失败: 请检查您的配置' : '创建失败: 请检查您的配置');
      console.error('保存配置失败', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 删除配置
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个同步配置吗？')) {
      return;
    }
    
    try {
      setLoading(true);
      await syncService.deleteConfig(id);
      alert('同步配置已删除');
      loadConfigs();
    } catch (error) {
      alert('删除失败: 无法删除同步配置');
      console.error('删除配置失败', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 测试连接
  const handleTest = async (id: string) => {
    try {
      setLoading(true);
      const result = await syncService.testConnection(id);
      if (result.success) {
        alert(`连接成功: ${result.message || '成功连接到存储服务'}`);
      } else {
        alert(`连接失败: ${result.message || '无法连接到存储服务'}`);
      }
    } catch (error) {
      alert('测试失败: 无法测试连接');
      console.error('测试连接失败', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 同步到云端
  const handleSyncToCloud = async (id: string) => {
    try {
      setSyncLoading(true);
      const result = await syncService.syncToCloud(id);
      if (result.success) {
        alert(`同步成功: ${result.message || '数据已成功同步到云端'}`);
      } else {
        alert(`同步失败: ${result.message || '无法同步数据到云端'}`);
      }
    } catch (error) {
      alert('同步失败: 同步到云端过程中发生错误');
      console.error('同步到云端失败', error);
    } finally {
      setSyncLoading(false);
    }
  };
  
  // 从云端同步
  const handleSyncFromCloud = async (id: string) => {
    try {
      setSyncLoading(true);
      const result = await syncService.syncFromCloud(id);
      if (result.success) {
        alert(`同步成功: ${result.message || '数据已成功从云端同步'}`);
      } else {
        alert(`同步失败: ${result.message || '无法从云端同步数据'}`);
      }
    } catch (error) {
      alert('同步失败: 从云端同步过程中发生错误');
      console.error('从云端同步失败', error);
    } finally {
      setSyncLoading(false);
    }
  };
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-medium">云同步设置</h2>
          <button 
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            ✕
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          配置云同步服务，支持WebDAV和S3存储。
        </p>
        
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handleCreate}
            className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            <PlusIcon className="h-4 w-4" />
            添加同步配置
          </button>
          
          <button
            onClick={loadConfigs}
            className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-800"
            disabled={loading}
          >
            <RefreshCwIcon className="h-4 w-4" />
            刷新
          </button>
        </div>
        
        {/* 配置列表 */}
        <div className="space-y-4">
          {configs.length === 0 ? (
            <div className="text-center py-10 border border-gray-200 rounded">
              <CloudIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-lg font-semibold">没有同步配置</h3>
              <p className="mt-1 text-sm text-gray-500">点击"添加同步配置"按钮开始配置。</p>
            </div>
          ) : (
            configs.map((config) => (
              <div 
                key={config.id} 
                className={`border border-gray-200 rounded-lg p-4 ${!config.isActive ? "opacity-70" : ""}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      {config.name}
                      {!config.isActive && <span className="text-xs text-gray-500">(禁用)</span>}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {config.type === SyncProviderType.WEBDAV ? 'WebDAV存储' : 'S3对象存储'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                      onClick={() => handleTest(config.id as string)}
                      disabled={loading}
                    >
                      测试连接
                    </button>
                    <button 
                      className="px-2 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                      onClick={() => handleEdit(config)}
                      disabled={loading}
                    >
                      编辑
                    </button>
                    <button 
                      className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                      onClick={() => handleDelete(config.id as string)}
                      disabled={loading}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                <div className="mt-2">
                  {config.type === SyncProviderType.WEBDAV ? (
                    <div className="text-sm">
                      <p><strong>URL:</strong> {config.webdavUrl}</p>
                      <p><strong>用户名:</strong> {config.webdavUsername}</p>
                      <p><strong>路径:</strong> {config.webdavPath || '/'}</p>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <p><strong>区域:</strong> {config.s3Region}</p>
                      <p><strong>存储桶:</strong> {config.s3Bucket}</p>
                      {config.s3Endpoint && <p><strong>终端节点:</strong> {config.s3Endpoint}</p>}
                      <p><strong>路径:</strong> {config.s3Path || '/'}</p>
                      {config.s3Acl && <p><strong>ACL:</strong> {config.s3Acl}</p>}
                    </div>
                  )}
                  {config.description && (
                    <p className="mt-2 text-sm text-gray-500">{config.description}</p>
                  )}
                </div>
                
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    onClick={() => handleSyncToCloud(config.id as string)}
                    disabled={syncLoading || !config.isActive}
                  >
                    <ArrowUpCircleIcon className="h-4 w-4" />
                    同步到云端
                  </button>
                  <button
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                    onClick={() => handleSyncFromCloud(config.id as string)}
                    disabled={syncLoading || !config.isActive}
                  >
                    <ArrowDownCircleIcon className="h-4 w-4" />
                    从云端同步
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 添加/编辑配置表单 */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-medium">
                {isEditing ? '编辑同步配置' : '添加同步配置'}
              </h2>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex border-b mb-4">
                <button
                  type="button"
                  className={`px-4 py-2 ${formTab === 'basic' ? 'border-b-2 border-blue-500' : ''}`}
                  onClick={() => setFormTab('basic')}
                >
                  基本信息
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 ${formTab === 'webdav' ? 'border-b-2 border-blue-500' : ''}`}
                  onClick={() => setFormTab('webdav')}
                >
                  WebDAV设置
                </button>
                <button
                  type="button"
                  className={`px-4 py-2 ${formTab === 's3' ? 'border-b-2 border-blue-500' : ''}`}
                  onClick={() => setFormTab('s3')}
                >
                  S3设置
                </button>
              </div>
              
              {formTab === 'basic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 font-medium">名称</label>
                    <input
                      type="text"
                      name="name"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="配置名称"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">类型</label>
                    <select
                      name="type"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={formData.type}
                      onChange={handleInputChange}
                      required
                    >
                      <option value={SyncProviderType.WEBDAV}>WebDAV</option>
                      <option value={SyncProviderType.S3}>S3 对象存储</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">描述</label>
                    <textarea
                      name="description"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="可选的配置描述"
                      rows={3}
                      value={formData.description}
                      onChange={handleInputChange}
                    ></textarea>
                  </div>
                  
                  <div className="flex items-center justify-between border rounded p-3">
                    <div>
                      <label className="font-medium">启用</label>
                      <p className="text-sm text-gray-500">启用或禁用此同步配置</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="isActive"
                        className="sr-only peer"
                        checked={formData.isActive}
                        onChange={(e) => setFormData(prev => ({...prev, isActive: e.target.checked}))}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              )}
              
              {formTab === 'webdav' && (
                <div className="space-y-4">
                  <div>
                    <label className="block mb-1 font-medium">WebDAV URL</label>
                    <input
                      type="url"
                      name="webdavUrl"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="https://example.com/webdav/"
                      value={formData.webdavUrl}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">用户名</label>
                    <input
                      type="text"
                      name="webdavUsername"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="WebDAV用户名"
                      value={formData.webdavUsername}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">密码</label>
                    <input
                      type="password"
                      name="webdavPassword"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder={isEditing ? "保持不变请留空" : "WebDAV密码"}
                      value={formData.webdavPassword}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">路径 (可选)</label>
                    <input
                      type="text"
                      name="webdavPath"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="/notebook-lm-backup/"
                      value={formData.webdavPath}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              )}
              
              {formTab === 's3' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">区域</label>
                      <input
                        type="text"
                        name="s3Region"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="us-east-1"
                        value={formData.s3Region}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-1 font-medium">存储桶</label>
                      <input
                        type="text"
                        name="s3Bucket"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="my-bucket"
                        value={formData.s3Bucket}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">访问密钥ID</label>
                      <input
                        type="text"
                        name="s3AccessKey"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder="访问密钥ID"
                        value={formData.s3AccessKey}
                        onChange={handleInputChange}
                      />
                    </div>
                    
                    <div>
                      <label className="block mb-1 font-medium">秘密访问密钥</label>
                      <input
                        type="password"
                        name="s3SecretKey"
                        className="w-full border border-gray-300 rounded px-3 py-2"
                        placeholder={isEditing ? "保持不变请留空" : "秘密访问密钥"}
                        value={formData.s3SecretKey}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">终端节点URL (可选)</label>
                    <input
                      type="url"
                      name="s3Endpoint"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="https://minio.example.com"
                      value={formData.s3Endpoint}
                      onChange={handleInputChange}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      使用自定义S3兼容存储（如MinIO）时提供
                    </p>
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">路径前缀 (可选)</label>
                    <input
                      type="text"
                      name="s3Path"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      placeholder="notebook-lm-backup/"
                      value={formData.s3Path}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block mb-1 font-medium">ACL (可选)</label>
                    <select
                      name="s3Acl"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={formData.s3Acl}
                      onChange={handleInputChange}
                    >
                      <option value="">不设置ACL</option>
                      {S3_ACL_OPTIONS.map(option => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
                  onClick={() => setIsFormOpen(false)}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  disabled={loading}
                >
                  {isEditing ? '更新' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncSettings; 