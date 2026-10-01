import { NextResponse } from "next/server";
import { INVITE_COOKIE } from "@/lib/site/server";

/** "Not you?" — forget the invitation remembered on this device. */
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
