"use client";

import { useParams } from "next/navigation";
import { useUser } from "@/lib/hooks/useUsers";
import { useMarkets } from "@/lib/hooks/useMarkets";
import { Avatar } from "@/components/shared/avatar";
import { AddressDisplay } from "@/components/shared/address-display";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MarketCard } from "@/components/market/market-card";
import { formatPercent, formatTimeAgo, formatUsdc } from "@/lib/utils";

export default function ProfilePage() {
  const params = useParams<{ wallet: string }>();
  const wallet = params.wallet as string;

  const { data: user, isLoading, isError } = useUser(wallet);
  const { data: markets } = useMarkets({}, { creator: wallet });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError)
    return (
      <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
        Couldn&apos;t load this profile.
      </div>
    );
  if (!user)
    return (
      <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
        User not found.
      </div>
    );

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-5 p-6">
        <Avatar name={user.displayName ?? wallet} color={user.avatarColor ?? "#666"} size={56} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold">{user.displayName ?? "Anon"}</h1>
          <p className="text-xs text-muted-foreground">
            <AddressDisplay address={user.walletAddr} chars={6} />
            {user.createdAt ? (
              <>
                {" · joined "} {formatTimeAgo(user.createdAt)}
              </>
            ) : null}
          </p>
          {user.bio && <p className="mt-1 text-sm">{user.bio}</p>}
        </div>
        <dl className="grid grid-cols-3 gap-6 text-left">
          <div>
            <dt className="text-xs text-muted-foreground">Markets created</dt>
            <dd className="text-xl font-semibold">{user.marketsCreated ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Volume</dt>
            <dd className="text-xl font-semibold">${formatUsdc(user.totalVolumeUsdc ?? 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Accuracy</dt>
            <dd className="text-xl font-semibold">{formatPercent(user.accuracy ?? 0, 0)}</dd>
          </div>
        </dl>
      </Card>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Created markets</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(markets ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No markets yet.</p>
          ) : (
            (markets ?? []).map((m) => <MarketCard key={(m as {slug?: string}).slug ?? m.id} market={m} />)
          )}
        </div>
      </div>
    </div>
  );
}
