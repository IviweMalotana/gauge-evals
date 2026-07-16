import Link from "next/link";

export interface GithubStatusInfo {
  connected: boolean;
  login: string | null;
  avatarUrl: string | null;
  defaultRepo: string | null;
  repoCount: number;
}

/**
 * Compact GitHub connection indicator for the top bar: the connected account
 * (avatar + @login), the default repo, and how many repos are attached — or a
 * clear "not connected" prompt linking to Settings.
 */
export function GithubStatus({ info }: { info: GithubStatusInfo }) {
  if (!info.connected) {
    return (
      <Link href="/settings" className="gh-status gh-off" title="Connect GitHub in Settings">
        <span className="gh-dot" aria-hidden />
        GitHub: not connected
      </Link>
    );
  }

  const extra = info.repoCount > 1 ? ` +${info.repoCount - 1}` : "";
  return (
    <Link
      href="/settings"
      className="gh-status gh-on"
      title={`Connected as @${info.login ?? "unknown"}${info.defaultRepo ? ` · default repo ${info.defaultRepo}` : ""}`}
    >
      {info.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="gh-avatar" src={info.avatarUrl} alt="" width={18} height={18} />
      ) : (
        <span className="gh-dot gh-dot-on" aria-hidden />
      )}
      <span className="mono">@{info.login ?? "unknown"}</span>
      {info.defaultRepo ? (
        <>
          <span className="gh-sep">/</span>
          <span className="mono">{info.defaultRepo}</span>
          {extra ? <span className="gh-more">{extra}</span> : null}
        </>
      ) : (
        <span className="gh-more">no repo</span>
      )}
    </Link>
  );
}
