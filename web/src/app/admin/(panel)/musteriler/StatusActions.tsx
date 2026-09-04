"use client";

import { setUserStatusAction } from "@/lib/admin/customers.actions";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ui";

/* ---------------------------------------------------------------------------
 * Hesap onay islemleri (spec: 11).
 *
 * Butonlar duruma gore degisir ama HEPSI tek bir formun icinde durur ve form
 * hicbir durumda kaldirilmaz. Her durum icin ayri form kullanildiginda, islem
 * basarili olunca o form ekrandan kalkiyor ve basari bildirimi hic
 * gosterilemeden kayboluyordu.
 *
 * Hangi duruma gecilecegi butonun kendi name/value ciftinden gelir.
 * ------------------------------------------------------------------------ */

export function StatusActions({
  userId,
  status,
  canApprove,
  canSuspend,
  compact,
}: {
  userId: string;
  status: string;
  canApprove: boolean;
  canSuspend: boolean;
  compact?: boolean;
}) {
  const size = compact ? "a-btn a-btn-sm" : "a-btn";

  return (
    <ActionForm action={setUserStatusAction} className="flex flex-wrap items-center gap-1">
      {() => (
        <>
          <input type="hidden" name="id" value={userId} />

          {status === "pending" && canApprove ? (
            <>
              <SubmitButton
                className={`${size} a-btn-primary`}
                pendingText="…"
                name="status"
                value="active"
              >
                Onayla
              </SubmitButton>
              <ConfirmSubmit
                className={`${size} a-btn-danger`}
                title="Başvuru reddedilsin mi?"
                body="Kullanıcı giriş yapamaz. Kayıt silinmez, daha sonra onaylayabilirsiniz."
                confirmLabel="Reddet"
                name="status"
                value="rejected"
              >
                Reddet
              </ConfirmSubmit>
            </>
          ) : null}

          {status === "active" && canSuspend ? (
            <ConfirmSubmit
              className={`${size} a-btn-danger`}
              title="Hesap askıya alınsın mı?"
              body="Kullanıcı hemen çıkış yaptırılır ve giriş yapamaz. İstediğinizde tekrar aktif edebilirsiniz."
              confirmLabel="Askıya al"
              name="status"
              value="suspended"
            >
              Askıya al
            </ConfirmSubmit>
          ) : null}

          {(status === "suspended" || status === "rejected") && canApprove ? (
            <SubmitButton
              className={`${size} a-btn-ghost`}
              pendingText="…"
              name="status"
              value="active"
            >
              Aktif et
            </SubmitButton>
          ) : null}
        </>
      )}
    </ActionForm>
  );
}
