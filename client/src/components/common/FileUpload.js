import React, { useState, useRef } from 'react';
import { Upload, X, FileVideo, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../../services/api';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

export default function FileUpload({ onUpload, accept = 'image/*,video/*,.pdf', maxFiles = 10, label = 'Upload Files' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setError('');
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    const fileArray = Array.from(files).slice(0, maxFiles);
    fileArray.forEach((file) => formData.append('files', file));

    try {
      const { data } = await api.post('/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onUpload(data.files.map((f) => f.url));
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={maxFiles > 1}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-gray-500">{progress}% uploaded</p>
          </div>
        ) : (
          <>
            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
            <p className="text-sm text-gray-600">{label}</p>
            <p className="text-xs text-gray-400">Drag & drop or click to browse</p>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Thumbnail preview for already-uploaded files
export function MediaThumbnails({ urls = [], onRemove }) {
  if (urls.length === 0) return null;

  const getType = (url) => {
    const ext = url.split('.').pop()?.toLowerCase();
    if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
    if (ext === 'pdf') return 'pdf';
    return 'image';
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {urls.map((url, i) => {
        const type = getType(url);
        const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
        return (
          <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
            {type === 'image' && <img src={fullUrl} alt="" className="w-full h-full object-cover" />}
            {type === 'video' && <FileVideo className="w-6 h-6 text-purple-500" />}
            {type === 'pdf' && <FileText className="w-6 h-6 text-red-500" />}
            {onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
