import { redirect } from "next/navigation";

// The CRM has no login page of its own — authentication is handled by
// flood-website-community. This server component issues an instant HTTP 307
// with zero client-side JavaScript (no spinner, no hydration wait).
//
// NEXT_PUBLIC_COMMUNITY_URL is read at request time on the server, so the
// correct Railway URL is always used regardless of when the build ran.
export default function LoginPage() {
  const communityUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_URL || "http://localhost:3002";
  redirect(`${communityUrl}/login`);
}
