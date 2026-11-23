'use client';

import { mediaUrl, readableTextColor } from '@chacota/core';
import { useState } from 'react';

const SIZES = { md: 'h-10 w-10 rounded-xl text-lg', lg: 'h-14 w-14 rounded-2xl text-2xl' } as const;

/** The org's logo, or its color with the first letter of its name when it has no logo (or it fails to load). */
export function OrgAvatar({
  name,
  logoKey,
  primaryColor,
  mediaBaseUrl,
  size = 'md',
}: {
  name: string;
  logoKey?: string;
  primaryColor?: string;
  mediaBaseUrl: string;
  size?: keyof typeof SIZES;
}) {
  const [broken, setBroken] = useState(false);
  const color = primaryColor ?? '#6B2FD6';
  if (logoKey && !broken) {
    return (
      <span className={`flex shrink-0 items-center justify-center overflow-hidden bg-blanco p-1 ${SIZES[size]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront */}
        <img src={mediaUrl(mediaBaseUrl, logoKey)} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-display font-extrabold ${SIZES[size]}`}
      style={{ background: color, color: readableTextColor(color) }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
