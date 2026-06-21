import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';

export default function LocationMultiSelect({ locations, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const allSelected = selected.length === 0 || selected.length === locations.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : []);
  };

  const toggle = (id) => {
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
        <MapPin className="w-4 h-4 text-gray-400" />
        <span className="text-gray-700">
          {allSelected ? 'All Locations' : `${selected.length} location${selected.length !== 1 ? 's' : ''}`}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <button onClick={toggleAll}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 border-b ${allSelected ? 'text-blue-600 font-medium' : 'text-gray-700'}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
              {allSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            All Locations
          </button>
          <div className="max-h-60 overflow-y-auto">
            {locations.map(loc => {
              const isSelected = selected.includes(loc.id);
              return (
                <button key={loc.id} onClick={() => toggle(loc.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 ${isSelected ? 'text-blue-600' : 'text-gray-700'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {loc.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
