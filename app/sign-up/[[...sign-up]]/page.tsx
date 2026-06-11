// ---------------------------------------------------------------------------
// Sign-up — request-access stub (M2.5 Clerk→NextAuth migration).
//
// There is NO self-serve signup: accounts are created manually or
// programmatically by the FlipOps team, and passwords are issued via
// scripts/set-user-password.ts. This page just routes interest.
// ---------------------------------------------------------------------------

import Link from "next/link";
import { Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </span>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              FlipOps
            </span>
          </div>
          <CardTitle className="text-2xl tracking-tight">Request access</CardTitle>
          <CardDescription>
            FlipOps is in private beta. Accounts are created by our team —
            reserve your spot and we&apos;ll set you up with credentials.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/reserve">Reserve your spot</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="mailto:tannercarlson@vvsvault.com?subject=FlipOps%20access%20request">
              <Mail className="mr-2 h-4 w-4" />
              Email the team
            </a>
          </Button>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
