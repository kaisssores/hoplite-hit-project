import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CATALOG_COLUMNS, type Api, type ApiHealth, type CatalogColumn } from "@tether/sdk";
import { AUTH_LABEL, STATUS_LABEL, fmtCompact, fmtMs } from "../state/format";
import { transition, vtName } from "../state/motion";
import { go, setLayout } from "../state/sync";
import { store, useStore } from "../state/store";
import { isTyping } from "../ui/hooks";
import { TensionGlyph, tensionOf } from "../ui/Line";
import { Button, Empty, ICON, Keycap, Segmented, Switch } from "../ui/primitives";

type Sort = "catalog" | "latency" | "traffic";

// Filters outlive the page, so coming back from an API lands on the same list.
const memory = { query: "", category: "All", sort: "catalog" as Sort };

const COLUMN: Record<CatalogColumn, { label: string; width: string; align?: "right" }> = {
  category: { label: "Category", width: "96px" },
  auth: { label: "Auth", width: "112px" },
  version: { label: "Version", width: "144px" },
  status: { label: "Status", width: "124px" },
  latency: { label: "p50", width: "64px", align: "right" },
  traffic: { label: "Requests 24 h", width: "96px", align: "right" },
};

function Cell({ column, api, health }: { column: CatalogColumn; api: Api; health: ApiHealth | undefined }) {
  switch (column) {
    case "category":
      return <span className="cat-cell">{api.category}</span>;
    case "auth":
      return <span className="cat-cell">{AUTH_LABEL[api.auth]}</span>;
    case "version":
      return (
        <span className="cat-cell mono">
          {api.version}
          {api.stability !== "stable" && <span className="cat-stability" data-stability={api.stability}>{api.stability}</span>}
        </span>
      );
    case "status":
      return (
        <span className="cat-cell cat-status" data-status={health?.status}>
          <TensionGlyph tension={tensionOf(health?.status)} />
          {STATUS_LABEL[health?.status ?? "operational"]}
        </span>
      );
    case "latency":
      return <span className="cat-cell num right">{fmtMs(health?.p50)}</span>;
    case "traffic":
      return <span className="cat-cell num right">{health ? fmtCompact(health.requests24h) : "—"}</span>;
  }
}

