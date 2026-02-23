import React, { useState, useEffect } from 'react';
import {
  XIcon,
  CopyIcon,
  CheckIcon,
  FolderIcon,
  FolderOpenIcon,
  FileIcon,
  DownloadIcon,
  Loader2Icon,
  ChevronRightIcon,
  ChevronDownIcon
} from 'lucide-react';
import api from '@/configs/axios';
import { toast } from 'sonner';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  size?: number;
  extension?: string;
}

interface ProjectExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProjectExplorerModal: React.FC<ProjectExplorerModalProps> = ({
  isOpen,
  onClose
}) => {
  const [structure, setStructure] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [loadingContent, setLoadingContent] = useState(false);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  // Fetch project structure on mount
  useEffect(() => {
    if (isOpen) {
      fetchProjectStructure();
    }
  }, [isOpen]);

  const fetchProjectStructure = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/project/structure');
      setStructure(data.structure);
      setLoading(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load project structure');
      setLoading(false);
    }
  };

  const fetchFileContent = async (filepath: string) => {
    try {
      setLoadingContent(true);
      const { data } = await api.post('/api/project/file-content', {
        filepath
      });
      setFileContent(data.content);
      setSelectedFile(filepath);
      setLoadingContent(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to load file content');
      setLoadingContent(false);
    }
  };

  const downloadProject = async () => {
    try {
      setDownloading(true);
      toast.info('Preparing download...');
      
      const response = await api.get('/api/project/download-zip', {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'site-builder-project.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Project downloaded successfully!');
      setDownloading(false);
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to download project');
      setDownloading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(fileContent);
      setCopiedFile(selectedFile);
      setTimeout(() => setCopiedFile(null), 2000);
      toast.success('Copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy');
    }
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (extension: string) => {
    const colors: { [key: string]: string } = {
      ts: 'text-blue-400',
      tsx: 'text-blue-400',
      js: 'text-yellow-400',
      jsx: 'text-yellow-400',
      json: 'text-yellow-600',
      html: 'text-orange-400',
      css: 'text-blue-500',
      md: 'text-gray-400',
      env: 'text-yellow-500',
      gitignore: 'text-gray-500',
      yml: 'text-purple-400',
      yaml: 'text-purple-400'
    };
    return colors[extension] || 'text-gray-400';
  };

  const renderFileTree = (nodes: FileNode[], depth: number = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === 'folder') {
        return (
          <div key={node.path}>
            <button
              onClick={() => toggleFolder(node.path)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-800 rounded transition-colors ${
                isExpanded ? 'bg-gray-800/50' : ''
              }`}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              {isExpanded ? (
                <ChevronDownIcon size={14} className="text-gray-400" />
              ) : (
                <ChevronRightIcon size={14} className="text-gray-400" />
              )}
              {isExpanded ? (
                <FolderOpenIcon size={16} className="text-blue-400" />
              ) : (
                <FolderIcon size={16} className="text-blue-400" />
              )}
              <span className="text-sm text-gray-300">{node.name}</span>
            </button>
            {isExpanded && node.children && (
              <div>{renderFileTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      } else {
        return (
          <button
            key={node.path}
            onClick={() => fetchFileContent(node.path)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-800 rounded transition-colors ${
              isSelected ? 'bg-indigo-900/50' : ''
            }`}
            style={{ paddingLeft: `${depth * 12 + 32}px` }}
          >
            <FileIcon
              size={16}
              className={getFileIcon(node.extension || '')}
            />
            <span className="text-sm text-gray-300">{node.name}</span>
          </button>
        );
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-7xl h-[90vh] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Project Explorer
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Browse and download the complete site builder project
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadProject}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 
              text-white rounded-md transition-colors text-sm disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2Icon size={16} className="animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <DownloadIcon size={16} />
                  Download ZIP
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-md transition-colors"
            >
              <XIcon size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Explorer Sidebar */}
          <div className="w-80 bg-gray-950 border-r border-gray-700 overflow-y-auto">
            <div className="p-4">
              <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
                File Explorer
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2Icon className="animate-spin text-gray-400" size={24} />
                </div>
              ) : (
                <div className="space-y-1">{renderFileTree(structure)}</div>
              )}
            </div>
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedFile ? (
              <>
                {/* File Header */}
                <div className="flex items-center justify-between px-6 py-3 bg-gray-950 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <FileIcon size={16} className="text-gray-400" />
                    <span className="text-sm font-mono text-white">
                      {selectedFile}
                    </span>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 
                    text-white rounded-md transition-colors text-xs"
                  >
                    {copiedFile === selectedFile ? (
                      <>
                        <CheckIcon size={14} />
                        Copied!
                      </>
                    ) : (
                      <>
                        <CopyIcon size={14} />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Code Display */}
                <div className="flex-1 overflow-auto p-6 bg-gray-900">
                  {loadingContent ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2Icon className="animate-spin text-gray-400" size={32} />
                    </div>
                  ) : (
                    <pre className="text-sm text-gray-300 font-mono bg-gray-950 p-4 rounded-lg overflow-x-auto">
                      <code>{fileContent}</code>
                    </pre>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-gray-700 bg-gray-950 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {fileContent.split('\n').length} lines
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FileIcon size={48} className="mx-auto mb-4 text-gray-600" />
                  <p className="text-lg">Select a file to view its content</p>
                  <p className="text-sm mt-2">
                    Click on any file in the explorer to see its code
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectExplorerModal;