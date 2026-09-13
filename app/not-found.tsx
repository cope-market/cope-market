import Link from "next/link";
import {Button, Card} from "@/components/ui";

export const metadata = {title: "Not found"};

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <Card className="w-full max-w-sm p-6 text-center">
        <p className="text-[1rem] font-semibold">There is nothing here</p>
        <p className="mx-auto mt-1.5 max-w-xs text-[0.8125rem] leading-relaxed text-muted">
          This page does not exist. A thesis or a position may also have been removed.
        </p>
        <Link href="/feed" className="mt-5 inline-block">
          <Button>Back to the feed</Button>
        </Link>
      </Card>
    </main>
  );
}
