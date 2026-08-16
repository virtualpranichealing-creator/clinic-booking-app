'use client';

import { useState } from 'react';

// A password <input> with an eye toggle to show/hide what's typed - same
// brand-input styling as every other auth field, just with room carved out
// on the right for the toggle button.
export default function PasswordInput({ className = 'brand-input', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input type={visible ? 'text' : 'password'} className={`${className} pr-11`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-0 top-0 h-full px-3 flex items-center text-slate-400 hover:text-slate-600"
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
