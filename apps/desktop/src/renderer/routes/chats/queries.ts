import type {
  ChatAttachment,
  CreateChatInput,
  OpenTerminalInput,
  UpdateChatInput,
} from "@agentic/contracts";
import { useCoreMutation, useCoreQuery } from "../../lib/core-queries";

export const useChats = () => useCoreQuery(["chats"], (c) => c.chats.list());
export const useChat = (id: string) => useCoreQuery(["chats", id], (c) => c.chats.get(id));
export const useTranscript = (id: string) =>
  useCoreQuery(["chats", id, "messages"], (c) => c.chats.transcript(id));
export const useRun = (runId: string | null | undefined) =>
  useCoreQuery(["runs", runId], (c) => c.runs.get(runId ?? ""), !!runId);
export const useGitStatus = (id: string, enabled: boolean) =>
  useCoreQuery(["chats", id, "git"], (c) => c.chats.git(id), enabled);
export const useGitDiff = (id: string, enabled: boolean) =>
  useCoreQuery(["chats", id, "git", "diff"], (c) => c.chats.gitDiff(id), enabled);
export const useTerminals = () => useCoreQuery(["terminals"], (c) => c.chats.terminals.list());

export const useCreateChat = () =>
  useCoreMutation((c, input: CreateChatInput) => c.chats.create(input));
export const useUpdateChat = () =>
  useCoreMutation((c, { id, input }: { id: string; input: UpdateChatInput }) =>
    c.chats.update(id, input),
  );
export const useRemoveChat = () => useCoreMutation((c, id: string) => c.chats.remove(id));
export const useSendMessage = () =>
  useCoreMutation(
    (c, { id, text, attachments }: { id: string; text: string; attachments: ChatAttachment[] }) =>
      c.chats.send(id, { text, attachments }),
  );
export const useCancelRun = () => useCoreMutation((c, runId: string) => c.runs.cancel(runId));
export const useOpenTerminal = () =>
  useCoreMutation((c, input: OpenTerminalInput) => c.chats.terminals.open(input));
export const useCloseTerminal = () =>
  useCoreMutation((c, terminalId: string) => c.chats.terminals.close(terminalId));
