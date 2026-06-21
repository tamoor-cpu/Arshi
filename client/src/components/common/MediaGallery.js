import React, { useState } from 'react';
import { X, FileText, Download, ChevronLeft, ChevronRight } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL?.replace('/api/v1', '') || 'http://localhost:4000';

function getFullUrl(url) {
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function getType(url) {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  if (ext === 'pdf') return 'pdf';
  return 'image';
}

export default function MediaGallery({ urls = [], onRemove }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);

  if (!urls || urls.length === 0) return null;

  const images = urls.filter((u) => getType(u) === 'image');

  return (
    <div className="space-y-3">
      {/* Image grid */}
      {urls.some((u) => getType(u) === 'image') && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {urls.map((url, i) => {
            const type = getType(url);
            if (type !== 'image') return null;
            return (
              <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-400">
                <img
                  src={getFullUrl(url)}
                  alt=""
                  className="w-full h-full object-cover"
                  onClick={() => setLightboxIndex(images.indexOf(url))}
                />
                {onRemove && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(i); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Videos */}
      {urls.filter((u) => getType(u) === 'video').map((url, i) => (
        <div key={`video-${i}`} className="relative group">
          <video
            src={getFullUrl(url)}
            controls
            className="w-full rounded-lg border border-gray-200"
            preload="metadata"
          />
          {onRemove && (
            <button
              onClick={() => onRemove(urls.indexOf(url))}
              className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {/* PDFs */}
      {urls.filter((u) => getType(u) === 'pdf').map((url, i) => (
        <a
          key={`pdf-${i}`}
          href={getFullUrl(url)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-700"
        >
          <FileText className="w-5 h-5 text-red-500" />
          <span className="flex-1 truncate">{url.split('/').pop()}</span>
          <Download className="w-4 h-4 text-gray-400" />
        </a>
      ))}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button onClick={() => setLightboxIndex(null)} className="absolute top-4 right-4 text-white hover:text-gray-300">
            <X className="w-8 h-8" />
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + images.length) % images.length); }}
                className="absolute left-4 text-white hover:text-gray-300"
              >
                <ChevronLeft className="w-10 h-10" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % images.length); }}
                className="absolute right-4 text-white hover:text-gray-300"
              >
                <ChevronRight className="w-10 h-10" />
              </button>
            </>
          )}
          <img
            src={getFullUrl(images[lightboxIndex])}
            alt=""
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white text-sm">{lightboxIndex + 1} / {images.length}</p>
        </div>
      )}
    </div>
  );
}
