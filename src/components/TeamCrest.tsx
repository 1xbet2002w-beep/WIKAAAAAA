import React, { useState } from 'react';
import { Shield } from 'lucide-react';

interface TeamCrestProps {
  logoUrl?: string;
  name: string;
  shortCode: string;
  size?: 'sm' | 'md' | 'lg';
}

export const TeamCrest: React.FC<TeamCrestProps> = ({ logoUrl, name, shortCode, size = 'md' }) => {
  const [failed, setFailed] = useState(false);

  const isCountryFlag = Boolean(logoUrl && logoUrl.includes('/countries/'));

  const sizeCls =
    size === 'lg'
      ? 'h-24 w-24 sm:h-28 sm:w-28'
      : size === 'sm'
      ? 'h-10 w-10'
      : 'h-12 w-12 sm:h-14 sm:w-14';

  const paddingCls = isCountryFlag ? 'p-0' : size === 'lg' ? 'p-2.5' : size === 'sm' ? 'p-1' : 'p-1.5';

  if (!logoUrl || failed) {
    return (
      <div
        className={`${sizeCls} rounded-full ring-1 ring-slate-700/80 bg-[#0D1526] flex flex-col items-center justify-center shrink-0 shadow-sm`}
        title={name}
      >
        <Shield className={`${size === 'lg' ? 'h-9 w-9' : size === 'sm' ? 'h-4 w-4' : 'h-6 w-6'} text-sky-400/85`} />
        {size === 'lg' && (
          <span className="mt-1 font-mono text-xs font-bold text-slate-200">{shortCode}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`${sizeCls} ${paddingCls} rounded-full ring-1 ring-white/15 bg-white/[0.04] flex items-center justify-center overflow-hidden shrink-0 shadow-[0_4px_14px_rgba(0,0,0,0.45)]`}
    >
      <img
        src={logoUrl}
        alt={`شعار ${name}`}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`h-full w-full ${
          isCountryFlag
            ? 'object-cover scale-[1.04]'
            : 'object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]'
        }`}
      />
    </div>
  );
};
