// // app/_components/trend-graph.tsx
// "use client";

// import type { Incident } from "~/lib/mock-data";

// type TrendGraphProps = {
//   incidents: Incident[];
//   /**
//    * How many days back to show.
//    * Default: 30
//    */
//   days?: number;
//   /**
//    * Optional: show uptime for a single server.
//    * If omitted, this shows "global" platform uptime.
//    */
//   serverId?: string;
// };

// export function TrendGraph({
//   incidents,
//   days = 30,
//   serverId,
// }: TrendGraphProps) {
//   const MS_PER_DAY = 1000 * 60 * 60 * 24;
//   const today = new Date();

//   // Normalize a Date to "YYYY-MM-DD"
//   const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

//   // Optionally filter incidents to a single server
//   const filteredIncidents = serverId
//     ? incidents.filter((i) => i.serverId === serverId)
//     : incidents;

//   // Build a set of "days that had at least one incident"
//   const incidentDays = new Set<string>();
//   for (const inc of filteredIncidents) {
//     const ts =
//       inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
//     const key = toDayKey(ts);
//     incidentDays.add(key);
//   }

//   // Build the last N days as buckets
//   type DayBucket = { date: Date; key: string; hasIncident: boolean };

//   const dayBuckets: DayBucket[] = [];
//   for (let i = days - 1; i >= 0; i--) {
//     const date = new Date(today.getTime() - i * MS_PER_DAY);
//     const key = toDayKey(date);

//     dayBuckets.push({
//       date,
//       key,
//       hasIncident: incidentDays.has(key),
//     });
//   }

//   const daysWithIncident = dayBuckets.filter((d) => d.hasIncident).length;
//   const daysWithoutIncident = dayBuckets.length - daysWithIncident;

//   const uptimePercent =
//     dayBuckets.length === 0
//       ? 100
//       : (daysWithoutIncident / dayBuckets.length) * 100;

//   return (
//     <div className="card p-6">
//       <div className="mb-4 flex items-start justify-between gap-4">
//         <div>
//           <h2 className="text-lg font-semibold text-[var(--fg)]">
//             Server Uptime
//           </h2>
//           <p className="text-xs text-[var(--muted)]">
//             Last {days} days • {uptimePercent.toFixed(2)}% uptime
//           </p>
//           {serverId && (
//             <p className="mt-1 text-[11px] text-[var(--muted)]">
//               Filtered to server:{" "}
//               <span className="font-mono text-[var(--fg)]">{serverId}</span>
//             </p>
//           )}
//         </div>

//         <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
//           <div className="flex items-center gap-1">
//             <span className="h-3 w-3 rounded-sm bg-[var(--success)]" />
//             <span>Operational</span>
//           </div>
//           <div className="flex items-center gap-1">
//             <span className="h-3 w-3 rounded-sm bg-[var(--danger)]" />
//             <span>Incident</span>
//           </div>
//         </div>
//       </div>
      
//       <div>
//         {/* Bars */}
//         <div className="flex h-16 items-end gap-[2px] rounded-md bg-[var(--bg)] px-3 py-2">
//           {dayBuckets.map((day) => (
//             <div
//               key={day.key}
//               className={`h-full w-[6px] rounded-sm ${
//                 day.hasIncident ? "bg-[var(--danger)]" : "bg-[var(--success)]"
//               }`}
//               title={`${day.date.toDateString()} • ${
//                 day.hasIncident ? "Incident" : "Operational"
//               }`}
//             />
//           ))}
//         </div>

//         {/* Axis labels */}
//         <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
//           <span>{days} days ago</span>
//           <span>Today</span>
//         </div>
//       </div>
//     </div>
//   );
// }

// app/_components/trend-graph.tsx
"use client";

import type { Incident } from "~/lib/mock-data";

type TrendGraphProps = {
  incidents: Incident[];
  days?: number;
  /**
   * Optional: show uptime for a single server.
   * If omitted, this shows "global" platform uptime.
   */
  serverId?: string;
};

export function TrendGraph({
  incidents,
  days = 90,
  serverId,
}: TrendGraphProps) {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const today = new Date();

  // Normalize a Date to "YYYY-MM-DD"
  const toDayKey = (date: Date) => date.toISOString().slice(0, 10);

  // Optionally filter incidents to a single server
  const filteredIncidents = serverId
    ? incidents.filter((i) => i.serverId === serverId)
    : incidents;

  // Build a set of "days that had at least one incident"
  const incidentDays = new Set<string>();
  for (const inc of filteredIncidents) {
    const ts =
      inc.timestamp instanceof Date ? inc.timestamp : new Date(inc.timestamp);
    const key = toDayKey(ts);
    incidentDays.add(key);
  }

  // Build the last N days as buckets
  type DayBucket = { date: Date; key: string; hasIncident: boolean };

  const dayBuckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today.getTime() - i * MS_PER_DAY);
    const key = toDayKey(date);

    dayBuckets.push({
      date,
      key,
      hasIncident: incidentDays.has(key),
    });
  }

  const daysWithIncident = dayBuckets.filter((d) => d.hasIncident).length;
  const daysWithoutIncident = dayBuckets.length - daysWithIncident;

  const uptimePercent =
    dayBuckets.length === 0
      ? 100
      : (daysWithoutIncident / dayBuckets.length) * 100;

  return (
    <div className="card p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--fg)]">
            Server Uptime
          </h2>
          <p className="text-xs text-[var(--muted)]">
            Last {days} days • {uptimePercent.toFixed(2)}% uptime
          </p>
          {serverId && (
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Filtered to server:{" "}
              <span className="font-mono text-[var(--fg)]">{serverId}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-[var(--success)]" />
            <span>Operational</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-[var(--danger)]" />
            <span>Incident</span>
          </div>
        </div>
      </div>

      <div>
        {/* Bars */}
        <div className="flex h-16 items-end gap-[2px] rounded-md bg-[var(--bg)] px-3 py-2">
          {dayBuckets.map((day) => (
            <div
              key={day.key}
              className={`h-full flex-1 min-w-[4px] rounded-sm ${
                day.hasIncident ? "bg-[var(--danger)]" : "bg-[var(--success)]"
              }`}
              title={`${day.date.toDateString()} • ${
                day.hasIncident ? "Incident" : "Operational"
              }`}
            />
          ))}
        </div>

        {/* Axis labels */}
        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
          <span>{days} days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
