import { useContext } from "react";
import { CalendarTimeZoneContext } from "./calendarTimeZoneContext";

export function useCalendarTimeZone() {
  return useContext(CalendarTimeZoneContext);
}

