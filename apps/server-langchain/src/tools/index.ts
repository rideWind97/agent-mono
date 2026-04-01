import { calculatorTool } from "./calculator.js";
import { currentTimeTool } from "./datetime.js";
import { requestImageUploadTool } from "./image-upload.js";
import { setPageBackgroundColorTool } from "./page-style.js";
import { translatorTool } from "./translator.js";
import { weatherTool } from "./weather.js";

/** All available tools for the LangChain agent */
export const allTools = [
  weatherTool,
  calculatorTool,
  currentTimeTool,
  translatorTool,
  setPageBackgroundColorTool,
  requestImageUploadTool,
];
