"use client";

import {useState} from "react";
import {useMutation, useQueryClient} from "@tanstack/react-query";
import {useApi} from "@/lib/api/provider";
import {describeApiError} from "@/lib/api/errors";
import {Sheet} from "./Sheet";
import {Button} from "./ui";

/// Editing your own bio. The only thing on a profile this app lets you change — the name, handle
/// and avatar come from X and are refreshed on sign-in, so editing them here would only produce a
/// copy that drifts.

const LIMIT = 280;

export function EditBioSheet({
  open,
  onClose,
  bio,
}: {
  open: boolean;
  onClose: () => void;
  bio: string | null;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(bio ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = draft.trim();
      // An empty bio is an absent one, not an empty string; the schema takes null for it.
      return await api.updateMe({body: {bio: trimmed === "" ? null : trimmed}});
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ["session"]});
      void queryClient.invalidateQueries({queryKey: ["user"]});
      onClose();
    },
  });

  return (
    <Sheet open={open} onClose={onClose} dismissible={!save.isPending} title="Edit bio">
      <div className="pb-5">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, LIMIT))}
          rows={4}
          autoFocus
          placeholder="What do you trade, and why should anyone copy you?"
          className="w-full resize-none rounded-xl border border-line bg-raised px-3.5 py-2.5 text-[0.875rem] leading-relaxed outline-none placeholder:text-dim focus:border-line-strong"
        />
        <p className="mt-1 text-right text-[0.6875rem] text-dim">
          {draft.length}/{LIMIT}
        </p>

        {save.isError ? (
          <p className="mt-2 text-[0.8125rem] text-short">{describeApiError(save.error).detail}</p>
        ) : null}

        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || draft.trim() === (bio ?? "").trim()}
          className="mt-3 w-full"
        >
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}
