'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import DrawingCanvas from '../DrawingCanvas';

const STATUS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'overactivated', label: 'Overactivated' },
  { value: 'underactivated', label: 'Underactivated' },
  { value: 'congested', label: 'Congested' },
  { value: 'depleted', label: 'Depleted' },
];

// Mirrors the "New chakra observation" form a healer fills out on a
// patient's page (app/healer/patients/[patientId]/page.jsx), so admin can
// see and interact with the exact same fields for reference - nothing
// typed here is saved anywhere.
export default function HealerNotePreview() {
  const [chakras, setChakras] = useState([]);
  const [chakraTags, setChakraTags] = useState({});
  const [summary, setSummary] = useState('');
  const [drawingData, setDrawingData] = useState(null);
  const [savedNote, setSavedNote] = useState(null);

  useEffect(() => {
    supabase
      .from('chakras')
      .select('*')
      .order('display_order')
      .then(({ data }) => setChakras(data || []));
  }, []);

  function updateChakraTag(chakraId, field, value) {
    setChakraTags((prev) => ({
      ...prev,
      [chakraId]: { ...prev[chakraId], [field]: value },
    }));
  }

  return (
    <div className="brand-card space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Which session is this for?</label>
        <select disabled className="border border-slate-300 rounded px-3 py-2 w-full bg-slate-50 text-slate-400">
          <option>e.g. Online Pranic Healing Session — Aug 15, 2:00 PM</option>
        </select>
        <p className="text-[11px] text-slate-400 mt-1">
          In real use, this lists the healer's actual sessions with that patient.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Body diagram (draw or annotate)</label>
        <DrawingCanvas onChange={setDrawingData} />
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Chakra tags</h3>
        <div className="space-y-2">
          {chakras.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 border-b pb-2">
              <span className="w-40 text-sm">{c.label}</span>
              <select
                value={chakraTags[c.id]?.status || ''}
                onChange={(e) => updateChakraTag(c.id, 'status', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Notes (optional)"
                value={chakraTags[c.id]?.notes || ''}
                onChange={(e) => updateChakraTag(c.id, 'notes', e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm flex-1 min-w-[150px]"
              />
            </div>
          ))}
          {chakras.length === 0 && <p className="text-sm text-slate-400">Loading chakras…</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Overall summary (this will be visible to the patient)
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
          placeholder="e.g. Overall energy improving, continue distant healing twice a week..."
        />
      </div>

      <button
        onClick={() => setSavedNote('preview')}
        className="bg-slate-800 text-white rounded px-4 py-2 text-sm"
      >
        Save observation
      </button>
      {savedNote && (
        <p className="text-xs text-amber-600">
          This is a preview — nothing was actually saved. This is exactly what a healer sees when
          documenting a session.
        </p>
      )}
    </div>
  );
}
