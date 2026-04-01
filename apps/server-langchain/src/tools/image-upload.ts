import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const requestImageUploadTool = tool(
  async ({ accept = "image/*", multiple = false, hint }) => {
    return JSON.stringify({
      success: true,
      action: "request_image_upload",
      accept,
      multiple,
      hint: hint?.trim() || "请选择一张图片用于展示。",
      message: "已发起图片上传，请在页面中选择图片文件。",
    });
  },
  {
    name: "request_image_upload",
    description:
      "发起客户端图片上传并在聊天界面显示预览。Use this when user wants to upload an image and show it in UI.",
    schema: z.object({
      accept: z
        .string()
        .optional()
        .describe("文件类型过滤，默认 image/*，例如 image/png,image/jpeg"),
      multiple: z
        .boolean()
        .optional()
        .describe("是否允许多选，默认 false"),
      hint: z
        .string()
        .optional()
        .describe("上传提示文本，例如 '请上传商品截图'"),
    }),
  },
);
