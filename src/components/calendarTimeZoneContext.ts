import { createContext } from "react";
import { systemTimeZone } from "../utils/timezone";

export const CalendarTimeZoneContext = createContext(systemTimeZone);

