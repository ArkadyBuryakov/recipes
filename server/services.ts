import { db } from "./db/client";
import { createImageStore, ImageService } from "./images";
import { RecipeService } from "./recipes/service";

export const services = {
  recipes: new RecipeService(db),
  images: new ImageService(db, createImageStore()),
};

export type Services = typeof services;
