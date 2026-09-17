import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { ZodError } from "zod";

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();
    const message =
      exception.issues
        .map((issue) => {
          const path = issue.path.filter((part) => part !== "").join(".") || "value";
          return `${path}: ${issue.message}`;
        })
        .join("; ") || "Invalid request";
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: "Bad Request",
    });
  }
}
