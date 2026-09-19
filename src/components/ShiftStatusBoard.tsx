import { useState } from 'react';
import { Button } from './ui';
import { theme } from '../config/theme';

interface ShiftStatusBoardProps {
  onBack: () => void;
}

export default function ShiftStatusBoard({ onBack }: ShiftStatusBoardProps) {
  const [loading] = useState(false);
  const c = theme.colors;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-xs font-medium cursor-pointer" style={{ color: c.primary }}>← Back</button>
        <h2 className="text-base font-bold" style={{ color: c.white }}>📋 Shift Status Board</h2>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>Loading...</p>
      ) : (
        <p style={{ textAlign: 'center', padding: '24px 0', color: c.grayDark, fontSize: '12px' }}>
          TODO: Migrate shift notifications to Firestore
        </p>
      )}
    </div>
  );
}
