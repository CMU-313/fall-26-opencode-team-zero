import { DialogSelect } from "../../ui/dialog-select"
import { DialogAlert } from "../../ui/dialog-alert"
import {
  explainReferencedFileRole,
  groupReferencedFiles,
  type ReferencedFileRole,
} from "../../util/referenced-file-role"

const presentation: Record<ReferencedFileRole, { label: string; explanation: string }> = {
  source: {
    label: "Source",
    explanation: "Implementation files that define the project's behavior.",
  },
  test: {
    label: "Tests",
    explanation: "Files that verify behavior and guard against regressions.",
  },
  configuration: {
    label: "Configuration",
    explanation: "Files that control tools, dependencies, builds, and runtime settings.",
  },
  documentation: {
    label: "Documentation",
    explanation: "Files that explain the project, its architecture, or how to use it.",
  },
  other: {
    label: "Other",
    explanation: "Referenced files that do not match a recognized project role.",
  },
}

export function DialogReferencedFiles(props: { files: string[] }) {
  const groups = groupReferencedFiles(props.files)

  return (
    <DialogSelect
      title="Referenced Files"
      placeholder="Search groups"
      options={groups.map((group) => {
        const item = presentation[group.role]
        return {
          title: item.label,
          value: group.role,
          description: `${group.files.length} ${group.files.length === 1 ? "file" : "files"}`,
          details: [item.explanation],
          onSelect: (dialog) =>
            dialog.replace(() => (
              <DialogSelect
                title={`${item.label} Files`}
                placeholder="Search files"
                footer={<text>{item.explanation}</text>}
                options={group.files.map((file) => {
                  const classification = explainReferencedFileRole(file)
                  return {
                    title: file,
                    value: file,
                    truncateTitle: "left" as const,
                    description: "view classification",
                    onSelect: (dialog) =>
                      dialog.replace(() => (
                        <DialogAlert
                          title="Referenced File"
                          message={`Path: ${file}\nRole: ${presentation[classification.role].label}\nWhy: ${classification.reason}`}
                        />
                      )),
                  }
                })}
              />
            )),
        }
      })}
    />
  )
}
