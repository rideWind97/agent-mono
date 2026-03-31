export { weatherTool } from "./weather.js";
export { calculatorTool } from "./calculator.js";
export { currentTimeTool } from "./datetime.js";
export { translatorTool } from "./translator.js";

import { weatherTool } from "./weather.js";
import { calculatorTool } from "./calculator.js";
import { currentTimeTool } from "./datetime.js";
import { translatorTool } from "./translator.js";

/** All available tools for the LangChain agent */
export const allTools = [weatherTool, calculatorTool, currentTimeTool, translatorTool];
