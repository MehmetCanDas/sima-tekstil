"use client";

import { useRef, useState } from "react";

import {
  ACCEPT_IMAGES,
  MAX_FILE_MB,
  MAX_FILES_PER_UPLOAD,
  MAX_TOTAL_MB,
  checkFiles,
} from "@/lib/admin/upload-limits";

/* ---------------------------------------------------------------------------
 * Gorsel secme alani.
 *
 * Secim yapilir yapilmaz boyut ve tur kontrolu yapar. Bu kontrol olmadan cok
 * buyuk bir dosya, Server Action'in govde sinirina takilip sayfayi dusuren
 * ham bir 500 hatasi veriyordu - kullanici neyin yanlis oldugunu goremiyordu.
 *
 * Sunucu ayni kontrolu tekrar yapar; buradaki yalnizca anlasilir mesaj icin.
 * ------------------------------------------------------------------------ */

export function ImageFileInput({
  id,
  name,
  multiple,
  required,
  "aria-invalid": ariaInvalid,
}: {
  id?: string;
  name: string;
  multiple?: boolean;
  required?: boolean;
  "aria-invalid"?: "true";
}) {
  const [problem, setProblem] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) {
      setProblem(null);
      setSummary(null);
      return;
    }

    const check = checkFiles(files);
    if (!check.ok) {
      setProblem(check.error);
      setSummary(null);
      // Gecersiz secimi temizle: form gonderilirse yine sunucuda reddedilirdi.
      if (ref.current) ref.current.value = "";
      return;
    }

    const total = files.reduce((sum, f) => sum + f.size, 0);
    setProblem(null);
    setSummary(
      `${files.length} dosya · ${(total / (1024 * 1024)).toFixed(1)} MB seçildi`,
    );
  }

  return (
    <>
      <input
        ref={ref}
        id={id}
        name={name}
        type="file"
        multiple={multiple}
        required={required}
        accept={ACCEPT_IMAGES}
        onChange={onChange}
        aria-invalid={problem ? "true" : ariaInvalid}
        className="a-input"
      />
      {problem ? (
        <p role="alert" className="a-error">
          {problem}
        </p>
      ) : summary ? (
        <p className="a-hint text-ok">{summary}</p>
      ) : null}
    </>
  );
}

/** Formlarda tekrarlanan sinir aciklamasi. */
export function uploadHint(multiple?: boolean): string {
  const base = `JPEG, PNG, WebP veya AVIF · dosya başına en fazla ${MAX_FILE_MB} MB`;
  return multiple
    ? `${base} · tek seferde ${MAX_FILES_PER_UPLOAD} dosya ve toplam ${MAX_TOTAL_MB} MB.`
    : `${base}.`;
}
