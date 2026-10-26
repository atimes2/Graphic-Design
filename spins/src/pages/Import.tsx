import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconUpload } from "../components/icons";
import { ErrorNotice, PageHead, SectionHead, Stat } from "../components/ui";
import { addPlays, clearPlays } from "../lib/db";
import { date, num, plural } from "../lib/format";
import { parseFiles, type ImportResult } from "../lib/importer";
import { summarize } from "../lib/stats";
import { useStore } from "../lib/store";

type Status = { kind: "idle" } | { kind: "working"; message: string } | { kind: "done"; result: ImportResult; added: number } | { kind: "error"; message: string };

export function ImportPage() {
  const { plays, reloadPlays, mode } = useStore();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const sources = useMemo(() => {
    const imported = plays.filter((p) => p.source === "import");
    const synced = plays.filter((p) => p.source === "sync");
    return { imported: summarize(imported), synced: summarize(synced) };
  }, [plays]);

  async function run(files: File[]) {
    if (!files.length) return;
    if (mode === "demo") {
      setStatus({ kind: "error", message: "You're in demo mode. Leave the demo (Settings) to import your own history." });
      return;
    }
    try {
      setStatus({ kind: "working", message: `Reading ${plural(files.length, "file")}…` });
      const result = await parseFiles(files);
      if (result.files === 0) {
        setStatus({
          kind: "error",
          message: "Couldn't find any listening history in that. Look for files named Streaming_History_Audio_… or StreamingHistory_music_… (or drop the whole .zip).",
        });
        return;
      }
      setStatus({ kind: "working", message: `Saving ${num(result.plays.length)} plays…` });
      const added = await addPlays(result.plays);
      await reloadPlays();
      setStatus({ kind: "done", result, added });
    } catch (e) {
      setStatus({ kind: "error", message: (e as Error).message || "Import failed." });
    }
  }

  return (
    <>
      <PageHead eyebrow="Import" title="Your whole history" />
      <p className="muted" style={{ maxWidth: 680 }}>
        Spotify's live API only exposes your last 50 plays. Your full history — every stream since you opened your account — is in the data export Spotify
        will email you. Drop it here; it's read on this device and never uploaded anywhere.
      </p>

      <div className="grid cols-2" style={{ marginTop: 22, alignItems: "start" }}>
        <div className="panel">
          <h2 className="section-title" style={{ marginBottom: 16 }}>
            Get your data
          </h2>
          <ol className="steps">
            <li>
              <span>
                Open{" "}
                <a href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">
                  spotify.com/account/privacy
                </a>{" "}
                and sign in.
              </span>
            </li>
            <li>
              <span>
                Tick <b>Extended streaming history</b> (the lifetime one — the basic "Account data" only covers the last year) and press <b>Request data</b>.
              </span>
            </li>
            <li>
              <span>Confirm the email Spotify sends you. The export usually arrives within a few days (they say up to 30).</span>
            </li>
            <li>
              <span>
                Download the <code>my_spotify_data.zip</code> and drop it here. No need to unzip.
              </span>
            </li>
          </ol>
        </div>

        <div className="stack">
          <div
            className={`dropzone ${over ? "over" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => input.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              run([...e.dataTransfer.files]);
            }}
          >
            <IconUpload />
            <b>Drop your .zip or .json files</b>
            <span className="muted small">or click to choose · Extended and basic exports both work</span>
            <input
              ref={input}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              multiple
              hidden
              onChange={(e) => {
                run([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
          </div>

          {status.kind === "working" && (
            <div className="notice">
              <span className="spinner" />
              <div className="notice-body">{status.message}</div>
            </div>
          )}
          {status.kind === "error" && <ErrorNotice error={status.message} />}
          {status.kind === "done" && (
            <div className="notice accent">
              <div className="notice-body">
                <b>Imported {num(status.added)} new plays</b> from {plural(status.result.files, "file")}.
                {status.result.plays.length - status.added > 0 && <> {num(status.result.plays.length - status.added)} were already saved.</>}
                {status.result.skippedNonMusic > 0 && <> Skipped {num(status.result.skippedNonMusic)} podcast/audiobook plays.</>}{" "}
                <Link to="/insights?range=all" className="link">
                  See your lifetime stats →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <SectionHead title="What's saved on this device" />
      <div className="grid cols-2">
        <SourceCard
          title="Imported history"
          s={sources.imported}
          onClear={async () => {
            if (!confirm("Delete all imported plays from this device? You can re-import the file any time.")) return;
            await clearPlays("import");
            await reloadPlays();
          }}
        />
        <SourceCard
          title="Saved by Spins"
          hint="Your recent plays, saved each time Spins opens."
          s={sources.synced}
          onClear={async () => {
            if (!confirm("Delete the plays Spins saved from Spotify? Anything older than your last 50 plays can't be fetched again.")) return;
            await clearPlays("sync");
            await reloadPlays();
          }}
        />
      </div>
    </>
  );
}

function SourceCard({ title, hint, s, onClear }: { title: string; hint?: string; s: ReturnType<typeof summarize>; onClear: () => void }) {
  return (
    <div className="panel stack">
      <div className="row">
        <h3 className="section-title" style={{ fontSize: 16 }}>
          {title}
        </h3>
        <div className="spacer" />
        {s.streams > 0 && (
          <button className="btn small danger" onClick={onClear}>
            Delete
          </button>
        )}
      </div>
      {hint && <span className="muted small">{hint}</span>}
      {s.streams > 0 ? (
        <div className="grid cols-2">
          <Stat label="Plays" value={num(s.streams)} />
          <Stat label="Covers" value={s.first && s.last ? `${new Date(s.first).getFullYear()}–${new Date(s.last).getFullYear()}` : "—"} note={s.first && s.last ? `${date(s.first)} → ${date(s.last)}` : undefined} />
        </div>
      ) : (
        <span className="muted small">Nothing yet.</span>
      )}
    </div>
  );
}
