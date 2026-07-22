import clsx from "clsx";
import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

export const navigationItems = [
  {
    to: "/",
    label: "RayCtify"
  },
  {
    to: "/auditor",
    label: "The Model Auditor",
    description: "Upload a loan model and test how it makes decisions."
  },
  {
    to: "/reference",
    label: "Reference Model",
    description: "See how the same case looks under RayCtify's fair reference model."
  },
  {
    to: "/arena",
    label: "The Arena",
    description: "Compare your model and the fair reference model side by side."
  },
  {
    to: "/interceptor",
    label: "The Interceptor",
    description: "Review a model, fix output bias, and export a healed version."
  },
  {
    to: "/vaccine",
    label: "Vaccine Generator",
    description: "Upload a CSV and create balanced rows for the next training run."
  }
];

const operatingPillars = [
  {
    value: "Zero",
    label: "Retention",
    detail: "Uploaded models, CSVs, and test results are not saved for later."
  },
  {
    value: "Client",
    label: "Exports",
    detail: "Healed models and vaccine datasets download straight to your device."
  },
  {
    value: "Five",
    label: "Workflows",
    detail: "Move across all five sections without losing your working session."
  }
];

export function Sidebar() {
  return (
    <aside className="min-h-0 min-w-0 max-w-full self-start">
      <div className="luxe-panel flex h-[calc(100vh-1.5rem)] min-h-0 flex-col overflow-hidden rounded-[2rem] px-4 py-3.5 sm:px-5 sm:py-4 lg:px-6 lg:py-5">
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain [webkit-overflow-scrolling:touch]">
          <div className="flex flex-col gap-4 px-1 lg:px-1.5">

            <nav className="grid gap-3 lg:gap-4">
              {navigationItems.map((item, index) => (
                <motion.div
                  key={item.to}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: index * 0.08 }}
                >
                  <NavLink
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      clsx(
                        "group flex h-full min-w-0 flex-col rounded-[1.75rem] border px-5 py-5 shadow-panel transition lg:px-6 lg:py-6",
                        isActive
                          ? "border-gold/45 bg-[linear-gradient(180deg,rgba(197,160,89,0.16),rgba(10,10,12,0.78))] text-parchment"
                          : "border-gold/20 bg-[linear-gradient(180deg,rgba(197,160,89,0.06),rgba(10,10,12,0.92))] text-parchment-muted hover:border-gold/30 hover:bg-[linear-gradient(180deg,rgba(197,160,89,0.10),rgba(10,10,12,0.94))]"
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex justify-end">
                          <span
                            className={clsx(
                              "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] lg:px-3 lg:py-1 lg:text-[11px]",
                              isActive
                                ? "border-gold/45 bg-gold/10 text-gold"
                                : "border-line-subtle text-parchment-muted"
                            )}
                          >
                            {isActive ? "Active" : "Open"}
                          </span>
                        </div>
                        {item.label === "RayCtify" ? (
                          <div className="mt-3 flex w-full flex-col items-center lg:mt-4">
                            <img
                              src="/logo.png"
                              alt="RayCtify logo"
                              className="h-32 w-32 rounded-[1.25rem] border border-line-subtle object-cover shadow-panel lg:h-48 lg:w-48"
                            />
                            <h2
                              className={clsx(
                                "mt-4 font-display text-2xl transition lg:text-3xl",
                                isActive
                                  ? "text-gold [text-shadow:0_0_18px_rgba(197,160,89,0.16)]"
                                  : "text-gold/70 group-hover:text-gold"
                              )}
                            >
                              RayCtify
                            </h2>
                          </div>
                        ) : (
                          <>
                            <div className="mt-3 font-display text-lg leading-[0.98] text-parchment sm:text-[1.4rem] lg:mt-4 lg:text-[2rem]">
                              <span
                                className={clsx(
                                  "transition",
                                  isActive
                                    ? "text-gold [text-shadow:0_0_18px_rgba(197,160,89,0.16)]"
                                    : "text-gold/95 group-hover:text-gold"
                                )}
                              >
                                {item.label}
                              </span>
                            </div>
                            {item.description && (
                              <p className="mt-3 text-sm leading-6 text-parchment-muted lg:mt-4 lg:text-[15px] lg:leading-7">
                                {item.description}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </nav>

            <div className="grid gap-4 pt-3">
              {operatingPillars.map((pillar) => (
                <div
                  key={pillar.label}
                  className="rounded-[2rem] border border-line-subtle bg-ink/80 px-5 py-5 shadow-panel lg:px-6 lg:py-6"
                >
                  <div className="font-display text-[1.8rem] text-gold lg:text-[2rem]">{pillar.value}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.26em] text-parchment-muted">{pillar.label}</div>
                  <div className="mt-3 text-sm leading-6 text-parchment-muted lg:text-[15px] lg:leading-7">{pillar.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
