'use client';

import { mediaUrl } from '@chacota/core';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, useTransition } from 'react';
import { requestMediaUploadAction } from '@/app/[locale]/app/media-actions';
import { prepareImage } from '@/lib/image-resize';
import { buttonClass } from './ui';

/** Picks an image, shrinks it in the browser, uploads it and reports the new key (or null to remove). */
export function ImagePicker({
  label,
  hint,
  value,
  slug,
  purpose,
  maxSide,
  mediaBaseUrl,
  onChange,
}: {
  label: string;
  hint?: string;
  value?: string;
  slug: string;
  purpose: 'logo' | 'content';
  maxSide: number;
  mediaBaseUrl: string;
  onChange: (key: string | null) => void;
}) {
  const t = useTranslations('imagePicker');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const [uploading, startUpload] = useTransition();

  function upload(file: File) {
    setError(null);
    startUpload(async () => {
      try {
        // Logos keep every detail: they are shown large on the projector and have sharp edges and text.
        const blob = await prepareImage(file, maxSide, purpose === 'logo' ? 1 : 0.88);
        const signed = await requestMediaUploadAction(slug, purpose, { contentType: blob.type, size: blob.size });
        if (!signed.ok) return setError(t(`errors.${signed.error}`));
        const res = await fetch(signed.url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob });
        if (!res.ok) return setError(t('errors.upload'));
        setBroken(false);
        onChange(signed.key);
      } catch {
        setError(t('errors.not_an_image'));
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-noche-3 bg-noche">
          {value && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- media comes from S3/CloudFront, no Next optimization
            <img src={mediaUrl(mediaBaseUrl, value)} alt="" className="h-full w-full object-contain" onError={() => setBroken(true)} />
          ) : (
            <span className="px-2 text-center text-xs text-niebla">{value ? t('missing') : t('none')}</span>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = '';
          }}
        />
        <button type="button" className={buttonClass('secondary')} disabled={uploading} aria-describedby={`${id}-label`} onClick={() => input.current?.click()}>
          {uploading ? t('uploading') : value ? t('change') : t('choose')}
        </button>
        {value && (
          <button type="button" className={buttonClass('ghost')} disabled={uploading} aria-describedby={`${id}-label`} onClick={() => onChange(null)}>
            {t('remove')}
          </button>
        )}
      </div>
      {hint && <p className="text-sm text-niebla">{hint}</p>}
      {error && (
        <p className="text-sm text-[#ff9cc0]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
