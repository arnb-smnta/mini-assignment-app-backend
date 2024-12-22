import mongoose from "mongoose";
import { AvaialbleTaskStatus, TaskEnumStatus } from "../../../constants.js";

const taskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    progress: [{ type: mongoose.Schema.Types.ObjectId, ref: "Progress" }],
    score: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", taskSchema);
