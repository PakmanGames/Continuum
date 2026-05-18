// import { Navigation } from "./navigation";

// export function LayoutWrapper({ children }: { children: React.ReactNode }) {
//   return (
//     <div className="min-h-screen bg-[#0d1117]">
//       <div className="fixed inset-0 -z-10 gradient-bg opacity-50" />
//       <Navigation />
//       <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative">
//         {children}
//       </main>
//     </div>
//   );
// }


export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0d1117]">
      <div className="fixed inset-0 -z-10 gradient-bg opacity-50" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 relative">
        {children}
      </main>
    </div>
  );
}