export function Catalog() {
  const apis = useStore((state) => state.apis);
  const health = useStore((state) => state.health);
  const config = useStore((state) => state.prefs.layout.catalog);
  const rig = useStore((state) => state.rig);
  const morph = useStore((state) => state.morph);
  const [query, setQuery] = useState(memory.query);
  const [category, setCategory] = useState(memory.category);
  const [sort, setSort] = useState<Sort>(memory.sort);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    memory.query = query;
    memory.category = category;
    memory.sort = sort;
  }, [query, category, sort]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !isTyping(event.target)) {
        event.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const categories = useMemo(() => ["All", ...new Set(apis.map((api) => api.category))], [apis]);
  const columns = CATALOG_COLUMNS.filter((column) => config.columns.includes(column));

  const rows = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = apis.filter((api) => {
      if (category !== "All" && api.category !== category) return false;
      const text = `${api.name} ${api.id} ${api.summary} ${api.category} ${api.endpoints.map((e) => e.path).join(" ")}`.toLowerCase();
      return words.every((word) => text.includes(word));
    });
    if (sort === "latency") matches.sort((a, b) => (health[b.id]?.p50 ?? 0) - (health[a.id]?.p50 ?? 0));
    if (sort === "traffic") matches.sort((a, b) => (health[b.id]?.requests24h ?? 0) - (health[a.id]?.requests24h ?? 0));
    return matches;
    // Health ticks must not reshuffle a sorted list under the pointer, so sorting reads health only when inputs change.
  }, [apis, query, category, sort]);

  const grouped = config.group === "category" && sort === "catalog";
  const groups = useMemo(() => {
    if (!grouped) return [{ name: null as string | null, rows }];
    const names = [...new Set(rows.map((api) => api.category))];
    return names.map((name) => ({ name, rows: rows.filter((api) => api.category === name) }));
  }, [rows, grouped]);

  const statuses = apis.map((api) => health[api.id]?.status ?? "operational");
  const count = (status: string) => statuses.filter((entry) => entry === status).length;
  const summary = [
    `${apis.length} APIs`,
    `${count("operational")} operational`,
    count("degraded") ? `${count("degraded")} degraded` : null,
    count("outage") ? `${count("outage")} down` : null,
    count("maintenance") ? `${count("maintenance")} in maintenance` : null,
  ].filter(Boolean);

  const flip = (update: () => void) => void transition("flip", update);
  const template = { "--cat-cols": ["minmax(140px, 1fr)", ...columns.map((column) => COLUMN[column].width)].join(" ") } as CSSProperties;

  const onListKey = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const links = [...(list.current?.querySelectorAll<HTMLAnchorElement>("a.cat-row") ?? [])];
    const at = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = links[at + (event.key === "ArrowDown" ? 1 : -1)];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  return (
    <div className="view view-catalog">
      <header className="view-head enter">
        <div>
          <h1 className="view-title">Catalog</h1>
          <p className="view-meta">{summary.join(" · ")}</p>
        </div>
        <Button variant="primary" icon={<Plus {...ICON} />} onClick={() => store.set({ sheet: { type: "register" } })}>
          Register API
        </Button>
      </header>

      <div className="toolbar enter">
        <label className="search">
          <Search {...ICON} />
          <input
            ref={search}
            placeholder="Search"
            value={query}
            onChange={(event) => flip(() => setQuery(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                list.current?.querySelector<HTMLAnchorElement>("a.cat-row")?.focus();
              } else if (event.key === "Escape") {
                flip(() => setQuery(""));
              }
            }}
          />
          <Keycap>/</Keycap>
        </label>
        <div className="chips" role="radiogroup" aria-label="Category">
          {categories.map((name) => (
            <button key={name} type="button" role="radio" className="chip" aria-checked={category === name} onClick={() => flip(() => setCategory(name))}>
              {name}
            </button>
          ))}
        </div>
        <Segmented
          size="sm"
          label="Sort"
          value={sort}
          options={[
            { value: "catalog", label: "Catalog order" },
            { value: "latency", label: "Slowest" },
            { value: "traffic", label: "Busiest" },
          ]}
          onChange={(next) => flip(() => setSort(next))}
        />
      </div>

      {rig && (
        <div className="rig-strip">
          <span className="rig-label">Columns</span>
          {CATALOG_COLUMNS.map((column) => (
            <button
              key={column}
              type="button"
              className="chip"
              aria-pressed={config.columns.includes(column)}
              onClick={() =>
                setLayout(
                  {
                    catalog: {
                      ...config,
                      columns: config.columns.includes(column)
                        ? config.columns.filter((entry) => entry !== column)
                        : [...config.columns, column],
                    },
                  },
                  "flip",
                )
              }
            >
              {COLUMN[column].label}
            </button>
          ))}
          <span className="rig-inline">
            <Switch
              label="Group by category"
              checked={config.group === "category"}
              onChange={(on) => setLayout({ catalog: { ...config, group: on ? "category" : "none" } }, "flip")}
            />
            Group by category
          </span>
        </div>
      )}

      <div className="cat enter" style={template} ref={list} onKeyDown={onListKey}>
        <div className="cat-head">
          <span>API</span>
          {columns.map((column) => (
            <span key={column} className={COLUMN[column].align === "right" ? "right" : undefined}>
              {COLUMN[column].label}
            </span>
          ))}
        </div>
        {rows.length === 0 && (
          <Empty title={`No API matches “${query}”`}>
            Search covers names, summaries and endpoint paths
          </Empty>
        )}
        {groups.map((group) => (
          <div key={group.name ?? "all"} className="cat-group">
            {group.name && (
              <div className="cat-group-name" data-flip style={{ "--vt": vtName("grp", group.name) } as CSSProperties}>
                {group.name}
                <span className="num">{group.rows.length}</span>
              </div>
            )}
            {group.rows.map((api) => (
              <a
                key={api.id}
                className="cat-row"
                href={`/api/${api.id}`}
                data-flip
                style={{ "--vt": vtName("row", api.id) } as CSSProperties}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) return;
                  event.preventDefault();
                  go({ name: "api", id: api.id });
                }}
              >
                <span className="cat-main">
                  <span className="cat-name" data-morph={morph === api.id ? "name" : undefined}>
                    {api.name}
                  </span>
                  {api.origin !== "official" && <span className="tag">{api.origin === "hub" ? "This server" : "Registered"}</span>}
                  <span className="cat-summary">{api.summary}</span>
                </span>
                {columns.map((column) => (
                  <Cell key={column} column={column} api={api} health={health[api.id]} />
                ))}
              </a>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
