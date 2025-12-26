import { useState, useRef, useCallback } from 'react';
import { Upload, File, FileText, Image, FileIcon, X, ChevronDown, ChevronUp, Loader2, Paperclip } from 'lucide-react';
import { useReasoningStore } from '../stores/reasoningStore';

interface UploadedFile {
  name: string;
  content: string;
  type: string;
  size: number;
  isBase64?: boolean;
  mimeType?: string;
}

export function ContextUpload() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { context, setContext, setContextFiles, status } = useReasoningStore();

  const isDisabled = status === 'running';

  const processFile = async (file: File): Promise<UploadedFile | null> => {
    const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];
    const textExtensions = ['.txt', '.md', '.markdown', '.csv', '.json'];
    const binaryTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    const binaryExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp'];

    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isText = textTypes.includes(file.type) || textExtensions.includes(extension);
    const isBinary = binaryTypes.includes(file.type) || binaryExtensions.includes(extension);

    if (!isText && !isBinary) {
      console.warn(`File type not supported: ${file.name}`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (isBinary) {
          const base64 = (e.target?.result as string).split(',')[1];
          resolve({
            name: file.name,
            content: base64,
            type: file.type || extension,
            size: file.size,
            isBase64: true,
            mimeType: file.type || (extension === '.pdf' ? 'application/pdf' : `image/${extension.slice(1)}`),
          });
        } else {
          resolve({
            name: file.name,
            content: e.target?.result as string,
            type: file.type || extension,
            size: file.size,
            isBase64: false,
          });
        }
      };
      reader.onerror = () => resolve(null);
      if (isBinary) reader.readAsDataURL(file);
      else reader.readAsText(file);
    });
  };

  const handleFiles = async (fileList: FileList) => {
    if (isDisabled) return;
    setIsProcessing(true);
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const processed = await processFile(fileList[i]);
      if (processed) newFiles.push(processed);
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      updateContext(updatedFiles);
    }
    setIsProcessing(false);
  };

  const updateContext = (fileList: UploadedFile[]) => {
    setContextFiles(fileList);
    if (fileList.length === 0) {
      setContext('');
      return;
    }

    const textFiles = fileList.filter(f => !f.isBase64);
    const binaryFiles = fileList.filter(f => f.isBase64);
    const parts: string[] = [];

    textFiles.forEach(f => {
      parts.push(`--- FILE: ${f.name} ---\n${f.content}\n--- END FILE ---`);
    });
    binaryFiles.forEach(f => {
      parts.push(`--- FILE: ${f.name} (${f.mimeType}) [attached as base64] ---`);
    });

    setContext(parts.join('\n\n'));
  };

  const handleRemoveFile = (index: number) => {
    const updatedFiles = files.filter((_, i) => i !== index);
    setFiles(updatedFiles);
    updateContext(updatedFiles);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!isDisabled) setIsDragging(true);
  }, [isDisabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isDisabled && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }, [isDisabled]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (file: UploadedFile) => {
    if (file.type.includes('image') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => file.name.toLowerCase().endsWith(ext))) {
      return <Image className="w-4 h-4 text-teal" />;
    }
    if (file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
      return <FileIcon className="w-4 h-4 text-rose" />;
    }
    if (file.type.includes('markdown') || file.name.toLowerCase().endsWith('.md')) {
      return <FileText className="w-4 h-4 text-violet" />;
    }
    return <File className="w-4 h-4 text-text-muted" />;
  };

  return (
    <div className="card">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center">
            <Paperclip className="w-4 h-4 text-teal" />
          </div>
          <span className="font-semibold text-text-primary">Context Files</span>
          {files.length > 0 && (
            <span className="tag tag-teal">{files.length}</span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isDisabled && fileInputRef.current?.click()}
            className={`
              relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-teal bg-teal/5'
                : 'border-border-subtle hover:border-border-medium hover:bg-background-tertiary/30'
              }
              ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.markdown,.csv,.json,.pdf,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              disabled={isDisabled}
            />
            {isProcessing ? (
              <Loader2 className="w-8 h-8 animate-spin text-teal mx-auto mb-3" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-teal/10 flex items-center justify-center mx-auto mb-3">
                <Upload className="w-6 h-6 text-teal" />
              </div>
            )}
            <p className="text-sm text-text-secondary font-medium">
              {isDragging ? 'Drop files here' : 'Drop files or click to upload'}
            </p>
            <p className="text-xs text-text-muted mt-1.5">
              PDF, Images, TXT, MD, CSV, JSON
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-background-tertiary/50 border border-border-subtle"
                >
                  <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center">
                    {getFileIcon(file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate font-medium">{file.name}</p>
                    <p className="text-xs text-text-muted">
                      {formatSize(file.size)}
                      {file.isBase64 && <span className="ml-2 text-teal">Base64</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    disabled={isDisabled}
                    className="p-1.5 rounded-lg text-text-muted hover:text-rose hover:bg-rose/10 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Context Preview */}
          {context && (
            <div>
              <p className="text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">Preview</p>
              <div className="rounded-xl bg-background/40 border border-border-subtle p-3 max-h-24 overflow-y-auto">
                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                  {context.slice(0, 500)}{context.length > 500 ? '...' : ''}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
