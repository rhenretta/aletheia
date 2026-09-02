import { NextRequest, NextResponse } from "next/server";

export function isReadOnlyRequest(req: NextRequest): boolean {
  const viewAsHeader = req.headers.get("x-view-as-user");
  const readOnlyHeader = req.headers.get("x-read-only-mode");
  const queryViewAs = req.nextUrl.searchParams.get("viewAs");
  const queryReadOnly = req.nextUrl.searchParams.get("readOnly");

  return Boolean(
    viewAsHeader ||
    readOnlyHeader === "true" ||
    queryViewAs ||
    queryReadOnly === "true"
  );
}

export function readOnlyForbiddenResponse(actionName: string = "State mutations"): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: `Read-only mode active: ${actionName} are not permitted while viewing the site as another user.`,
      is_read_only: true,
    },
    { status: 403 }
  );
}
