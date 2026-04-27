"use client";

import { useEffect } from "react";

const COMMUNITY_URL = process.env.NEXT_PUBLIC_COMMUNITY_URL || "http://localhost:3002";

export default function LoginRedirect() {
  useEffect(() => {
    window.location.replace(`${COMMUNITY_URL}/login`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 mx-auto mb-4" />
        <p className="text-sm text-gray-500">Redirecting to sign in…</p>
      </div>
    </div>
  );
}
