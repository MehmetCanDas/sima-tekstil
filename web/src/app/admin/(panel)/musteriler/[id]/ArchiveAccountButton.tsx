"use client";

import type { ActionResult } from "@/lib/admin/action";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ui";

/** Hesap arsivleme (soft delete). Siparis ve teklif gecmisi korunur. */
export function ArchiveAccountButton({
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
              <SubmitButton className="a-btn a-btn-ghost" pendingText="…">
                Arşivden çıkar
              </SubmitButton>
            </>
          ) : (
            <ConfirmSubmit
              title="Hesap arşivlensin mi?"
              body="Kullanıcı listelerden kalkar ve giriş yapamaz. Sipariş ve teklif geçmişi silinmez; istediğinizde geri getirebilirsiniz."
              confirmLabel="Arşivle"
            >
              Arşivle
            </ConfirmSubmit>
          )}
        </>
      )}
    </ActionForm>
  );
}
