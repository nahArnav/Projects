import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet } from "react-router-dom";
import { Sidebar, navigationItems } from "./Sidebar";

const pageTransition = {
  initial: { opacity: 0, y: 26 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    y: 18,
    transition: { duration: 0.35, ease: "easeOut" }
  }
};

const headerMetrics = [
  {
    label: "Transit",
    value: "TLS Ready",
    detail: "Files can be sent safely while staying temporary."
  },
  {
    label: "Navigation",
    value: "Isolated",
    detail: "Each section has its own workspace, so the flow stays easy to follow."
  },
  {
    label: "Tables",
    value: "Paged",
    detail: "Search and page controls keep large result sets readable."
  }
];

const sectionSummaries = {
  "/": "Welcome to RayCtify. Use the sections below to audit, benchmark, fix, and prepare your lending models.",
  "/auditor": "Upload a model, try different applicant details, and see how the decision changes.",
  "/reference": "Check the same case against RayCtify's fair reference model for a cleaner benchmark.",
  "/arena": "Compare your uploaded model and the fair reference model side by side using the same inputs.",
  "/interceptor": "Review the uploaded model, apply the fairness fix, and export a healed version.",
  "/vaccine": "Upload a CSV, add balanced synthetic rows, and export a cleaner dataset for retraining."
};

export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const activeView =
    navigationItems.find((item) =>
      item.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.to)
    ) || navigationItems[0];
  const activeSummary = sectionSummaries[activeView.to] || activeView.description;

  return (
    <div className="relative mx-auto grid h-screen max-h-screen min-h-0 w-full min-w-0 max-w-[1580px] grid-cols-[clamp(280px,25vw,360px)_minmax(0,1fr)] gap-3 overflow-hidden px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
      <Sidebar />

      <main className="flex-1 min-h-0 min-w-0 overflow-x-hidden w-full h-[calc(100vh-1.5rem)] overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-[1180px]">
          {/* Header completely removed per user request */}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="w-full min-w-0 pb-10 pt-3"
          >
            {outlet}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
