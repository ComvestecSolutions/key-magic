import type { BatchCreateBlockingRulesInput } from "../../app/types";
import type { ShortcutBuilderValue } from "../../shared/ShortcutBuilder";

export interface RuleEditorFormState extends ShortcutBuilderValue {
  description: string;
  targetProcesses: string[];
}

export interface BatchComposerState extends ShortcutBuilderValue {
  description: string;
}

export type BatchCreateShortcut =
  BatchCreateBlockingRulesInput["shortcuts"][number];

export interface BatchShortcutDraft {
  lineNumber: number;
  rawLine: string;
  shortcutText: string;
  noteText: string;
  shortcut?: BatchCreateShortcut;
  error?: string;
}

export type ValidBatchShortcutDraft = BatchShortcutDraft & {
  shortcut: BatchCreateShortcut;
};

export interface BatchCreateState {
  batchText: string;
  batchComposer: BatchComposerState;
  batchTargetProcesses: string[];
  batchEnabled: boolean;
  batchDrafts: BatchShortcutDraft[];
  validBatchDrafts: ValidBatchShortcutDraft[];
  invalidBatchDrafts: BatchShortcutDraft[];
  batchCreateError: string | null;
  editingBatchDraftLine: number | null;
  editingBatchDraftShortcutText: string;
  editingBatchDraftNoteText: string;
}
