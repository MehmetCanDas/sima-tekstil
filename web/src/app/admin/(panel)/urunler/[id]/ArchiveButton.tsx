"use client";

import type { ActionResult } from "@/lib/admin/action";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ui";

/**
 * Arsivleme / arsivden cikarma.
 * Urun hicbir zaman fiziksel olarak silinmez; siparis ve teklif satirlari ona
 * referans verdigi icin durum degistirilir (spec: 6, 22).
 */
export function ArchiveButton({
  action,
  id,
  archived,
}: {
  action: (
    prev: ActionResult<never> | null,
    formData: FormData,
  ) => Promise<ActionResult<never>>;
  id: string;
  archived: boolean;
}) {
  return (
    <ActionForm action={action}>
      {() => (
        <>
          <input type="hidden" name="id" value={id} />
          {archived ? (
            <>
              <input type="hidden" name="restore" value="1" />
              <SubmitButton className="a-btn a-btn-ghost" pendingText="İşleniyor…">
                Arşivden çıkar
              </SubmitButton>
            </>
          ) : (
            <ConfirmSubmit
              title="Ürün arşive alınsın mı?"
              body="Ürün sitede görünmez olur ama silinmez. Sipariş geçmişi korunur ve istediğinizde geri getirebilirsiniz."
              confirmLabel="Arşive al"
            >
              Arşive al
            </ConfirmSubmit>
          )}
        </>
      )}
    </ActionForm>
  );
}
