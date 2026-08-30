import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../auth/AuthContext";
import { AuditLogsPage } from "./AuditLogsPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuditLogsPage", () => {
  it("renders the audit log page and loading state", async () => {
    vi.mock("../../services/api/platform-audit", () => ({
      getAuditLogs: vi.fn().mockResolvedValue({
        items: [
          {
            id: "audit-1",
            actorStaffId: "staff-1",
            eventCode: "ORGANIZATION_CREATED",
            category: "ORGANIZATION",
            resourceType: "Organization",
            resourceId: "org-1",
            summary: "Organization created",
            metadata: { requestId: "req-1" },
            requestId: "req-1",
            correlationId: "corr-1",
            createdAt: "2026-08-29T09:00:00.000Z",
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      }),
    }));

    render(
      <AuthProvider>
        <AuditLogsPage />
      </AuthProvider>,
    );

    expect(screen.getByText("Audit logs")).toBeVisible();
    const summaryCell = await screen.findByText("Organization created");
    fireEvent.click(summaryCell.closest("tr")!);
    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "ORGANIZATION_CREATED",
    );
  });
});
