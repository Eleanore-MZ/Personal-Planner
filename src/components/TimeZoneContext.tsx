import type { ReactNode } from "react";
import { CalendarTimeZoneContext } from "./calendarTimeZoneContext";

export function CalendarTimeZoneProvider({
  children,
  timeZone,
}: {
  children: ReactNode;
  timeZone: string;
}) {
  return (
    <CalendarTimeZoneContext.Provider value={timeZone}>
      {children}
    </CalendarTimeZoneContext.Provider>
  );
}
