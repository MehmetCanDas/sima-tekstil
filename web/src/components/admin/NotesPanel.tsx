"use client";

import { addNoteAction, deleteNoteAction } from "@/lib/admin/customers.actions";
import { dateTime } from "@/lib/admin/format";
import { ActionForm, SubmitButton } from "./ui";

/* ---------------------------------------------------------------------------
 * Dahili musteri notlari (spec: 12).
 *
 * Bu notlar yalnizca panelde gorunur; musteri arayuzunun hicbir yerinde
 * okunmaz. Uyari metni bilerek gorunur tutuldu ki yaziligi sanilmasin.
 * ------------------------------------------------------------------------ */

type Note = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: number;
};

export function NotesPanel({
  notes,
  userId,
  companyId,
  canWrite,
}: {
  notes: Note[];
  userId?: string;
  companyId?: string;
  canWrite: boolean;
}) {
  return (
    <section className="a-card">
      <header className="border-b border-line px-4 py-3">
        <h2 className="text-[15px] font-semibold uppercase tracking-[0.06em] text-ink-2">
          Dahili notlar
        </h2>
        <p className="text-[12px] text-muted">Müşteriye gösterilmez.</p>
      </header>

      {canWrite ? (
        <div className="border-b border-line p-4">
          <ActionForm action={addNoteAction} resetOnSuccess className="flex flex-col gap-2">
            {(state) => (
              <>
                {userId ? <input type="hidden" name="userId" value={userId} /> : null}
                {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
                <textarea
                  name="body"
                  rows={3}
                  className="a-textarea"
                  placeholder="Örn. Bu müşteri özellikle oversize ürünlerle ilgileniyor."
                  aria-label="Dahili not"
                  aria-invalid={state && !state.ok && state.fieldErrors?.body ? "true" : undefined}
                  maxLength={4000}
                  required
                />
                <div>
                  <SubmitButton className="a-btn a-btn-primary a-btn-sm">
                    Not ekle
                  </SubmitButton>
                </div>
              </>
            )}
          </ActionForm>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-muted">Henüz not yok.</p>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={note.id} className="border-b border-line px-4 py-3 last:border-b-0">
              <p className="whitespace-pre-wrap text-[13.5px]">{note.body}</p>
              <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                <span>{note.authorName ?? "—"}</span>
                <span>{dateTime(note.createdAt)}</span>
                {canWrite ? (
                  <ActionForm action={deleteNoteAction}>
                    {() => (
                      <>
                        <input type="hidden" name="noteId" value={note.id} />
                        <button
                          type="submit"
                          className="text-[11px] text-muted underline hover:text-[#b3261e]"
                        >
                          sil
                        </button>
                      </>
                    )}
                  </ActionForm>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
