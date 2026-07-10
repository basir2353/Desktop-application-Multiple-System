export type PrintNoticeTone = "success" | "error";

export type PrintNotice = {
  message: string;
  tone: PrintNoticeTone;
};

export function printSuccessMessage(label: string): PrintNotice {
  return { message: label, tone: "success" };
}

export function printFailureMessage(label: string): PrintNotice {
  return {
    message: `Print failed — ${label}. Check printer connection and try again.`,
    tone: "error",
  };
}

export function noticeFromPrintResult(ok: boolean, successLabel: string): PrintNotice {
  return ok ? printSuccessMessage(successLabel) : printFailureMessage(successLabel);
}
