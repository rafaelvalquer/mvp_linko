import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    productId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    priceCents: { type: Number, required: true, min: 0 },

    // caminho público: /uploads/products/<file>
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true },
);

// único por tenant
ProductSchema.index({ workspaceId: 1, productId: 1 }, { unique: true });
ProductSchema.index({ workspaceId: 1, createdAt: -1 });

export const Product =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);
